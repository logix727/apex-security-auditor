use crate::core::detector::FindingSeverity;
use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SsrfFinding {
    pub severity: FindingSeverity,
    pub description: String,
    pub evidence: String,
    pub parameter: String,
    pub start_offset: usize,
    pub end_offset: usize,
}

pub fn detect_ssrf(url: &str, body: &str) -> Vec<SsrfFinding> {
    let mut findings = Vec::new();

    // 1. Check Query Parameters for suspicious names
    if let Ok(parsed) = url::Url::parse(url) {
        for (key, val) in parsed.query_pairs() {
            if is_suspicious_ssrf_param(&key) {
                findings.push(SsrfFinding {
                    severity: FindingSeverity::Medium,
                    description: "Potential SSRF vector in URL parameter. The parameter name suggests it accepts a URL or destination.".to_string(),
                    evidence: format!("{}={}", key, val),
                    parameter: key.to_string(),
                    start_offset: 0,
                    end_offset: 0,
                });
            }
        }
    }

    // 2. Check JSON Body for suspicious keys
    let key_pattern = Regex::new(r#"(?i)"(url|uri|href|src|source|dest|destination|callback|webhook|redirect|target)"\s*:\s*"([^"]+)""#).unwrap();

    for cap in key_pattern.captures_iter(body) {
        if let (Some(key_match), Some(val_match)) = (cap.get(1), cap.get(2)) {
            let key = key_match.as_str();
            let val = val_match.as_str();

            // Check if value looks like a URL or IP
            if val.starts_with("http") || val.contains("://") || is_ip_address(val) {
                findings.push(SsrfFinding {
                    severity: FindingSeverity::High,
                    description: format!("Strong SSRF Indicator: Parameter '{}' contains a URL/IP value in the request body.", key),
                    evidence: format!("{}: \"{}\"", key, val),
                    parameter: key.to_string(),
                    start_offset: key_match.start(),
                    end_offset: val_match.end(),
                });
            } else {
                findings.push(SsrfFinding {
                    severity: FindingSeverity::Medium,
                    description: format!("Potential SSRF vector. Parameter '{}' suggests it accepts a URL/Destination.", key),
                    evidence: format!("{}: \"{}\"", key, val),
                    parameter: key.to_string(),
                    start_offset: key_match.start(),
                    end_offset: key_match.end(),
                });
            }
        }
    }

    findings
}

fn is_suspicious_ssrf_param(key: &str) -> bool {
    let lower = key.to_lowercase();
    matches!(
        lower.as_str(),
        "url"
            | "uri"
            | "href"
            | "src"
            | "source"
            | "dest"
            | "destination"
            | "callback"
            | "webhook"
            | "redirect"
            | "target"
    )
}

fn is_ip_address(val: &str) -> bool {
    let ip_pattern = Regex::new(r"\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b").unwrap();
    ip_pattern.is_match(val)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_ssrf_url_param() {
        let url = "https://api.example.com/proxy?url=http://internal.com";
        let findings = detect_ssrf(url, "");
        assert!(!findings.is_empty());
        assert_eq!(findings[0].parameter, "url");
    }

    #[test]
    fn test_detect_ssrf_body_key() {
        let body = r#"{"webhook": "https://attacker.com/callback"}"#;
        let findings = detect_ssrf("", body);
        assert!(!findings.is_empty());
        assert_eq!(findings[0].parameter, "webhook");
        assert_eq!(findings[0].severity, FindingSeverity::High);
    }

    #[test]
    fn test_detect_ssrf_body_key_no_url() {
        // Should still flag as medium severity due to name
        let body = r#"{"dest": "local_service"}"#;
        let findings = detect_ssrf("", body);
        assert!(!findings.is_empty());
        assert_eq!(findings[0].parameter, "dest");
        assert_eq!(findings[0].severity, FindingSeverity::Medium);
    }
}
