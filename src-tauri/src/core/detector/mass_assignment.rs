use crate::core::detector::FindingSeverity;
use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MassAssignmentFinding {
    pub severity: FindingSeverity,
    pub description: String,
    pub evidence: String,
    pub key: String,
    pub start_offset: usize,
    pub end_offset: usize,
}

pub fn detect_mass_assignment(body: &str) -> Vec<MassAssignmentFinding> {
    let mut findings = Vec::new();

    // Look for suspicious keys in JSON bodies
    // Regex matches "key": ... where key is one of the suspicious terms
    let key_pattern = Regex::new(r#"(?i)"((?:is_)?(?:admin|superuser|root|role|permissions|groups|privileges|scope|plans|tier|balance|credit))"\s*:"#).unwrap();

    for cap in key_pattern.captures_iter(body) {
        if let Some(key_match) = cap.get(1) {
            let key = key_match.as_str();

            findings.push(MassAssignmentFinding {
                severity: FindingSeverity::High,
                description: format!("Potential Mass Assignment vulnerability. The key '{}' suggests a sensitive property that should not be client-modifiable.", key),
                evidence: key.to_string(),
                key: key.to_string(),
                start_offset: key_match.start(),
                end_offset: key_match.end(),
            });
        }
    }

    findings
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_mass_assignment_admin() {
        let body = r#"{"name": "John", "is_admin": true}"#;
        let findings = detect_mass_assignment(body);
        assert!(!findings.is_empty());
        assert_eq!(findings[0].key, "is_admin");
        assert_eq!(findings[0].severity, FindingSeverity::High);
    }

    #[test]
    fn test_detect_mass_assignment_role() {
        let body = r#"{"user": {"role": "superuser"}}"#;
        let findings = detect_mass_assignment(body);
        assert!(!findings.is_empty());
        assert_eq!(findings[0].key, "role");
    }

    #[test]
    fn test_no_mass_assignment() {
        let body = r#"{"name": "John", "age": 30}"#;
        let findings = detect_mass_assignment(body);
        assert!(findings.is_empty());
    }
}
