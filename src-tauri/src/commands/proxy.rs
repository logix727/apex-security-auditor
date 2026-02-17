use crate::db::SqliteDatabase;
use crate::services::proxy::{InterceptAction, ProxyService};
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub async fn start_proxy_service(
    app_handle: tauri::AppHandle,
    proxy: State<'_, ProxyService>,
    db: State<'_, SqliteDatabase>,
) -> Result<(), String> {
    proxy.start(app_handle, Arc::new(db.inner().clone())).await
}

#[tauri::command]
pub fn stop_proxy_service(proxy: State<'_, ProxyService>) {
    proxy.stop();
}

#[tauri::command]
pub fn get_proxy_status(proxy: State<'_, ProxyService>) -> bool {
    proxy.is_running.load(std::sync::atomic::Ordering::SeqCst)
}

#[tauri::command]
pub fn set_proxy_intercept(proxy: State<'_, ProxyService>, enabled: bool) {
    proxy.set_intercept(enabled);
}

#[tauri::command]
pub async fn forward_intercepted_request(
    proxy: State<'_, ProxyService>,
    request_id: String,
    headers: Vec<(String, String)>,
    body: String,
) -> Result<(), String> {
    let mut pending = proxy.pending_requests.lock().await;
    if let Some(tx) = pending.remove(&request_id) {
        let _ = tx.send(InterceptAction::Forward {
            headers,
            body: body.into_bytes(),
        });
        Ok(())
    } else {
        Err("Request ID not found or already processed".to_string())
    }
}

#[tauri::command]
pub async fn drop_intercepted_request(
    proxy: State<'_, ProxyService>,
    request_id: String,
) -> Result<(), String> {
    let mut pending = proxy.pending_requests.lock().await;
    if let Some(tx) = pending.remove(&request_id) {
        let _ = tx.send(InterceptAction::Drop);
        Ok(())
    } else {
        Err("Request ID not found or already processed".to_string())
    }
}
