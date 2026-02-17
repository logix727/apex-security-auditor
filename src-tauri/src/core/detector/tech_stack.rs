use crate::core::detector::FindingSeverity;
use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorFinding {
    pub technology: String,
    pub error_type: String,
    pub severity: FindingSeverity,
    pub description: String,
    pub matched_pattern: String,
    pub start_offset: usize,
    pub end_offset: usize,
}

pub fn detect_tech_stack_errors(content: &str) -> Vec<ErrorFinding> {
    let mut findings = Vec::new();

    let error_patterns = vec![
        (
            "Spring Boot",
            "Whitelist Error Page",
            FindingSeverity::Medium,
            r"(?i)this application has no explicit mapping for /error",
        ),
        (
            "Django",
            "Debug Mode Disclosure",
            FindingSeverity::High,
            r"(?i)you're seeing this error because you have <code>DEBUG = True</code>",
        ),
        (
            "PHP/Laravel",
            "Whoops! Error Disclosure",
            FindingSeverity::High,
            r"(?i)whoops, looks like something went wrong",
        ),
        (
            "React/Next.js",
            "Hydration Error disclose",
            FindingSeverity::Low,
            r"(?i)hydration failed because the initial UI does not match",
        ),
        (
            "ASP.NET",
            "CustomErrors Disclosure",
            FindingSeverity::Medium,
            r"(?i)runtime error.*?details.*?set customerrors mode",
        ),
        (
            "SQL Error",
            "MySQL Disclosure",
            FindingSeverity::High,
            r"(?i)you have an error in your SQL syntax.*?mysql",
        ),
        (
            "SQL Error",
            "PostgreSQL Disclosure",
            FindingSeverity::High,
            r"(?i)ERROR:\s*syntax error at or near.*?line",
        ),
        (
            "System",
            "Stack Trace",
            FindingSeverity::Medium,
            r"(?i)at [\w\.\$]+\([\w\.\$]+\.(?:java|js|py|php|cs):\d+\)",
        ),
    ];

    for (tech, err_type, sev, pattern) in error_patterns {
        let re = Regex::new(pattern).unwrap();
        for cap in re.find_iter(content) {
            findings.push(ErrorFinding {
                technology: tech.to_string(),
                error_type: err_type.to_string(),
                severity: sev.clone(),
                description: format!("Verbose error from {} detected. This may disclose internal implementation details.", tech),
                matched_pattern: cap.as_str().to_string(),
                start_offset: cap.start(),
                end_offset: cap.end(),
            });
        }
    }

    findings
}
