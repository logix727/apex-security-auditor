use crate::core::detector::secrets::SecretFinding;
use crate::core::detector::FindingSeverity;
use regex::Regex;

pub fn detect_auth_issues(url: &str, body: &str, headers: &str) -> Vec<SecretFinding> {
    let mut findings = Vec::new();

    // 1. JWT alg:none check
    let jwt_pattern =
        Regex::new(r"eyJ[a-zA-Z0-9\-_]+\.eyJ[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+").unwrap();
    for cap in jwt_pattern
        .find_iter(body)
        .chain(jwt_pattern.find_iter(headers))
    {
        let matched = cap.as_str();
        if matched.starts_with("eyJhbGciOiJub25lIn") {
            // {"alg":"none",...
            findings.push(SecretFinding {
                secret_type: "JWT alg:none".to_string(),
                severity: FindingSeverity::Critical,
                matched_value: "alg:none".to_string(),
                start_offset: cap.start(),
                end_offset: cap.end(),
                confidence: 1.0,
                description: "JWT with 'alg':'none' detected. This allows anyone to forge tokens."
                    .to_string(),
            });
        }
    }

    // 2. Basic Auth over HTTP
    if url.starts_with("http://") && headers.to_lowercase().contains("authorization: basic") {
        findings.push(SecretFinding {
            secret_type: "Unencrypted Basic Auth".to_string(),
            severity: FindingSeverity::High,
            matched_value: "Basic Auth over HTTP".to_string(),
            start_offset: 0,
            end_offset: 0,
            confidence: 0.95,
            description: "Basic Authentication credentials sent over unencrypted HTTP protocol."
                .to_string(),
        });
    }

    findings
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_jwt_alg_none() {
        let headers = "Authorization: Bearer eyJhbGciOiJub25lInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.xxx";
        let findings = detect_auth_issues("https://api.example.com", "", headers);
        assert!(!findings.is_empty());
        assert_eq!(findings[0].secret_type, "JWT alg:none");
        assert_eq!(findings[0].severity, FindingSeverity::Critical);
    }

    #[test]
    fn test_detect_unencrypted_basic_auth() {
        let url = "http://api.example.com/v1/user";
        let headers = "Authorization: Basic dXNlcjpwYXNz\nContent-Type: application/json";
        let findings = detect_auth_issues(url, "", headers);
        assert!(!findings.is_empty());
        assert_eq!(findings[0].secret_type, "Unencrypted Basic Auth");
        assert_eq!(findings[0].severity, FindingSeverity::High);
    }

    #[test]
    fn test_no_auth_issues() {
        let url = "https://api.example.com/v1/user";
        let headers = "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxx.yyy";
        let findings = detect_auth_issues(url, "", headers);
        assert!(findings.is_empty());
    }
}
