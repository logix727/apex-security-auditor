use crate::core::detector::FindingSeverity;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecretFinding {
    pub secret_type: String,
    pub severity: FindingSeverity,
    pub matched_value: String,
    pub start_offset: usize,
    pub end_offset: usize,
    pub confidence: f64,
    pub description: String,
}

struct SecretPattern {
    name: &'static str,
    pattern: &'static str,
    severity: FindingSeverity,
    confidence: f64,
    description: &'static str,
}

fn calculate_entropy(s: &str) -> f64 {
    if s.is_empty() {
        return 0.0;
    }

    let mut frequency: HashMap<char, usize> = HashMap::new();
    let len = s.len();

    for c in s.chars() {
        *frequency.entry(c).or_insert(0) += 1;
    }

    let mut entropy = 0.0;
    for &count in frequency.values() {
        let probability = count as f64 / len as f64;
        if probability > 0.0 {
            entropy -= probability * probability.log2();
        }
    }

    entropy
}

fn is_high_entropy_base64(s: &str) -> bool {
    let base64_pattern = Regex::new(r"^[A-Za-z0-9+/]+=*$").unwrap();
    if !base64_pattern.is_match(s) {
        return false;
    }

    if s.len() < 20 {
        return false;
    }

    calculate_entropy(s) > 4.5
}

pub fn detect_high_entropy_secrets(content: &str) -> Vec<SecretFinding> {
    let mut findings = Vec::new();
    let base64_regex = Regex::new(r"[A-Za-z0-9+/]{20,}=*").unwrap();

    for cap in base64_regex.find_iter(content) {
        let matched = cap.as_str();
        if is_high_entropy_base64(matched) {
            let entropy = calculate_entropy(matched);
            findings.push(SecretFinding {
                secret_type: "High-Entropy String".to_string(),
                severity: FindingSeverity::Medium,
                matched_value: format!("{}...", &matched[..8.min(matched.len())]),
                start_offset: cap.start(),
                end_offset: cap.end(),
                confidence: ((entropy - 4.5) / 3.5).min(1.0),
                description: format!(
                    "High-entropy string detected (entropy: {:.2}). Potentially encoded secret or API key.",
                    entropy
                ),
            });
        }
    }

    findings
}

fn get_secret_patterns() -> Vec<SecretPattern> {
    vec![
        SecretPattern {
            name: "AWS Access Key ID",
            pattern: r"AKIA[0-9A-Z]{16}",
            severity: FindingSeverity::Critical,
            confidence: 0.95,
            description:
                "AWS Access Key ID detected. This credential can be used to access AWS services.",
        },
        SecretPattern {
            name: "GitHub Personal Access Token",
            pattern: r"ghp_[0-9a-zA-Z]{36}",
            severity: FindingSeverity::Critical,
            confidence: 0.95,
            description: "GitHub Personal Access Token detected.",
        },
        SecretPattern {
            name: "Stripe Live Secret Key",
            pattern: r"sk_live_[0-9a-zA-Z]{24}",
            severity: FindingSeverity::Critical,
            confidence: 0.95,
            description: "Stripe Live Secret Key detected. Can process real payments.",
        },
        SecretPattern {
            name: "Slack User Token",
            pattern: r"xoxp-[0-9]{10,12}-[0-9]{10,12}-[0-9a-zA-Z]{24}",
            severity: FindingSeverity::Critical,
            confidence: 0.95,
            description: "Slack User Token detected. Has user-level access to Slack.",
        },
        SecretPattern {
            name: "Generic API Key Pattern",
            pattern: r#"(?i)(?:api[_-]?key|apikey)['"]?\s*[:=]\s*['"]?[a-zA-Z0-9_\-]{20,}['"]?"#,
            severity: FindingSeverity::High,
            confidence: 0.75,
            description: "Generic API Key pattern detected.",
        },
        SecretPattern {
            name: "Bearer Token",
            pattern: r"Bearer\s+[A-Za-z0-9\-._~+/]+=*",
            severity: FindingSeverity::High,
            confidence: 0.85,
            description: "Bearer Token detected in content.",
        },
    ]
}

pub fn detect_secrets(content: &str) -> Vec<SecretFinding> {
    let mut findings = Vec::new();
    let patterns = get_secret_patterns();

    for p in patterns {
        let re = Regex::new(p.pattern).unwrap();
        for cap in re.find_iter(content) {
            let matched = cap.as_str();
            findings.push(SecretFinding {
                secret_type: p.name.to_string(),
                severity: p.severity.clone(),
                matched_value: if matched.len() > 12 {
                    format!("{}...{}", &matched[..4], &matched[matched.len() - 4..])
                } else {
                    "***".to_string()
                },
                start_offset: cap.start(),
                end_offset: cap.end(),
                confidence: p.confidence,
                description: p.description.to_string(),
            });
        }
    }

    findings.extend(detect_high_entropy_secrets(content));
    findings
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::detector::FindingSeverity;

    #[test]
    fn test_detect_aws_key() {
        let content = "The key is AKIA1234567890123456 do not share!";
        let findings = detect_secrets(content);
        assert!(!findings.is_empty());
        assert_eq!(findings[0].secret_type, "AWS Access Key ID");
        assert_eq!(findings[0].severity, FindingSeverity::Critical);
    }

    #[test]
    fn test_detect_github_token() {
        let content = "export GITHUB_TOKEN=ghp_aB1cD2eF3gH4iJ5kL6mN7oP8qR9sT0uV1wX2";
        let findings = detect_secrets(content);
        assert!(!findings.is_empty());
        assert_eq!(findings[0].secret_type, "GitHub Personal Access Token");
        assert_eq!(findings[0].severity, FindingSeverity::Critical);
    }

    #[test]
    fn test_detect_bearer_token() {
        let content = "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9";
        let findings = detect_secrets(content);
        assert!(findings.iter().any(|f| f.secret_type == "Bearer Token"));
    }

    #[test]
    fn test_high_entropy_detection() {
        // A random high entropy string
        let content = "secret_value = 'SGVsbG8gV29ybGQhIFRoaXMgaXMgYSByYW5kb20gc3RyaW5nIHdpdGggaGlnaCBlbnRyb3B5IQ=='";
        let findings = detect_high_entropy_secrets(content);
        assert!(!findings.is_empty());
    }

    #[test]
    fn test_no_secrets() {
        let content = "Just some normal text without any keys or secrets.";
        let findings = detect_secrets(content);
        assert!(findings.is_empty());
    }
}
