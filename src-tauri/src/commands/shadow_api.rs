use crate::db::SqliteDatabase;
use crate::OpenApiSpec;
use serde::Serialize;
use tauri::{AppHandle, Manager};

#[derive(Serialize, Clone)]
pub struct ShadowApiReport {
    pub spec_title: String,
    pub spec_version: String,
    pub total_endpoints: usize,
    pub total_assets_checked: usize,
    pub documented_count: usize,
    pub shadow_api_count: usize,
    pub shadow_apis: Vec<ShadowApiAsset>,
}

#[derive(Serialize, Clone)]
pub struct ShadowApiAsset {
    pub id: i64,
    pub url: String,
    pub method: String,
    pub risk_level: String,
}

pub fn extract_path_from_url(url: &str) -> String {
    if let Ok(u) = url::Url::parse(url) {
        return u.path().to_string();
    }
    // Fallback for malformed URLs
    let parts: Vec<&str> = url.split('/').collect();
    if parts.len() > 3 {
        format!("/{}", parts[3..].join("/"))
    } else {
        "/".to_string()
    }
}

pub fn parse_openapi_spec(content: String) -> Result<OpenApiSpec, String> {
    // Try JSON first
    if let Ok(spec) = serde_json::from_str(&content) {
        return Ok(spec);
    }
    // Try YAML
    serde_yaml::from_str(&content)
        .map_err(|e| format!("Failed to parse OpenAPI spec (JSON/YAML): {}", e))
}

#[tauri::command]
pub async fn import_openapi_spec_and_detect_shadow_apis(
    app: AppHandle,
    content: String,
) -> Result<ShadowApiReport, String> {
    let spec = parse_openapi_spec(content)?;
    let spec_path_map = spec.get_paths();

    let db = app.state::<SqliteDatabase>();
    let assets: Vec<crate::db::Asset> = db.get_assets().map_err(|e| e.to_string())?;

    let mut shadow_apis = Vec::new();
    let mut documented_count = 0;

    for asset in &assets {
        let path = extract_path_from_url(&asset.url);
        let method = asset.method.to_uppercase();

        let is_documented = spec_path_map
            .get(&path)
            .map(|methods| methods.contains(&method))
            .unwrap_or(false);

        if is_documented {
            documented_count += 1;
            let _ = db.update_asset_documentation(asset.id, true);
        } else {
            shadow_apis.push(ShadowApiAsset {
                id: asset.id,
                url: asset.url.clone(),
                method: asset.method.clone(),
                risk_level: "High".to_string(), // Default risk for shadow APIs
            });
            let _ = db.update_asset_documentation(asset.id, false);
        }
    }

    let report = ShadowApiReport {
        spec_title: spec.info.title,
        spec_version: spec.info.version,
        total_endpoints: spec_path_map.len(),
        total_assets_checked: assets.len(),
        documented_count,
        shadow_api_count: shadow_apis.len(),
        shadow_apis,
    };

    Ok(report)
}

#[tauri::command]
pub async fn clear_documentation_status(app: AppHandle) -> Result<(), String> {
    let db = app.state::<SqliteDatabase>();
    let assets: Vec<crate::db::Asset> = db.get_assets().map_err(|e| e.to_string())?;

    for asset in assets {
        let _ = db.update_asset_documentation(asset.id, true); // Reset to default true (meaning documented or at least not flag as shadow)
    }

    Ok(())
}

#[tauri::command]
pub async fn import_missing_endpoints(app: AppHandle, content: String) -> Result<usize, String> {
    let spec = parse_openapi_spec(content)?;
    let spec_path_map = spec.get_paths();
    let db = app.state::<SqliteDatabase>();

    let existing_assets: Vec<crate::db::Asset> = db.get_assets().map_err(|e| e.to_string())?;
    let mut existing_urls_methods = std::collections::HashSet::new();

    for asset in existing_assets {
        existing_urls_methods.insert((
            extract_path_from_url(&asset.url),
            asset.method.to_uppercase(),
        ));
    }

    let mut imported_count = 0;
    for (path, methods) in spec_path_map {
        for method in methods {
            if !existing_urls_methods.contains(&(path.clone(), method.clone())) {
                // Construct a placeholder URL if no base URL is available
                // In a real app, we might want the user to provide a base URL
                let url = format!("http://api.local{}", path);
                let _ = db.add_asset(&url, "Import", Some(&method), false);
                // We might need to update the method since add_asset defaults to GET or uses it as a string
                // Let's check db.rs again if we can specify method in add_asset
                imported_count += 1;
            }
        }
    }

    Ok(imported_count)
}
