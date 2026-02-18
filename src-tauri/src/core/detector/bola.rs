use crate::core::detector::FindingSeverity;
use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BolaFinding {
    pub finding_type: String,
    pub severity: FindingSeverity,
    pub location: String,
    pub description: String,
    pub resource_pattern: String,
    pub is_predictable: bool,
    pub remediation: String,
    pub start_offset: usize,
    pub end_offset: usize,
}

pub fn detect_bola_patterns(url: &str, body: &str) -> Vec<BolaFinding> {
    let mut findings = Vec::new();

    // 1. URL ID Extraction & Predictability check
    let id_pattern = Regex::new(r"/(?P<id>[0-9]{1,10}|[0-9a-fA-F-]{36})\b").unwrap();
    for cap in id_pattern.captures_iter(url) {
        if let Some(m) = cap.name("id") {
            let id_val = m.as_str();
            let is_numeric = id_val.chars().all(|c| c.is_ascii_digit());

            if is_numeric && id_val.len() < 8 {
                findings.push(BolaFinding {
                    finding_type: "Predictable Resource ID".to_string(),
                    severity: FindingSeverity::High,
                    location: url.to_string(),
                    description: format!("The URL contains a predictable numeric ID: {}. Numeric IDs are easier to iterate and exploit for BOLA attacks.", id_val),
                    resource_pattern: id_val.to_string(),
                    is_predictable: true,
                    remediation: "Use non-predictable identifiers like UUIDs (v4) for resource identification.".to_string(),
                    start_offset: 0, // In URL contexts, we might not have precise body offsets
                    end_offset: 0,
                });
            }
        }
    }

    // 2. Body-based ID detection (JSON)
    let json_id_pattern = Regex::new(r#"(?i)["'](?:id|user_id|account_id|owner_id)["']\s*:\s*(?P<val>[0-9]{1,10}|["'][A-Za-z0-9-]{10,}["'])"#).unwrap();
    for cap in json_id_pattern.captures_iter(body) {
        if let Some(m) = cap.name("val") {
            let val = m.as_str().replace(['"', '\''], "");
            let is_numeric = val.chars().all(|c| c.is_ascii_digit());

            if is_numeric && val.len() < 8 {
                findings.push(BolaFinding {
                    finding_type: "Resource ID in Body".to_string(),
                    severity: FindingSeverity::Medium,
                    location: "Body".to_string(),
                    description: format!("The response body contains property '{}' with a predictable numeric value: {}.", cap.get(0).unwrap().as_str().split(':').next().unwrap().trim(), val),
                    resource_pattern: val.to_string(),
                    is_predictable: true,
                    remediation: "Ensure the backend validates that the authenticated user has permission to access the specific resource ID requested.".to_string(),
                    start_offset: m.start(),
                    end_offset: m.end(),
                });
            }
        }
    }

    findings
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_predictable_url_id() {
        let url = "https://api.example.com/api/v1/users/123/profile";
        let findings = detect_bola_patterns(url, "");
        assert!(!findings.is_empty());
        assert_eq!(findings[0].finding_type, "Predictable Resource ID");
        assert_eq!(findings[0].resource_pattern, "123");
        assert_eq!(findings[0].severity, FindingSeverity::High);
    }

    #[test]
    fn test_detect_predictable_body_id() {
        let body = r#"{"status": "success", "data": {"id": 456, "name": "Test User"}}"#;
        let findings = detect_bola_patterns("https://api.example.com/user", body);
        assert!(!findings.is_empty());
        assert_eq!(findings[0].finding_type, "Resource ID in Body");
        assert_eq!(findings[0].resource_pattern, "456");
        assert_eq!(findings[0].severity, FindingSeverity::Medium);
    }

    #[test]
    fn test_detect_uuid_id_is_safe() {
        let url =
            "https://api.example.com/api/v1/users/550e8400-e29b-41d4-a716-446655440000/content";
        let findings = detect_bola_patterns(url, "");
        // UUIDs should not be flagged as predictable numeric IDs
        assert!(findings.is_empty());
    }

    #[test]
    fn test_detect_long_numeric_id_is_safe() {
        let url = "https://api.example.com/orders/123456789012345";
        let findings = detect_bola_patterns(url, "");
        // Long numeric IDs are harder to guess/enumerate
        assert!(findings.is_empty());
    }
}
