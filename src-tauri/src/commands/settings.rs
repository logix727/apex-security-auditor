use crate::db::SqliteDatabase;
use tauri::State;

#[tauri::command]
pub fn get_setting(state: State<SqliteDatabase>, key: String) -> Result<Option<String>, String> {
    state.inner().get_setting(&key).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_setting(state: State<SqliteDatabase>, key: String, value: String) -> Result<(), String> {
    state
        .inner()
        .set_setting(&key, &value)
        .map_err(|e| e.to_string())
}
