use crate::db::{Badge, Severity};
use crate::detectors::analyze;
use reqwest::{header::HeaderMap, Client};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ScanResult {
    pub status: String,
    pub status_code: i32,
    pub risk_score: i32,
    pub findings: Vec<Badge>,
    pub response_headers: String,
    pub response_body: String,
    pub request_headers: String,
    pub request_body: String,
    pub discovered_urls: Vec<String>,
}

pub async fn scan_url(
    client: &Client,
    url: &str,
    method: &str,
    rate_limiter: &crate::core::rate_limiter::RateLimiter,
) -> ScanResult {
    // Wait for the rate limit before making any request
    rate_limiter.wait().await;
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
                discovered_urls: vec![],
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

    let combined_body = format!("{}\n{}", request_body, response_body);
    let combined_headers = format!("{}\n{}", request_headers, response_headers);

    let badges = analyze(url, &combined_body, u16_status, method, &combined_headers);
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

    let discovered_urls = extract_urls(&response_body, url);

    ScanResult {
        status: final_status.to_string(),
        status_code: u16_status as i32,
        risk_score: risk_score as i32,
        findings: badges,
        response_headers,
        response_body,
        request_headers,
        request_body,
        discovered_urls,
    }
}

fn extract_urls(body: &str, base_url: &str) -> Vec<String> {
    use url::Url;
    let mut urls = Vec::new();
    let base = match Url::parse(base_url) {
        Ok(u) => u,
        Err(_) => return urls,
    };

    // Very simple discovery for now: look for things that look like paths or absolute URLs in strings
    // In a real auditor, we'd use a proper HTML parser or more complex regex
    let re = regex::Regex::new(r#"(?:https?://[^\s"'<>]+)|(?:/[^\s"'<>]+)"#).unwrap();

    for cap in re.find_iter(body) {
        let raw = cap.as_str();

        // Skip common static assets to reduce noise
        let lower_raw = raw.to_lowercase();
        let noise_extensions = [
            ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".woff", ".woff2", ".ttf", ".otf",
            ".eot", ".css", ".map", ".mp4", ".webm", ".webp",
        ];

        if noise_extensions.iter().any(|ext| lower_raw.ends_with(ext)) {
            continue;
        }

        if raw.starts_with('/') {
            // Relative path
            if let Ok(full) = base.join(raw) {
                // Only keep if same host (heuristic for recursive discovery)
                if full.host() == base.host() {
                    urls.push(full.to_string());
                }
            }
        } else {
            // Absolute URL
            if let Ok(full) = Url::parse(raw) {
                if full.host() == base.host() {
                    urls.push(full.to_string());
                }
            }
        }
    }
    urls.sort();
    urls.dedup();
    urls
}

fn format_headers(headers: &HeaderMap) -> String {
    headers
        .iter()
        .map(|(k, v)| format!("{}: {}", k, v.to_str().unwrap_or_default()))
        .collect::<Vec<String>>()
        .join("\n")
}
