use crate::core::data::{ScanResult, Severity};
use crate::core::detectors::analyze;
use crate::db::SqliteDatabase;
use reqwest::{header::HeaderMap, Client};
use std::sync::Arc;
use url::Url;

pub struct ScanService {
    client: Client,
    rate_limiter: Arc<crate::core::rate_limiter::RateLimiter>,
}

impl ScanService {
    pub fn new(db: SqliteDatabase) -> Self {
        Self {
            client: db.client,
            rate_limiter: db.rate_limiter,
        }
    }

    pub async fn scan_url(&self, url: &str, method: &str) -> ScanResult {
        let request_headers = format!(
            "Method: {}\nURL: {}\nUser-Agent: ApexSecurityAuditor/1.0",
            method, url
        );
        let request_body = "".to_string();

        // Wait for the rate limit before making any request
        self.rate_limiter.wait().await;
        let method_type = match method.to_uppercase().as_str() {
            "POST" => reqwest::Method::POST,
            "PUT" => reqwest::Method::PUT,
            "DELETE" => reqwest::Method::DELETE,
            _ => reqwest::Method::GET,
        };

        let response = match self.client.request(method_type, url).send().await {
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
        let response_headers = self.format_headers(response.headers());

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

        let discovered_urls = self.extract_urls(&response_body, url);

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

    fn extract_urls(&self, body: &str, base_url: &str) -> Vec<String> {
        let mut urls = Vec::new();
        let base = match Url::parse(base_url) {
            Ok(u) => u,
            Err(_) => return urls,
        };

        // Helper to compile regex once
        static URL_REGEX: std::sync::OnceLock<regex::Regex> = std::sync::OnceLock::new();
        let re = URL_REGEX.get_or_init(|| {
            regex::Regex::new(r#"(?:https?://[^\s"'<>]+)|(?:/[^\s"'<>]+)"#).expect("Invalid regex")
        });

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

    fn format_headers(&self, headers: &HeaderMap) -> String {
        headers
            .iter()
            .map(|(k, v)| format!("{}: {}", k, v.to_str().unwrap_or_default()))
            .collect::<Vec<String>>()
            .join("\n")
    }
}
