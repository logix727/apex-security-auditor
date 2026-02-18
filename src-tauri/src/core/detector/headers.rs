use crate::core::detector::FindingSeverity;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeaderFinding {
    pub header_name: String,
    pub current_value: Option<String>,
    pub is_missing: bool,
    pub is_weak: bool,
    pub severity: FindingSeverity,
    pub cvss_score: f32,
    pub cvss_vector: String,
    pub description: String,
    pub recommendation: String,
    pub start_offset: usize,
    pub end_offset: usize,
}

pub fn analyze_headers(
    headers_raw: &str,
    header_map: &HashMap<String, String>,
) -> Vec<HeaderFinding> {
    let mut findings = Vec::new();

    let get_header_with_offset = |name: &str| -> Option<(String, String, usize, usize)> {
        for (key, value) in header_map {
            if key.to_lowercase() == name.to_lowercase() {
                let search_str = format!("{}:", key);
                if let Some(start) = headers_raw.to_lowercase().find(&search_str.to_lowercase()) {
                    let end = start + key.len() + 1 + value.len();
                    return Some((key.clone(), value.clone(), start, end));
                }
                return Some((key.clone(), value.clone(), 0, 0));
            }
        }
        None
    };

    // Check HSTS
    match get_header_with_offset("strict-transport-security") {
        Some((key, value, start, end)) => {
            if !value.contains("max-age") {
                findings.push(HeaderFinding {
                    header_name: key,
                    current_value: Some(value.clone()),
                    is_missing: false,
                    is_weak: true,
                    severity: FindingSeverity::Low,
                    cvss_score: 3.7,
                    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:N/A:N".to_string(),
                    description: "HSTS header present but missing max-age directive".to_string(),
                    recommendation: "Add 'max-age=31536000; includeSubDomains'".to_string(),
                    start_offset: start,
                    end_offset: end,
                });
            } else if !value.contains("includeSubDomains") {
                findings.push(HeaderFinding {
                    header_name: key,
                    current_value: Some(value.clone()),
                    is_missing: false,
                    is_weak: true,
                    severity: FindingSeverity::Low,
                    cvss_score: 2.3,
                    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:N/A:N".to_string(),
                    description: "HSTS header missing includeSubDomains directive".to_string(),
                    recommendation: "Add 'includeSubDomains' to protect all subdomains".to_string(),
                    start_offset: start,
                    end_offset: end,
                });
            }
        }
        None => {
            findings.push(HeaderFinding {
                header_name: "Strict-Transport-Security".to_string(),
                current_value: None,
                is_missing: true,
                is_weak: false,
                severity: FindingSeverity::Low,
                cvss_score: 2.0,
                cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:L/I:L/A:N".to_string(), // Adjusted to Low for Dev envs
                description: "Missing HSTS header. Site is vulnerable to SSL stripping attacks (Low Risk in Dev)"
                    .to_string(),
                recommendation:
                    "Add 'Strict-Transport-Security: max-age=31536000; includeSubDomains'"
                        .to_string(),
                start_offset: 0,
                end_offset: 0,
            });
        }
    }

    // Check CSP
    match get_header_with_offset("content-security-policy") {
        Some((key, value, start, end)) => {
            let weak_patterns = ["unsafe-inline", "unsafe-eval", "*", "data:"];
            for weak in weak_patterns {
                if value.contains(weak) {
                    findings.push(HeaderFinding {
                        header_name: key.clone(),
                        current_value: Some(value.clone()),
                        is_missing: false,
                        is_weak: true,
                        severity: FindingSeverity::Low,
                        cvss_score: 3.3,
                        cvss_vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:N/A:N".to_string(),
                        description: format!("CSP contains weak directive: '{}'", weak),
                        recommendation: "Remove unsafe directives and use nonces/hashes instead"
                            .to_string(),
                        start_offset: start,
                        end_offset: end,
                    });
                }
            }
        }
        None => {
            findings.push(HeaderFinding {
                header_name: "Content-Security-Policy".to_string(),
                current_value: None,
                is_missing: true,
                is_weak: false,
                severity: FindingSeverity::Low,
                cvss_score: 2.0,
                cvss_vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:N".to_string(), // Adjusted to Low for Dev envs
                description: "Missing Content-Security-Policy header (Low Risk in Dev)."
                    .to_string(),
                recommendation: "Add a restrictive CSP header.".to_string(),
                start_offset: 0,
                end_offset: 0,
            });
        }
    }

    // Check X-Content-Type-Options
    match get_header_with_offset("x-content-type-options") {
        Some((key, value, start, end)) => {
            if value.to_lowercase() != "nosniff" {
                findings.push(HeaderFinding {
                    header_name: key,
                    current_value: Some(value.clone()),
                    is_missing: false,
                    is_weak: true,
                    severity: FindingSeverity::Low,
                    cvss_score: 1.5,
                    cvss_vector: "CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:N/I:L/A:N".to_string(),
                    description: "X-Content-Type-Options has incorrect value".to_string(),
                    recommendation: "Set to 'nosniff'".to_string(),
                    start_offset: start,
                    end_offset: end,
                });
            }
        }
        None => {
            findings.push(HeaderFinding {
                header_name: "X-Content-Type-Options".to_string(),
                current_value: None,
                is_missing: true,
                is_weak: false,
                severity: FindingSeverity::Low,
                cvss_score: 2.1,
                cvss_vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:L/A:N".to_string(),
                description: "Missing X-Content-Type-Options header.".to_string(),
                recommendation: "Add 'X-Content-Type-Options: nosniff'".to_string(),
                start_offset: 0,
                end_offset: 0,
            });
        }
    }

    findings
}
