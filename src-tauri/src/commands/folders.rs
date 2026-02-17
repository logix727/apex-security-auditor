use crate::db::{Folder, SqliteDatabase};
use tauri::State;

#[tauri::command]
pub fn get_folders(state: State<SqliteDatabase>) -> Result<Vec<Folder>, String> {
    state.get_folders().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn add_folder(
    state: State<SqliteDatabase>,
    name: String,
    parent_id: Option<i64>,
) -> Result<i64, String> {
    state
        .add_folder(&name, parent_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn move_assets_to_folder(
    state: State<SqliteDatabase>,
    ids: Vec<i64>,
    folder_id: i64,
) -> Result<(), String> {
    state
        .move_assets_to_folder(ids, folder_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_folder(state: State<SqliteDatabase>, id: i64) -> Result<(), String> {
    state.delete_folder(id).map_err(|e| e.to_string())
}
