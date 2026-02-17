use crate::db::SqliteDatabase;
use crate::services::proxy::ProxyService;
use std::sync::Arc;
use tauri::State;

#[tauri::command]
pub async fn start_proxy_service(
    app_handle: tauri::AppHandle,
    proxy: State<'_, ProxyService>,
    db: State<'_, SqliteDatabase>,
) -> Result<(), String> {
    // Database is likely wrapped in something we can't easily turn into Arc if it's already in State
    // But State<Database> is already an Arc-like pointer (tauri::State is Arc<T>)
    // Wait, proxy.start expects Arc<Database>.
    // Actually, I can change proxy.start to take tauri::State<Database> or just &Database.

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
