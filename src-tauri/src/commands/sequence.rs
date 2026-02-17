use crate::data::{RequestSequence, SequenceStep};
use crate::db::SqliteDatabase;
use tauri::State;

#[tauri::command]
pub async fn start_sequence(
    db: State<'_, SqliteDatabase>,
    name: String,
    context_summary: Option<String>,
) -> Result<String, String> {
    db.create_sequence(&name, context_summary)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_to_sequence(
    db: State<'_, SqliteDatabase>,
    sequence_id: String,
    asset_id: i64,
    method: String,
    url: String,
    status_code: i32,
    request_body: Option<String>,
    response_body: Option<String>,
    request_headers: Option<String>,
    response_headers: Option<String>,
) -> Result<(), String> {
    let step = SequenceStep {
        id: 0, // Auto-incremented
        sequence_id,
        asset_id,
        method,
        url,
        status_code,
        request_body,
        response_body,
        request_headers, // Verify if SequenceStep has this field
        response_headers,
        timestamp: String::new(), // DB defaults to CURRENT_TIMESTAMP
    };

    db.add_step_to_sequence(&step).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_sequence(
    db: State<'_, SqliteDatabase>,
    id: String,
) -> Result<RequestSequence, String> {
    db.get_sequence(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn list_sequences(db: State<'_, SqliteDatabase>) -> Result<Vec<RequestSequence>, String> {
    db.list_sequences().map_err(|e| e.to_string())
}
