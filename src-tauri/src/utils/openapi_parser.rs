//! OpenAPI/Swagger v3 Specification Parser
//!
//! This module parses OpenAPI v3 specifications (JSON and YAML) and extracts
//! documented API endpoints for Shadow API Detection. Endpoints not found in
//! the spec will be flagged as "Shadow API".

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================
// ERROR TYPES
// ============================================

/// Error type for OpenAPI parsing operations
#[derive(Debug, Clone)]
pub enum OpenApiError {
    /// Invalid JSON format
    InvalidJson(String),
    /// Invalid YAML format
    InvalidYaml(String),
    /// Missing required field in spec
    MissingField(String),
    /// Invalid OpenAPI version
    InvalidVersion(String),
    /// Generic parsing error
    ParseError(String),
}

impl std::fmt::Display for OpenApiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            OpenApiError::InvalidJson(msg) => write!(f, "Invalid JSON: {}", msg),
            OpenApiError::InvalidYaml(msg) => write!(f, "Invalid YAML: {}", msg),
            OpenApiError::MissingField(field) => write!(f, "Missing required field: {}", field),
            OpenApiError::InvalidVersion(version) => {
                write!(f, "Invalid OpenAPI version: {}", version)
            }
            OpenApiError::ParseError(msg) => write!(f, "Parse error: {}", msg),
        }
    }
}

impl std::error::Error for OpenApiError {}

/// Result type alias for OpenAPI parsing operations
pub type OpenApiResult<T> = std::result::Result<T, OpenApiError>;

// ============================================
// DATA STRUCTURES
// ============================================

/// Represents a documented API endpoint from an OpenAPI specification
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DocumentedEndpoint {
    /// The API path (e.g., "/users/{id}")
    pub path: String,
    /// HTTP method (GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD)
    pub method: String,
    /// Optional description/summary from the spec
    pub summary: Option<String>,
}

/// Holds parsed OpenAPI specification information
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct OpenApiSpec {
    /// List of all documented endpoints
    pub endpoints: Vec<DocumentedEndpoint>,
    /// API title from info section
    pub title: String,
    /// API version
    pub version: String,
}

impl OpenApiSpec {
    /// Create a new empty OpenApiSpec
    pub fn new(title: String, version: String) -> Self {
        Self {
            endpoints: Vec::new(),
            title,
            version,
        }
    }

    /// Check if a given path and method matches any documented endpoint
    /// Handles path parameters (e.g., `/users/{id}` matches `/users/123`)
    pub fn matches_endpoint(&self, path: &str, method: &str) -> bool {
        let normalized_method = method.to_uppercase();
        self.endpoints.iter().any(|endpoint| {
            endpoint.method == normalized_method && paths_match(&endpoint.path, path)
        })
    }

    /// Find all endpoints that match a given path (regardless of method)
    pub fn find_endpoints_by_path(&self, path: &str) -> Vec<&DocumentedEndpoint> {
        self.endpoints
            .iter()
            .filter(|endpoint| paths_match(&endpoint.path, path))
            .collect()
    }

    /// Find endpoint by exact path and method
    pub fn find_endpoint(&self, path: &str, method: &str) -> Option<&DocumentedEndpoint> {
        let normalized_method = method.to_uppercase();
        self.endpoints.iter().find(|endpoint| {
            endpoint.method == normalized_method && paths_match(&endpoint.path, path)
        })
    }
}

// ============================================
// INTERNAL DESERIALIZATION STRUCTURES
// ============================================

/// Root structure for OpenAPI 3.x specification
#[derive(Debug, Deserialize)]
struct OpenApiRoot {
    openapi: Option<String>,
    swagger: Option<String>, // For Swagger 2.x detection
    info: Option<Info>,
    paths: Option<HashMap<String, PathItem>>,
}

/// Info section of OpenAPI spec
#[derive(Debug, Deserialize)]
struct Info {
    title: Option<String>,
    version: Option<String>,
}

/// Path item containing HTTP methods
#[derive(Debug, Deserialize)]
struct PathItem {
    get: Option<Operation>,
    post: Option<Operation>,
    put: Option<Operation>,
    delete: Option<Operation>,
    patch: Option<Operation>,
    options: Option<Operation>,
    head: Option<Operation>,
    trace: Option<Operation>,
}

/// Operation details for an HTTP method
#[derive(Debug, Deserialize)]
struct Operation {
    summary: Option<String>,
    description: Option<String>,
    #[allow(dead_code)]
    operation_id: Option<String>,
    #[allow(dead_code)]
    tags: Option<Vec<String>>,
}

// ============================================
// PARSING FUNCTIONS
// ============================================

/// Parse an OpenAPI specification from JSON content
///
/// # Arguments
/// * `content` - JSON string containing the OpenAPI specification
///
/// # Returns
/// * `OpenApiResult<OpenApiSpec>` - Parsed specification or error
///
/// # Example
/// ```rust,no_run
/// use tauri_appapex_security_auditor_lib::utils::openapi_parser::parse_openapi_json;
/// let json = r#"{
///     "openapi": "3.0.0",
///     "info": { "title": "My API", "version": "1.0.0" },
///     "paths": {
///         "/users": {
///             "get": { "summary": "List users" }
///         }
///     }
/// }"#;
/// let spec = parse_openapi_json(json).unwrap();
/// assert_eq!(spec.title, "My API");
/// ```
pub fn parse_openapi_json(content: &str) -> OpenApiResult<OpenApiSpec> {
    let root: OpenApiRoot =
        serde_json::from_str(content).map_err(|e| OpenApiError::InvalidJson(e.to_string()))?;

    validate_and_parse_root(root)
}

/// Parse an OpenAPI specification from YAML content
///
/// # Arguments
/// * `content` - YAML string containing the OpenAPI specification
///
/// # Returns
/// * `OpenApiResult<OpenApiSpec>` - Parsed specification or error
///
/// # Example
/// ```rust,no_run
/// use tauri_appapex_security_auditor_lib::utils::openapi_parser::parse_openapi_yaml;
/// let yaml = r#"
/// openapi: "3.0.0"
/// info:
///   title: "My API"
///   version: "1.0.0"
/// paths:
///   /users:
///     get:
///       summary: "List users"
/// "#;
/// let spec = parse_openapi_yaml(yaml).unwrap();
/// assert_eq!(spec.title, "My API");
/// ```
pub fn parse_openapi_yaml(content: &str) -> OpenApiResult<OpenApiSpec> {
    let root: OpenApiRoot =
        serde_yaml::from_str(content).map_err(|e| OpenApiError::InvalidYaml(e.to_string()))?;

    validate_and_parse_root(root)
}

/// Auto-detect format (JSON or YAML) and parse the OpenAPI specification
///
/// This function attempts to parse the content as JSON first, then falls back to YAML.
///
/// # Arguments
/// * `content` - String containing the OpenAPI specification (JSON or YAML)
///
/// # Returns
/// * `OpenApiResult<OpenApiSpec>` - Parsed specification or error
pub fn parse_openapi_auto(content: &str) -> OpenApiResult<OpenApiSpec> {
    let trimmed = content.trim();

    // Try JSON first (starts with '{')
    if trimmed.starts_with('{') {
        match parse_openapi_json(content) {
            Ok(spec) => return Ok(spec),
            Err(OpenApiError::InvalidJson(_)) => {
                // Fall through to YAML attempt
            }
            Err(e) => return Err(e),
        }
    }

    // Try YAML
    parse_openapi_yaml(content)
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/// Validate the OpenAPI root and extract endpoints
fn validate_and_parse_root(root: OpenApiRoot) -> OpenApiResult<OpenApiSpec> {
    // Check version
    if let Some(ref swagger) = root.swagger {
        return Err(OpenApiError::InvalidVersion(format!(
            "Swagger 2.x ({}) is not supported. Please convert to OpenAPI 3.x format.",
            swagger
        )));
    }

    let openapi_version = root
        .openapi
        .as_ref()
        .ok_or_else(|| OpenApiError::MissingField("openapi version field".to_string()))?;

    // Validate OpenAPI version (3.0.x or 3.1.x)
    if !openapi_version.starts_with("3.") {
        return Err(OpenApiError::InvalidVersion(format!(
            "Expected OpenAPI 3.x, got {}",
            openapi_version
        )));
    }

    // Extract info
    let info = root.info.as_ref();
    let title = info
        .and_then(|i| i.title.clone())
        .unwrap_or_else(|| "Unknown API".to_string());
    let version = info
        .and_then(|i| i.version.clone())
        .unwrap_or_else(|| "Unknown".to_string());

    // Extract endpoints from paths
    let mut endpoints = Vec::new();

    if let Some(paths) = root.paths {
        for (path, path_item) in paths.iter() {
            extract_endpoints_from_path(path, path_item, &mut endpoints);
        }
    }

    Ok(OpenApiSpec {
        endpoints,
        title,
        version,
    })
}

/// Extract all endpoints from a path item
fn extract_endpoints_from_path(
    path: &str,
    path_item: &PathItem,
    endpoints: &mut Vec<DocumentedEndpoint>,
) {
    let methods = [
        ("GET", &path_item.get),
        ("POST", &path_item.post),
        ("PUT", &path_item.put),
        ("DELETE", &path_item.delete),
        ("PATCH", &path_item.patch),
        ("OPTIONS", &path_item.options),
        ("HEAD", &path_item.head),
        ("TRACE", &path_item.trace),
    ];

    for (method, operation) in methods.iter() {
        if let Some(op) = operation {
            let summary = op.summary.clone().or(op.description.clone());
            endpoints.push(DocumentedEndpoint {
                path: path.to_string(),
                method: method.to_string(),
                summary,
            });
        }
    }
}

/// Check if a documented path pattern matches an actual request path
///
/// Handles OpenAPI path parameters like `{id}`, `{name}`, etc.
///
/// # Examples
/// ```
/// use tauri_appapex_security_auditor_lib::utils::openapi_parser::paths_match;
/// assert!(paths_match("/users/{id}", "/users/123"));
/// assert!(paths_match("/users/{id}/posts/{postId}", "/users/456/posts/789"));
/// assert!(!paths_match("/users/{id}", "/posts/123"));
/// ```
pub fn paths_match(pattern: &str, actual: &str) -> bool {
    let pattern_parts: Vec<&str> = pattern.split('/').collect();
    let actual_parts: Vec<&str> = actual.split('/').collect();

    if pattern_parts.len() != actual_parts.len() {
        return false;
    }

    for (p, a) in pattern_parts.iter().zip(actual_parts.iter()) {
        // Check if this is a path parameter (e.g., {id}, {name})
        if p.starts_with('{') && p.ends_with('}') {
            // Path parameter matches any non-empty value
            if a.is_empty() {
                return false;
            }
        } else if p != a {
            // Literal path segment must match exactly
            return false;
        }
    }

    true
}

/// Convert a path pattern to a regex string for more complex matching
///
/// This is useful when you need regex-based matching instead of simple pattern matching.
pub fn path_pattern_to_regex(pattern: &str) -> String {
    let mut regex = String::from("^");
    let parts: Vec<&str> = pattern.split('/').collect();

    for (i, part) in parts.iter().enumerate() {
        if i > 0 {
            regex.push('/');
        }
        if part.starts_with('{') && part.ends_with('}') {
            // Match any non-slash characters for path parameters
            regex.push_str("[^/]+");
        } else {
            // Escape special regex characters in literal parts
            for c in part.chars() {
                match c {
                    '.' | '^' | '$' | '*' | '+' | '?' | '(' | ')' | '[' | ']' | '{' | '}'
                    | '\\' => {
                        regex.push('\\');
                        regex.push(c);
                    }
                    _ => regex.push(c),
                }
            }
        }
    }

    regex.push('$');
    regex
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_openapi_json() {
        let json = r#"{
            "openapi": "3.0.0",
            "info": {
                "title": "Test API",
                "version": "1.0.0"
            },
            "paths": {
                "/users": {
                    "get": {
                        "summary": "List all users"
                    },
                    "post": {
                        "summary": "Create a user"
                    }
                },
                "/users/{id}": {
                    "get": {
                        "summary": "Get user by ID"
                    },
                    "delete": {
                        "summary": "Delete user"
                    }
                }
            }
        }"#;

        let spec = parse_openapi_json(json).unwrap();
        assert_eq!(spec.title, "Test API");
        assert_eq!(spec.version, "1.0.0");
        assert_eq!(spec.endpoints.len(), 4);

        // Check endpoints
        assert!(spec
            .endpoints
            .iter()
            .any(|e| e.path == "/users" && e.method == "GET"));
        assert!(spec
            .endpoints
            .iter()
            .any(|e| e.path == "/users" && e.method == "POST"));
        assert!(spec
            .endpoints
            .iter()
            .any(|e| e.path == "/users/{id}" && e.method == "GET"));
        assert!(spec
            .endpoints
            .iter()
            .any(|e| e.path == "/users/{id}" && e.method == "DELETE"));
    }

    #[test]
    fn test_parse_openapi_yaml() {
        let yaml = r#"
openapi: "3.0.0"
info:
  title: "Test API YAML"
  version: "2.0.0"
paths:
  /products:
    get:
      summary: "List products"
    post:
      summary: "Create product"
  /products/{id}:
    get:
      summary: "Get product"
"#;

        let spec = parse_openapi_yaml(yaml).unwrap();
        assert_eq!(spec.title, "Test API YAML");
        assert_eq!(spec.version, "2.0.0");
        assert_eq!(spec.endpoints.len(), 3);
    }

    #[test]
    fn test_parse_openapi_auto_detects_json() {
        let json =
            r#"{"openapi": "3.0.0", "info": {"title": "Auto API", "version": "1.0"}, "paths": {}}"#;
        let spec = parse_openapi_auto(json).unwrap();
        assert_eq!(spec.title, "Auto API");
    }

    #[test]
    fn test_parse_openapi_auto_detects_yaml() {
        let yaml = r#"
openapi: "3.1.0"
info:
  title: "Auto YAML API"
  version: "1.0"
paths: {}
"#;
        let spec = parse_openapi_auto(yaml).unwrap();
        assert_eq!(spec.title, "Auto YAML API");
    }

    #[test]
    fn test_paths_match() {
        // Exact match
        assert!(paths_match("/users", "/users"));
        assert!(paths_match("/users/list", "/users/list"));

        // Path parameter match
        assert!(paths_match("/users/{id}", "/users/123"));
        assert!(paths_match("/users/{id}", "/users/abc-xyz"));
        assert!(paths_match(
            "/users/{id}/posts/{postId}",
            "/users/123/posts/456"
        ));

        // No match
        assert!(!paths_match("/users", "/posts"));
        assert!(!paths_match("/users/{id}", "/posts/123"));
        assert!(!paths_match("/users/{id}", "/users")); // Different segment count
        assert!(!paths_match("/users/{id}", "/users/123/extra")); // Different segment count
    }

    #[test]
    fn test_matches_endpoint() {
        let spec = OpenApiSpec {
            endpoints: vec![
                DocumentedEndpoint {
                    path: "/users".to_string(),
                    method: "GET".to_string(),
                    summary: Some("List users".to_string()),
                },
                DocumentedEndpoint {
                    path: "/users/{id}".to_string(),
                    method: "GET".to_string(),
                    summary: Some("Get user".to_string()),
                },
            ],
            title: "Test".to_string(),
            version: "1.0".to_string(),
        };

        assert!(spec.matches_endpoint("/users", "GET"));
        assert!(spec.matches_endpoint("/users/123", "GET"));
        assert!(!spec.matches_endpoint("/users", "POST"));
        assert!(!spec.matches_endpoint("/posts", "GET"));
    }

    #[test]
    fn test_path_pattern_to_regex() {
        let regex = path_pattern_to_regex("/users/{id}");
        assert_eq!(regex, r"^/users/[^/]+$");

        let regex = path_pattern_to_regex("/users/{id}/posts/{postId}");
        assert_eq!(regex, r"^/users/[^/]+/posts/[^/]+$");
    }

    #[test]
    fn test_invalid_json() {
        let result = parse_openapi_json("not valid json");
        assert!(matches!(result, Err(OpenApiError::InvalidJson(_))));
    }

    #[test]
    fn test_invalid_yaml() {
        let result = parse_openapi_yaml("not:\nvalid:\nyaml: [");
        assert!(matches!(result, Err(OpenApiError::InvalidYaml(_))));
    }

    #[test]
    fn test_missing_openapi_version() {
        let json = r#"{"info": {"title": "Test", "version": "1.0"}, "paths": {}}"#;
        let result = parse_openapi_json(json);
        assert!(matches!(result, Err(OpenApiError::MissingField(_))));
    }

    #[test]
    fn test_swagger_2_rejected() {
        let json =
            r#"{"swagger": "2.0", "info": {"title": "Test", "version": "1.0"}, "paths": {}}"#;
        let result = parse_openapi_json(json);
        assert!(matches!(result, Err(OpenApiError::InvalidVersion(_))));
    }

    #[test]
    fn test_openapi_31_supported() {
        let json =
            r#"{"openapi": "3.1.0", "info": {"title": "Test", "version": "1.0"}, "paths": {}}"#;
        let spec = parse_openapi_json(json).unwrap();
        assert_eq!(spec.title, "Test");
    }

    #[test]
    fn test_missing_info_defaults() {
        let json = r#"{"openapi": "3.0.0", "paths": {}}"#;
        let spec = parse_openapi_json(json).unwrap();
        assert_eq!(spec.title, "Unknown API");
        assert_eq!(spec.version, "Unknown");
    }

    #[test]
    fn test_all_http_methods() {
        let json = r#"{
            "openapi": "3.0.0",
            "info": {"title": "Test", "version": "1.0"},
            "paths": {
                "/test": {
                    "get": {},
                    "post": {},
                    "put": {},
                    "delete": {},
                    "patch": {},
                    "options": {},
                    "head": {},
                    "trace": {}
                }
            }
        }"#;

        let spec = parse_openapi_json(json).unwrap();
        assert_eq!(spec.endpoints.len(), 8);

        let methods: Vec<&str> = spec.endpoints.iter().map(|e| e.method.as_str()).collect();
        assert!(methods.contains(&"GET"));
        assert!(methods.contains(&"POST"));
        assert!(methods.contains(&"PUT"));
        assert!(methods.contains(&"DELETE"));
        assert!(methods.contains(&"PATCH"));
        assert!(methods.contains(&"OPTIONS"));
        assert!(methods.contains(&"HEAD"));
        assert!(methods.contains(&"TRACE"));
    }
}
