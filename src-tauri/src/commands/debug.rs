use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LogLevel {
    Info,
    Warn,
    Error,
    Success,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DebugLogEntry {
    pub id: String,
    pub timestamp: String,
    pub level: LogLevel,
    pub source: String,
    pub message: String,
    pub details: Option<serde_json::Value>,
}

pub fn generate_log_id() -> String {
    chrono::Local::now().format("%Y%m%d%H%M%S%.3f").to_string()
}

pub fn emit_log(
    app: &AppHandle,
    level: LogLevel,
    source: &str,
    message: &str,
    details: Option<serde_json::Value>,
) {
    let entry = DebugLogEntry {
        id: generate_log_id(),
        timestamp: chrono::Local::now().to_rfc3339(),
        level,
        source: source.to_string(),
        message: message.to_string(),
        details,
    };
    let _ = app.emit("debug-log", entry);
}

#[tauri::command]
pub fn log_debug(
    app: AppHandle,
    level: String,
    source: String,
    message: String,
    details: Option<serde_json::Value>,
) -> Result<(), String> {
    let log_level = match level.to_lowercase().as_str() {
        "warn" => LogLevel::Warn,
        "error" => LogLevel::Error,
        "success" => LogLevel::Success,
        _ => LogLevel::Info,
    };

    emit_log(&app, log_level, &source, &message, details);
    Ok(())
}
