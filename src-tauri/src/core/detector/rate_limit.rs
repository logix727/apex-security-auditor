use crate::core::detector::FindingSeverity;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RateLimitFinding {
    pub severity: FindingSeverity,
    pub description: String,
    pub evidence: String,
    pub start_offset: usize,
    pub end_offset: usize,
}

pub fn check_rate_limiting(headers: &HashMap<String, String>) -> Vec<RateLimitFinding> {
    let mut findings = Vec::new();

    // Check for common Rate Limit headers
    let has_rate_limit = headers.keys().any(|k| {
        let k = k.to_lowercase();
        k.contains("ratelimit") || k == "x-rate-limit" || k == "retry-after"
    });

    if !has_rate_limit {
        findings.push(RateLimitFinding {
            severity: FindingSeverity::Info, // Info because it might be handled elsewhere (e.g., Gateway)
            description: "No Rate Limiting headers detected. APIs should implement rate limiting to prevent abuse (API4:2023).".to_string(),
            evidence: "Missing headers like X-RateLimit-Limit, X-RateLimit-Remaining, or Retry-After.".to_string(),
            start_offset: 0,
            end_offset: 0,
        });
    }

    findings
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_missing_rate_limit() {
        let headers = HashMap::new();
        let findings = check_rate_limiting(&headers);
        assert!(!findings.is_empty());
        assert_eq!(findings[0].severity, FindingSeverity::Info);
    }

    #[test]
    fn test_has_rate_limit() {
        let mut headers = HashMap::new();
        headers.insert("X-RateLimit-Remaining".to_string(), "100".to_string());
        let findings = check_rate_limiting(&headers);
        assert!(findings.is_empty());
    }

    #[test]
    fn test_has_retry_after() {
        let mut headers = HashMap::new();
        headers.insert("Retry-After".to_string(), "3600".to_string());
        let findings = check_rate_limiting(&headers);
        assert!(findings.is_empty());
    }
}
