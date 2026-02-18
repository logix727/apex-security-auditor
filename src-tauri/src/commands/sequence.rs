use crate::core::data::{RequestSequence, SequenceStep};
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
    captures: Vec<crate::core::data::VariableCapture>,
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
        request_headers,
        response_headers,
        timestamp: String::new(),
        captures,
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

#[tauri::command]
pub async fn execute_sequence_step(
    db: State<'_, SqliteDatabase>,
    step: SequenceStep,
    context: std::collections::HashMap<String, String>,
) -> Result<serde_json::Value, String> {
    use crate::utils::sequence_engine::{extract_variables, substitute_variables};

    // 1. Substitute variables
    let final_url = substitute_variables(&step.url, &context);
    let final_body = step
        .request_body
        .as_ref()
        .map(|b| substitute_variables(b, &context));
    let final_headers_str = step
        .request_headers
        .as_ref()
        .map(|h| substitute_variables(h, &context));

    // 2. Setup request
    let method = match step.method.to_uppercase().as_str() {
        "POST" => reqwest::Method::POST,
        "PUT" => reqwest::Method::PUT,
        "DELETE" => reqwest::Method::DELETE,
        "PATCH" => reqwest::Method::PATCH,
        _ => reqwest::Method::GET,
    };

    let mut rb = db.client.request(method, &final_url);
    if let Some(body) = final_body {
        rb = rb.body(body);
    }

    if let Some(headers) = final_headers_str {
        for line in headers.lines() {
            if let Some((k, v)) = line.split_once(':') {
                rb = rb.header(k.trim(), v.trim());
            }
        }
    }

    // 3. Execute
    let resp = rb.send().await.map_err(|e| e.to_string())?;
    let status = resp.status().as_u16();
    let resp_headers_map = resp.headers().clone();
    let resp_body = resp.text().await.unwrap_or_default();

    let mut resp_headers_str = String::new();
    for (k, v) in resp_headers_map.iter() {
        resp_headers_str.push_str(&format!("{}: {}\n", k, v.to_str().unwrap_or_default()));
    }

    // 4. Extract new variables
    let new_vars = extract_variables(&step.captures, &resp_body, &resp_headers_str);

    let mut updated_context = context.clone();
    updated_context.extend(new_vars);

    Ok(serde_json::json!({
        "status_code": status,
        "response_body": resp_body,
        "response_headers": resp_headers_str,
        "updated_context": updated_context,
        "final_url": final_url
    }))
}

#[tauri::command]
pub async fn delete_sequence_step(
    db: State<'_, SqliteDatabase>,
    step_id: i64,
) -> Result<(), String> {
    db.delete_step_from_sequence(step_id)
        .map_err(|e| e.to_string())
}
