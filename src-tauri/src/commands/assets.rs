use crate::db::{Asset, ImportOperation, ImportOptions, SqliteDatabase};
use crate::scan_url;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use tauri::{AppHandle, Emitter, Manager};
use tokio::time::{self, Duration};
use uuid::Uuid;

#[tauri::command]
pub async fn import_assets(
    app: AppHandle,
    content: String,
    source: Option<String>,
) -> Result<Vec<i64>, String> {
    let source_label = source.unwrap_or_else(|| "Import".to_string());
    println!(
        "Importing assets from '{}' using strict line parser (content length: {})",
        source_label,
        content.len()
    );
    let db = app.state::<SqliteDatabase>();

    let mut ids = Vec::new();
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        let raw_url = trimmed
            .split(|c| c == ',' || c == ';' || c == '\t' || c == ' ' || c == '|')
            .next()
            .unwrap_or("")
            .trim();

        if raw_url.is_empty() {
            continue;
        }

        let mut url = raw_url.to_string();

        if !url.to_lowercase().starts_with("http") && !url.contains('.') {
            continue;
        }

        if !url.starts_with("http://") && !url.starts_with("https://") {
            url = format!("https://{}", url);
        }

        match db.add_asset(&url, &source_label, None, false) {
            Ok(id) => {
                ids.push(id);
                let app_handle = app.clone();
                let url_clone = url.clone();

                tauri::async_runtime::spawn(async move {
                    let db_state = app_handle.state::<SqliteDatabase>();
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

    Ok(ids)
}

#[tauri::command]
pub fn get_assets(state: tauri::State<SqliteDatabase>) -> Result<Vec<Asset>, String> {
    state.get_assets().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_asset_history(
    state: tauri::State<'_, SqliteDatabase>,
    asset_id: i64,
) -> Result<Vec<crate::db::ScanHistoryEntry>, String> {
    state.get_asset_history(asset_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_asset(state: tauri::State<SqliteDatabase>, id: i64) -> Result<(), String> {
    state.delete_asset(id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn clear_database(state: tauri::State<SqliteDatabase>) -> Result<(), String> {
    state.clear_all_assets().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn sanitize_database(state: tauri::State<SqliteDatabase>) -> Result<usize, String> {
    state.sanitize_urls().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_asset_triage(
    state: tauri::State<SqliteDatabase>,
    id: i64,
    triage_status: String,
    notes: String,
) -> Result<(), String> {
    state
        .update_asset_triage(id, &triage_status, &notes)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_asset_source(
    state: tauri::State<SqliteDatabase>,
    id: i64,
    source: String,
) -> Result<(), String> {
    state
        .update_asset_source(id, &source)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_asset(
    db: tauri::State<SqliteDatabase>,
    url: String,
    source: String,
    method: Option<String>,
    recursive: bool,
) -> Result<i64, String> {
    db.add_asset(&url, &source, method.as_deref(), recursive)
        .map_err(|e| e.to_string())
}

// ============================================================
// Enhanced Import System Commands
// ============================================================

/// Enhanced import with batch processing, rate limiting, and progress tracking
#[tauri::command]
pub async fn enhanced_import_assets(
    app: AppHandle,
    content: String,
    source: Option<String>,
    options: ImportOptions,
) -> Result<String, String> {
    let source_label = source.unwrap_or_else(|| "Enhanced Import".to_string());
    println!(
        "Enhanced importing assets from '{}' with options: destination={}, recursive={}, batch_mode={}, rate_limit={}s",
        source_label,
        options.destination,
        options.recursive,
        options.batch_mode,
        options.rate_limit
    );

    let import_id = Uuid::new_v4().to_string();

    // Analyze content to extract URLs
    let urls = analyze_content_for_import(&content);
    let total_urls = urls.len();

    // Create import operation record
    {
        let db = app.state::<SqliteDatabase>();
        let import_op = ImportOperation {
            id: 0, // Will be set by database
            import_id: import_id.clone(),
            source: source_label.clone(),
            total_assets: total_urls as i32,
            successful_assets: 0,
            failed_assets: 0,
            duplicate_assets: 0,
            status: "running".to_string(),
            options: options.clone(),
            duration_ms: None,
            error_message: None,
            created_at: chrono::Utc::now().to_rfc3339(),
            updated_at: chrono::Utc::now().to_rfc3339(),
        };

        if let Err(e) = db.record_import_operation(import_op) {
            return Err(format!("Failed to create import operation: {}", e));
        }
    }

    let import_id_clone = import_id.clone();
    let source_label_clone = source_label.clone();
    let app_handle = app.clone();

    // Spawn the import processing task
    tauri::async_runtime::spawn(async move {
        let db = app_handle.state::<SqliteDatabase>();
        let start_time = std::time::Instant::now();
        let mut successful = 0i32;
        let mut failed = 0i32;
        let mut duplicates = 0i32;

        for (idx, url) in urls.iter().enumerate() {
            let process_result =
                process_import_asset_sync(&db, url, &source_label_clone, options.recursive).await;

            match process_result {
                Ok(asset_id) => {
                    // Record the import asset
                    let _ = db.record_import_asset(
                        &import_id_clone,
                        asset_id,
                        url,
                        "GET",
                        "success",
                        None,
                        None,
                    );
                    successful += 1;

                    // Emit progress event
                    let _ = app_handle.emit(
                        "import-progress",
                        serde_json::json!({
                            "import_id": import_id_clone,
                            "current": idx + 1,
                            "total": total_urls,
                            "url": url,
                            "status": "success"
                        }),
                    );
                }
                Err(e) if e.contains("Duplicate") => {
                    duplicates += 1;
                    let _ = app_handle.emit(
                        "import-progress",
                        serde_json::json!({
                            "import_id": import_id_clone,
                            "current": idx + 1,
                            "total": total_urls,
                            "url": url,
                            "status": "duplicate"
                        }),
                    );
                }
                Err(e) => {
                    failed += 1;
                    eprintln!("Failed to import asset {}: {}", url, e);
                    let _ = app_handle.emit(
                        "import-progress",
                        serde_json::json!({
                            "import_id": import_id_clone,
                            "current": idx + 1,
                            "total": total_urls,
                            "url": url,
                            "status": "failed",
                            "error": e
                        }),
                    );
                }
            }

            // Apply rate limiting
            if options.rate_limit > 0 {
                time::sleep(Duration::from_millis(options.rate_limit as u64)).await;
            }
        }

        // Update import operation as completed
        let duration_ms = start_time.elapsed().as_millis() as i64;
        let _ = db.update_import_operation(&import_id_clone, "completed", Some(duration_ms), None);

        // Emit completion event
        let _ = app_handle.emit(
            "import-complete",
            serde_json::json!({
                "import_id": import_id_clone,
                "total": total_urls,
                "successful": successful,
                "failed": failed,
                "duplicates": duplicates,
                "duration_ms": duration_ms
            }),
        );
    });

    Ok(import_id)
}

/// Analyze content to extract URLs using regex patterns
fn analyze_content_for_import(content: &str) -> Vec<String> {
    let mut urls = Vec::new();
    let mut seen = HashSet::new();

    // Regex pattern for URL detection - matches http/https URLs
    let url_pattern = r#"https?://[^\s<>"{}|\\^`\[\]]+"#;
    let re = Regex::new(url_pattern).unwrap();

    // Also try to detect URLs without protocol
    let domain_pattern = r#"\b[a-zA-Z0-9][-a-zA-Z0-9]*\.[a-zA-Z]{2,}(?:/[^\s<>"{}|\\^`\[\]]*)?"#;
    let domain_re = Regex::new(domain_pattern).unwrap();

    // Extract full URLs
    for cap in re.find_iter(content) {
        let url = cap.as_str().trim().to_string();
        if !seen.contains(&url) {
            seen.insert(url.clone());
            urls.push(url);
        }
    }

    // Extract domain-only URLs and add https://
    for cap in domain_re.find_iter(content) {
        let domain = cap.as_str().trim();
        // Skip if already captured as full URL
        if domain.starts_with("http://") || domain.starts_with("https://") {
            continue;
        }
        let url = format!("https://{}", domain);
        if !seen.contains(&url) {
            seen.insert(url.clone());
            urls.push(url);
        }
    }

    urls
}

/// Process a single import asset with duplicate detection
async fn process_import_asset_sync(
    db: &tauri::State<'_, SqliteDatabase>,
    url: &str,
    source: &str,
    recursive: bool,
) -> Result<i64, String> {
    // Check for existing asset (duplicate detection)
    let existing_assets = db.get_assets().map_err(|e| e.to_string())?;

    for asset in existing_assets {
        if asset.url == url {
            return Err("Duplicate URL found".to_string());
        }
    }

    // Add the asset
    let asset_id = db
        .add_asset(url, source, None, recursive)
        .map_err(|e| e.to_string())?;

    // Scan the asset
    let result = scan_url(&db.client, url, "GET").await;
    let _ = db.update_scan_result(
        asset_id,
        &result.status,
        result.status_code,
        result.risk_score,
        result.findings,
        &result.response_headers,
        &result.response_body,
        &result.request_headers,
        &result.request_body,
    );

    Ok(asset_id)
}

/// Get the status of an import operation
#[tauri::command]
pub fn get_import_status(
    state: tauri::State<SqliteDatabase>,
    import_id: String,
) -> Result<ImportOperation, String> {
    state
        .get_import_operation(&import_id)
        .map_err(|e| e.to_string())?
        .ok_or_else(|| "Import operation not found".to_string())
}

/// Get import history with pagination
#[tauri::command]
pub fn get_import_history(
    state: tauri::State<SqliteDatabase>,
    limit: Option<usize>,
    offset: Option<usize>,
) -> Result<Vec<ImportOperation>, String> {
    let limit = limit.unwrap_or(50);
    let offset = offset.unwrap_or(0);
    state
        .get_import_history(limit, offset)
        .map_err(|e| e.to_string())
}

/// Reimport assets from a previous import operation
#[tauri::command]
pub async fn reimport_assets(app: AppHandle, import_id: String) -> Result<Vec<i64>, String> {
    let db = app.state::<SqliteDatabase>();

    // Get the assets from the import
    let assets = db
        .get_import_assets(&import_id)
        .map_err(|e| e.to_string())?;

    let mut reimported_ids = Vec::new();

    for asset in assets {
        // Add the asset (will be marked as duplicate if exists)
        let method = if asset.method.is_empty() {
            None
        } else {
            Some(asset.method.as_str())
        };
        match db.add_asset(
            &asset.url,
            &format!("Reimport-{}", import_id),
            method,
            false,
        ) {
            Ok(id) => {
                reimported_ids.push(id);

                // Rescan the asset
                let result = scan_url(&db.client, &asset.url, "GET").await;
                let _ = db.update_scan_result(
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
            }
            Err(e) => eprintln!("Failed to reimport asset {}: {}", asset.url, e),
        }
    }

    Ok(reimported_ids)
}

/// Clear import history
#[tauri::command]
pub fn clear_import_history(state: tauri::State<SqliteDatabase>) -> Result<(), String> {
    state.clear_import_history().map_err(|e| e.to_string())
}

#[derive(Debug, Deserialize)]
pub struct StagedAsset {
    pub url: String,
    pub method: String,
    pub recursive: bool,
    pub source: Option<String>,
}

#[tauri::command]
pub async fn import_staged_assets(
    app: AppHandle,
    assets: Vec<StagedAsset>,
    source: String,
) -> Result<Vec<i64>, String> {
    let db = app.state::<SqliteDatabase>();
    let mut ids = Vec::new();
    let mut errors = Vec::new();

    for asset in assets {
        // Normalize URL
        let mut normalized_url = asset.url.trim().to_string();
        if !normalized_url.starts_with("http://") && !normalized_url.starts_with("https://") {
            if normalized_url.contains('.') {
                normalized_url = format!("https://{}", normalized_url);
            }
        }

        let asset_source = asset.source.as_ref().unwrap_or(&source);
        match db.add_asset(
            &normalized_url,
            asset_source,
            Some(&asset.method),
            asset.recursive,
        ) {
            Ok(id) => {
                ids.push(id);
                let app_handle = app.clone();
                let url_clone = normalized_url.clone();
                let method_clone = asset.method.clone();

                tauri::async_runtime::spawn(async move {
                    let db_state = app_handle.state::<SqliteDatabase>();
                    let result =
                        crate::scanner::scan_url(&db_state.client, &url_clone, &method_clone).await;
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
            Err(e) => {
                let err_msg = format!("Failed to add staged asset {}: {}", asset.url, e);
                eprintln!("{}", err_msg);
                errors.push(err_msg);
            }
        }
    }

    if ids.is_empty() && !errors.is_empty() {
        return Err(format!(
            "Failed to import any assets. Errors: {}",
            errors.join("; ")
        ));
    }

    Ok(ids)
}

#[tauri::command]
pub fn purge_recursive_assets(state: tauri::State<SqliteDatabase>) -> Result<usize, String> {
    state.purge_recursive_assets().map_err(|e| e.to_string())
}

/// Validate a list of URLs
#[tauri::command]
pub fn validate_urls(urls: Vec<String>) -> Result<Vec<UrlValidationResult>, String> {
    let mut results = Vec::new();

    for url in urls {
        let (is_valid, message) = validate_single_url(&url);
        results.push(UrlValidationResult {
            url: url.clone(),
            is_valid,
            message,
        });
    }

    Ok(results)
}

/// Result of URL validation
#[derive(Debug, Serialize, Deserialize)]
pub struct UrlValidationResult {
    pub url: String,
    pub is_valid: bool,
    pub message: String,
}

/// Validate a single URL
fn validate_single_url(url: &str) -> (bool, String) {
    let trimmed = url.trim();
    if trimmed.is_empty() {
        return (false, "Empty URL".to_string());
    }

    // Check for valid protocol
    if trimmed.starts_with("http://") || trimmed.starts_with("https://") {
        // Try to parse as URL
        match url::Url::parse(trimmed) {
            Ok(parsed) => {
                // Check for valid domain
                if parsed.domain().is_some() {
                    (true, "Valid URL".to_string())
                } else {
                    (false, "URL is missing a valid domain".to_string())
                }
            }
            Err(e) => (false, format!("Invalid URL format: {}", e)),
        }
    } else if trimmed.starts_with('/') {
        // Relative path - common in Swagger/API imports
        (true, "Valid path".to_string())
    } else if trimmed.contains('.') {
        // URL without protocol - could be valid
        (true, "URL missing protocol (will use https)".to_string())
    } else {
        (false, "Invalid URL format. Must be a full URL, absolute path (/...), or domain containing a dot.".to_string())
    }
}

#[tauri::command]
pub fn toggle_finding_fp(
    state: tauri::State<SqliteDatabase>,
    asset_id: i64,
    finding_short: String,
    finding_evidence: Option<String>,
    is_fp: bool,
    reason: Option<String>,
) -> Result<(), String> {
    state
        .update_finding_fp(
            asset_id,
            &finding_short,
            finding_evidence.as_deref(),
            is_fp,
            reason.as_deref(),
        )
        .map_err(|e| e.to_string())?;

    // Recalculate risk score after marking FP
    state
        .recalculate_asset_risk_score(asset_id)
        .map_err(|e| e.to_string())?;

    Ok(())
}
