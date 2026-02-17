use crate::db::SqliteDatabase;
use crate::detectors::classify_vulnerability;
use crate::scan_url;
use tauri::{AppHandle, Emitter, Manager};

#[tauri::command]
pub fn get_vulnerability_badge(finding_code: String) -> Option<crate::db::Badge> {
    classify_vulnerability(&finding_code)
}

#[tauri::command]
pub async fn rescan_asset(app: AppHandle, id: i64) -> Result<(), String> {
    let db = app.state::<SqliteDatabase>();
    let assets = db.get_assets().map_err(|e| e.to_string())?;
    if let Some(asset) = assets.iter().find(|a| a.id == id) {
        let url = asset.url.clone();
        let method = asset.method.clone();
        let app_handle = app.clone();

        tauri::async_runtime::spawn(async move {
            let db_state = app_handle.state::<SqliteDatabase>();
            let result = scan_url(&db_state.client, &url, &method, &db_state.rate_limiter).await;
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
