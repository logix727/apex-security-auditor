use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Instant;
use tauri::command;

#[derive(Serialize, Deserialize, Debug)]
pub struct RepeaterResponse {
    status: u16,
    #[serde(rename = "statusText")]
    status_text: String,
    headers: HashMap<String, String>,
    body: String,
    #[serde(rename = "durationMs")]
    duration_ms: u64,
}

#[command]
pub async fn send_request(
    method: String,
    url: String,
    headers: HashMap<String, String>,
    body: String,
) -> Result<RepeaterResponse, String> {
    let client = reqwest::Client::builder()
        .danger_accept_invalid_certs(true)
        .build()
        .map_err(|e| e.to_string())?;

    let method = method
        .parse::<reqwest::Method>()
        .map_err(|e| e.to_string())?;

    let mut req_headers = HeaderMap::new();
    for (k, v) in headers {
        if let (Ok(k), Ok(v)) = (
            HeaderName::from_bytes(k.as_bytes()),
            HeaderValue::from_str(&v),
        ) {
            req_headers.insert(k, v);
        }
    }

    let start = Instant::now();
    let res = client
        .request(method, &url)
        .headers(req_headers)
        .body(body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let duration = start.elapsed().as_millis() as u64;
    let status = res.status();

    let mut resp_headers = HashMap::new();
    for (k, v) in res.headers() {
        if let Ok(val) = v.to_str() {
            resp_headers.insert(k.to_string(), val.to_string());
        }
    }

    let body_text = res.text().await.map_err(|e| e.to_string())?;

    Ok(RepeaterResponse {
        status: status.as_u16(),
        status_text: status.canonical_reason().unwrap_or("").to_string(),
        headers: resp_headers,
        body: body_text,
        duration_ms: duration,
    })
}
