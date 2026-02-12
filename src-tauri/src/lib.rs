use serde::{Deserialize, Serialize};
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

mod data;
pub use data::{Badge, Severity};

mod db;
use db::{Asset, Database, Folder};

mod detectors;
use detectors::classify_vulnerability;

mod scanner;
use scanner::scan_url;

mod ui;

mod ai;

mod openapi_parser;
pub use openapi_parser::*;

// ============================================
// SHADOW API DETECTION DATA STRUCTURES
// ============================================

/// Report generated after comparing assets against an OpenAPI spec
#[derive(Serialize, Clone)]
pub struct ShadowApiReport {
    /// Title from the OpenAPI spec
    pub spec_title: String,
    /// Version from the OpenAPI spec
    pub spec_version: String,
    /// Total number of endpoints in the spec
    pub total_endpoints: usize,
    /// Total number of assets checked
    pub total_assets_checked: usize,
    /// Number of assets that match documented endpoints
    pub documented_count: usize,
    /// Number of Shadow APIs detected
    pub shadow_api_count: usize,
    /// List of Shadow API assets
    pub shadow_apis: Vec<ShadowApiAsset>,
}

/// A single Shadow API asset
#[derive(Serialize, Clone)]
pub struct ShadowApiAsset {
    /// Asset ID
    pub id: i64,
    /// Full URL of the asset
    pub url: String,
    /// HTTP method
    pub method: String,
    /// Risk level (always "Medium" for Shadow APIs)
    pub risk_level: String,
}

// ============================================
// DEBUG LOGGING INFRASTRUCTURE
// ============================================

/// Log levels for debug console
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
    Info,
    Warn,
    Error,
    Success,
}

/// Debug log entry sent to frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DebugLogEntry {
    pub id: String,
    pub timestamp: String,
    pub level: LogLevel,
    pub source: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

/// Generate a unique log ID
fn generate_log_id() -> String {
    format!(
        "log_{}_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis())
            .unwrap_or(0),
        rand::random::<u32>()
    )
}

/// Emit a debug log event to the frontend
pub fn emit_log(
    app: &AppHandle,
    level: LogLevel,
    source: &str,
    message: &str,
    details: Option<serde_json::Value>,
) {
    let entry = DebugLogEntry {
        id: generate_log_id(),
        timestamp: chrono::Utc::now().to_rfc3339(),
        level,
        source: source.to_string(),
        message: message.to_string(),
        details,
    };

    // Also print to backend console for debugging
    match entry.level {
        LogLevel::Info => println!("[INFO] [{}] {}", source, message),
        LogLevel::Warn => eprintln!("[WARN] [{}] {}", source, message),
        LogLevel::Error => eprintln!("[ERROR] [{}] {}", source, message),
        LogLevel::Success => println!("[SUCCESS] [{}] {}", source, message),
    }

    if let Err(e) = app.emit("debug-log", &entry) {
        eprintln!("Failed to emit debug log: {}", e);
    }
}

/// Tauri command for frontend to emit debug logs
#[tauri::command]
fn log_debug(
    app: AppHandle,
    level: String,
    source: String,
    message: String,
    details: Option<serde_json::Value>,
) -> Result<(), String> {
    let log_level = match level.to_lowercase().as_str() {
        "info" => LogLevel::Info,
        "warn" => LogLevel::Warn,
        "error" => LogLevel::Error,
        "success" => LogLevel::Success,
        _ => LogLevel::Info,
    };

    emit_log(&app, log_level, &source, &message, details);
    Ok(())
}

// ============================================
// OPENAPI PARSING & SHADOW API DETECTION
// ============================================

/// Extract the path portion from a full URL
/// Handles URLs like `https://api.example.com/users/123?foo=bar` → `/users/123`
fn extract_path_from_url(url: &str) -> String {
    // Try to parse as a full URL
    if let Ok(parsed) = url::Url::parse(url) {
        let path = parsed.path();
        return path.to_string();
    }
    
    // Fallback: manual extraction for malformed URLs
    // Remove protocol if present
    let without_protocol = url
        .strip_prefix("https://")
        .or_else(|| url.strip_prefix("http://"))
        .unwrap_or(url);
    
    // Find the start of the path (after the first '/')
    if let Some(slash_pos) = without_protocol.find('/') {
        let path_and_query = &without_protocol[slash_pos..];
        // Remove query string if present
        if let Some(query_pos) = path_and_query.find('?') {
            path_and_query[..query_pos].to_string()
        } else {
            path_and_query.to_string()
        }
    } else {
        // No path found, return root
        "/".to_string()
    }
}

/// Parse an OpenAPI specification (auto-detects JSON/YAML)
/// Returns the parsed OpenApiSpec with all documented endpoints
#[tauri::command]
fn parse_openapi_spec(content: String) -> Result<OpenApiSpec, String> {
    parse_openapi_auto(&content).map_err(|e| e.to_string())
}

/// Import an OpenAPI spec and detect Shadow APIs
/// Compares all assets in the database against the spec
/// Marks assets not in the spec as Shadow APIs (sets is_documented = false)
#[tauri::command]
async fn import_openapi_spec_and_detect_shadow_apis(
    app: AppHandle,
    content: String,
) -> Result<ShadowApiReport, String> {
    // Parse the OpenAPI spec
    let spec = parse_openapi_auto(&content).map_err(|e| e.to_string())?;
    
    println!(
        "OpenAPI Spec parsed: {} v{} with {} endpoints",
        spec.title,
        spec.version,
        spec.endpoints.len()
    );
    
    // Get all assets from the database
    let db = app.state::<Database>();
    let assets = db.get_assets().map_err(|e| e.to_string())?;
    
    let total_assets = assets.len();
    let mut shadow_api_ids = Vec::new();
    let mut shadow_apis = Vec::new();
    let mut documented_count = 0;
    
    for asset in &assets {
        // Extract the path from the asset URL
        let path = extract_path_from_url(&asset.url);
        
        // Check if this asset matches any documented endpoint
        let is_documented = spec.matches_endpoint(&path, &asset.method);
        
        if is_documented {
            documented_count += 1;
        } else {
            // This is a Shadow API
            shadow_api_ids.push(asset.id);
            shadow_apis.push(ShadowApiAsset {
                id: asset.id,
                url: asset.url.clone(),
                method: asset.method.clone(),
                risk_level: "Medium".to_string(),
            });
        }
    }
    
    // Mark Shadow APIs in the database
    if !shadow_api_ids.is_empty() {
        db.batch_mark_shadow_apis(&shadow_api_ids)
            .map_err(|e| e.to_string())?;
        
        println!(
            "Marked {} assets as Shadow APIs",
            shadow_api_ids.len()
        );
    }
    
    let shadow_count = shadow_apis.len();
    
    Ok(ShadowApiReport {
        spec_title: spec.title,
        spec_version: spec.version,
        total_endpoints: spec.endpoints.len(),
        total_assets_checked: total_assets,
        documented_count,
        shadow_api_count: shadow_count,
        shadow_apis,
    })
}

// ============================================
// ASSET MANAGEMENT COMMANDS
// ============================================

// Command: Import Assets
// Takes raw text, extracts URLs, saves to DB, and triggers background scan.
#[tauri::command]
async fn import_assets(app: AppHandle, content: String) -> Result<Vec<i64>, String> {
    println!(
        "Importing assets using strict line parser (content length: {})",
        content.len()
    );
    let db = app.state::<Database>();

    let mut ids = Vec::new();
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        // Extremely aggressive splitting to isolate the URL from any CSV/metadata
        // We take the first part when splitting by common delimiters, and trim again.
        let raw_url = trimmed
            .split(|c| c == ',' || c == ';' || c == '\t' || c == ' ' || c == '|')
            .next()
            .unwrap_or("")
            .trim();

        if raw_url.is_empty() {
            continue;
        }

        let mut url = raw_url.to_string();

        // Strict Validation: If it doesn't look like a URL or starts with http, discard or fix
        if !url.to_lowercase().starts_with("http") && !url.contains('.') {
            continue;
        }

        // Ensure protocol
        if !url.starts_with("http://") && !url.starts_with("https://") {
            url = format!("https://{}", url);
        }

        // Insert into DB and trigger immediate scan
        match db.add_asset(&url) {
            Ok(id) => {
                ids.push(id);
                let app_handle = app.clone();
                let url_clone = url.clone();

                tauri::async_runtime::spawn(async move {
                    let db_state = app_handle.state::<Database>();
                    let result = scan_url(&db_state.client, &url_clone, "GET").await;
                    let _ = db_state.update_scan_result(
                        id,
                        &result.status,
                        result.status_code,
                        result.risk_score,
                        result.findings,
                        &result.response_headers,
                        &result.response_body,
                        &result.request_headers,
                        &result.request_body,
                    );
                    let _ = app_handle.emit("scan-update", id);
                });
            }
            Err(e) => eprintln!("Failed to add asset {}: {}", url, e),
        }
    }

    println!(
        "Import completed. {} assets processing immediately.",
        ids.len()
    );
    Ok(ids)
}

// Command: Get All Assets
#[tauri::command]
fn get_assets(state: tauri::State<Database>) -> Result<Vec<Asset>, String> {
    state.get_assets().map_err(|e| e.to_string())
}

#[tauri::command]
async fn get_asset_history(
    state: tauri::State<'_, Database>,
    asset_id: i64,
) -> Result<Vec<db::ScanHistoryEntry>, String> {
    state.get_asset_history(asset_id).map_err(|e| e.to_string())
}

#[tauri::command]
async fn generate_audit_report(state: tauri::State<'_, Database>) -> Result<String, String> {
    let suspects = state.get_suspect_assets().map_err(|e| e.to_string())?;

    if suspects.is_empty() {
        return Ok("# No Findings to Report\n\nMark assets as 'Suspect' or run full scans to generate a report.".to_string());
    }

    let mut report = String::from("# APEX API Security Audit Report\n\n");
    report.push_str(&format!(
        "*Generated on: {}*\n\n",
        chrono::Local::now().format("%Y-%m-%d %H:%M:%S")
    ));

    for asset in suspects {
        report.push_str(&format!("## 🔍 Asset: {}\n", asset.url));
        report.push_str(&format!("**Method:** {}\n", asset.method));
        report.push_str(&format!("**Risk Score:** {}\n", asset.risk_score));
        report.push_str(&format!("**Triage Status:** {}\n\n", asset.triage_status));

        if !asset.findings.is_empty() {
            report.push_str("### 🚨 Findings\n");
            for finding in asset.findings {
                report.push_str(&format!(
                    "- **{}**: {}\n",
                    finding.short, finding.description
                ));
            }
            report.push_str("\n");
        }

        if !asset.notes.is_empty() {
            report.push_str("### 📝 Auditor Notes\n");
            report.push_str(&format!("{}\n\n", asset.notes));
        }

        report.push_str("### 🔗 Request Details\n");
        report.push_str("```http\n");
        report.push_str(&asset.request_headers);
        report.push_str("\n\n");
        report.push_str(&asset.request_body);
        report.push_str("\n```\n\n");

        report.push_str("---\n\n");
    }

    Ok(report)
}

#[tauri::command]
async fn export_to_csv_final_v5(state: tauri::State<'_, Database>) -> Result<String, String> {
    let suspects = state.get_suspect_assets().map_err(|e| e.to_string())?;

    let mut csv = String::from("URL,Method,Status,Risk Score,FindingsCount,Triage Status,Notes\n");
    for asset in suspects {
        let findings_count = asset.findings.len();
        let safe_url = asset.url.replace(',', ";");
        let safe_notes = asset.notes.replace(',', ";").replace('\n', " ");

        csv.push_str(&format!(
            "{},{},{},{},{},{},{}\n",
            safe_url,
            asset.method,
            asset.status,
            asset.risk_score,
            findings_count,
            asset.triage_status,
            safe_notes
        ));
    }

    Ok(csv)
}

// Command: Delete Asset
#[tauri::command]
fn delete_asset(state: tauri::State<Database>, id: i64) -> Result<(), String> {
    state.delete_asset(id).map_err(|e| e.to_string())
}

// Command: Clear All Assets
#[tauri::command]
fn clear_database(state: tauri::State<Database>) -> Result<(), String> {
    state.clear_all_assets().map_err(|e| e.to_string())
}

// Command: Sanitize URLs
#[tauri::command]
fn sanitize_database(state: tauri::State<Database>) -> Result<usize, String> {
    state.sanitize_urls().map_err(|e| e.to_string())
}

// Command: Folders API
#[tauri::command]
fn get_folders(state: tauri::State<Database>) -> Result<Vec<Folder>, String> {
    state.get_folders().map_err(|e| e.to_string())
}

#[tauri::command]
fn add_folder(
    state: tauri::State<Database>,
    name: String,
    parent_id: Option<i64>,
) -> Result<i64, String> {
    state
        .add_folder(&name, parent_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn move_assets_to_folder(
    state: tauri::State<Database>,
    ids: Vec<i64>,
    folder_id: i64,
) -> Result<(), String> {
    state
        .move_assets_to_folder(ids, folder_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_folder(state: tauri::State<Database>, id: i64) -> Result<(), String> {
    state.delete_folder(id).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_vulnerability_badge(finding_code: String) -> Option<db::Badge> {
    classify_vulnerability(&finding_code)
}

// Command: Re-Scan Asset
#[tauri::command]
async fn rescan_asset(app: AppHandle, id: i64) -> Result<(), String> {
    let db = app.state::<Database>();
    let assets = db.get_assets().map_err(|e| e.to_string())?;
    if let Some(asset) = assets.iter().find(|a| a.id == id) {
        let url = asset.url.clone();
        let method = asset.method.clone();
        let app_handle = app.clone();

        tauri::async_runtime::spawn(async move {
            let db_state = app_handle.state::<Database>();
            let result = scan_url(&db_state.client, &url, &method).await;
            let _ = db_state.update_scan_result(
                id,
                &result.status,
                result.status_code,
                result.risk_score,
                result.findings,
                &result.response_headers,
                &result.response_body,
                &result.request_headers,
                &result.request_body,
            );
            let _ = app_handle.emit("scan-update", id);
        });
    }
    Ok(())
}

#[tauri::command]
fn update_asset_triage(
    state: tauri::State<Database>,
    id: i64,
    triage_status: String,
    notes: String,
) -> Result<(), String> {
    state
        .update_asset_triage(id, &triage_status, &notes)
        .map_err(|e| e.to_string())
}

fn start_background_monitor(app_handle: AppHandle) {
    tauri::async_runtime::spawn(async move {
        println!("Background Monitor: Initializing specialized security loop...");
        loop {
            // Check every 10 seconds for more responsive queue processing
            tokio::time::sleep(Duration::from_secs(10)).await;

            let db = app_handle.state::<Database>();
            // Fetch up to 10 stale/pending assets
            match db.get_stale_assets(10, 5) {
                Ok(stale_assets) => {
                    if !stale_assets.is_empty() {
                        println!(
                            "Background Monitor: Processing {} assets.",
                            stale_assets.len()
                        );
                    }
                    for asset in stale_assets {
                        let id = asset.id;
                        let url = asset.url.clone();
                        let method = asset.method.clone();
                        let handle = app_handle.clone();

                        tauri::async_runtime::spawn(async move {
                            let db_state = handle.state::<Database>();
                            let result = scan_url(&db_state.client, &url, &method).await;
                            let _ = db_state.update_scan_result(
                                id,
                                &result.status,
                                result.status_code,
                                result.risk_score,
                                result.findings,
                                &result.response_headers,
                                &result.response_body,
                                &result.request_headers,
                                &result.request_body,
                            );
                            let _ = handle.emit("scan-update", id);
                        });
                    }
                }
                Err(e) => eprintln!(
                    "Background Monitor Error: Failed to fetch stale assets: {}",
                    e
                ),
            }
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let db = Database::new("apex.db").expect("Failed to initialize database");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(db) // Manage state
        .setup(|app| {
            let window = app.get_webview_window("main").expect(
                "Failed to get main window - application may not have initialized properly",
            );
            let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize {
                width: 1280.0,
                height: 800.0,
            }));
            start_background_monitor(app.handle().clone());
            ai::auto_initialize_ai(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            import_assets,
            get_assets,
            get_asset_history,
            generate_audit_report,
            export_to_csv_final_v5,
            delete_asset,
            rescan_asset,
            clear_database,
            get_folders,
            add_folder,
            move_assets_to_folder,
            delete_folder,
            get_vulnerability_badge,
            sanitize_database,
            ai::analyze_logic_flaws,
            ui::inspector::sign_jwt,
            ui::inspector::decode_jwt,
            ui::inspector::generate_curl,
            update_asset_triage,
            ai::analyze_finding,
            ai::analyze_asset_summary,
            ai::get_llm_config,
            ai::update_llm_config,
            ai::check_local_model_status,
            ai::pull_local_model,
            log_debug,
            parse_openapi_spec,
            import_openapi_spec_and_detect_shadow_apis
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
