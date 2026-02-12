use crate::db::{Badge, Severity};
use crate::detectors::analyze;
use reqwest::{header::HeaderMap, Client};

#[derive(Debug, Clone)]
pub struct ScanResult {
    pub status: String,
    pub status_code: i32,
    pub risk_score: i32,
    pub findings: Vec<Badge>,
    pub response_headers: String,
    pub response_body: String,
    pub request_headers: String,
    pub request_body: String,
}

pub async fn scan_url(client: &Client, url: &str, method: &str) -> ScanResult {
    let method_type = match method.to_uppercase().as_str() {
        "POST" => reqwest::Method::POST,
        "PUT" => reqwest::Method::PUT,
        "DELETE" => reqwest::Method::DELETE,
        _ => reqwest::Method::GET,
    };

    // Prepare Request Details (simplified for now)
    let request_headers = format!(
        "Method: {}\nURL: {}\nUser-Agent: ApexSecurityAuditor/1.0",
        method, url
    );
    let request_body = "".to_string(); // Placeholder for future targeted scans with payloads

    let response = match client.request(method_type, url).send().await {
        Ok(resp) => resp,
        Err(e) => {
            return ScanResult {
                status: "Connection Failed".to_string(),
                status_code: 0,
                risk_score: 0,
                findings: vec![],
                response_headers: format!("Error: {}", e),
                response_body: "".to_string(),
                request_headers,
                request_body,
            };
        }
    };

    let status_code = response.status();
    let u16_status = status_code.as_u16();

    // Capture response headers
    let response_headers = format_headers(response.headers());

    let response_body = match response.text().await {
        Ok(text) => text,
        Err(_) => "[Incompatible Binary Content]".to_string(),
    };

    let badges = analyze(&response_body, u16_status, method, &response_headers);
    let mut risk_score = 0;
    for b in &badges {
        risk_score += match b.severity {
            Severity::Critical => 100,
            Severity::High => 50,
            Severity::Medium => 25,
            Severity::Low => 10,
            Severity::Info => 0,
        };
    }

    let final_status = if risk_score >= 100 {
        "Critical"
    } else if risk_score >= 50 {
        "Warning"
    } else if risk_score > 0 {
        "Suspicious"
    } else {
        "Safe"
    };

    ScanResult {
        status: final_status.to_string(),
        status_code: u16_status as i32,
        risk_score: risk_score as i32,
        findings: badges,
        response_headers,
        response_body,
        request_headers,
        request_body,
    }
}

fn format_headers(headers: &HeaderMap) -> String {
    headers
        .iter()
        .map(|(k, v)| format!("{}: {}", k, v.to_str().unwrap_or_default()))
        .collect::<Vec<String>>()
        .join("\n")
}
