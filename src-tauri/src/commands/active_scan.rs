use crate::core::active_scanner::{scan_active_target, ActiveScanResult};
use crate::db::SqliteDatabase;
use std::collections::HashMap;
use tauri::{AppHandle, Manager};

#[tauri::command]
pub async fn execute_active_scan(app: AppHandle, id: i64) -> Result<ActiveScanResult, String> {
    let db = app.state::<SqliteDatabase>();
    let assets = db.get_assets().map_err(|e| e.to_string())?;

    // Find asset
    // Note: get_assets is heavy, but acceptable for MVP.
    if let Some(asset) = assets.iter().find(|a| a.id == id) {
        let mut headers = HashMap::new();
        for line in asset.request_headers.lines() {
            if let Some((k, v)) = line.split_once(':') {
                headers.insert(k.trim().to_string(), v.trim().to_string());
            }
        }

        let result = scan_active_target(id, asset.url.clone(), asset.method.clone(), headers).await;
        Ok(result)
    } else {
        Err("Asset not found".to_string())
    }
}
