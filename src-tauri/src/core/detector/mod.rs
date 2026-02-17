use crate::db::{Badge, Severity};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub mod auth;
pub mod automotive;
pub mod bola;
pub mod headers;
pub mod pii;
pub mod secrets;
pub mod tech_stack;

pub use auth::detect_auth_issues;
pub use automotive::detect_automotive;
pub use bola::{detect_bola_patterns, BolaFinding};
pub use headers::{analyze_headers, HeaderFinding};
pub use pii::detect_pii;
pub use secrets::SecretFinding;
pub use tech_stack::{detect_tech_stack_errors, ErrorFinding};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Finding {
    #[serde(flatten)]
    pub badge: Badge,
    pub start_offset: usize,
    pub end_offset: usize,
}

impl Finding {
    pub fn new(badge: Badge, start_offset: usize, end_offset: usize) -> Self {
        Self {
            badge,
            start_offset,
            end_offset,
        }
    }

    pub fn from_parts(
        emoji: &str,
        short: &str,
        severity: Severity,
        description: &str,
        start_offset: usize,
        end_offset: usize,
    ) -> Self {
        Self {
            badge: Badge::new(emoji, short, severity, description),
            start_offset,
            end_offset,
        }
    }

    pub fn with_owasp(mut self, category: &str) -> Self {
        self.badge.owasp_category = Some(category.to_string());
        self
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum FindingSeverity {
    Critical,
    High,
    Medium,
    Low,
    Info,
}

impl From<FindingSeverity> for Severity {
    fn from(severity: FindingSeverity) -> Self {
        match severity {
            FindingSeverity::Critical => Severity::Critical,
            FindingSeverity::High => Severity::High,
            FindingSeverity::Medium => Severity::Medium,
            FindingSeverity::Low => Severity::Low,
            FindingSeverity::Info => Severity::Info,
        }
    }
}

pub fn run_enhanced_detectors(url: &str, body: &str, headers: &str) -> Vec<Finding> {
    let mut findings = Vec::new();

    let mut header_map = HashMap::new();
    for line in headers.lines() {
        if let Some((key, value)) = line.split_once(':') {
            header_map.insert(key.trim().to_string(), value.trim().to_string());
        }
    }

    // 0. Auth Issues
    for f in detect_auth_issues(url, body, headers) {
        findings.push(
            Finding::from_parts(
                "🔒",
                &f.secret_type,
                f.severity.clone().into(),
                &f.description,
                f.start_offset,
                f.end_offset,
            )
            .with_owasp("API2:2023 Broken Authentication"),
        );
    }

    // 1. Tech Stack
    for f in detect_tech_stack_errors(body) {
        findings.push(
            Finding::from_parts(
                "🗣️",
                &f.technology,
                f.severity.clone().into(),
                &f.description,
                f.start_offset,
                f.end_offset,
            )
            .with_owasp("API8:2023 Security Misconfiguration"),
        );
    }

    // 2. Secrets
    for f in secrets::detect_secrets(body) {
        findings.push(
            Finding::from_parts(
                "🔑",
                &f.secret_type,
                f.severity.clone().into(),
                &f.description,
                f.start_offset,
                f.end_offset,
            )
            .with_owasp("API2:2023 Broken Authentication"),
        );
    }

    // 3. PII
    for f in detect_pii(body) {
        findings.push(
            Finding::from_parts(
                "👤",
                &f.secret_type,
                f.severity.clone().into(),
                &f.description,
                f.start_offset,
                f.end_offset,
            )
            .with_owasp("API3:2023 Broken Object Property Level Authorization"),
        );
    }

    // 4. Automotive
    for f in detect_automotive(body) {
        findings.push(
            Finding::from_parts(
                "🚗",
                &f.secret_type,
                f.severity.clone().into(),
                &f.description,
                f.start_offset,
                f.end_offset,
            )
            .with_owasp("API3:2023 Broken Object Property Level Authorization"),
        );
    }

    // 5. BOLA
    for f in detect_bola_patterns(url, body) {
        findings.push(
            Finding::from_parts(
                "🆔",
                "BOLA",
                f.severity.clone().into(),
                &f.description,
                f.start_offset,
                f.end_offset,
            )
            .with_owasp("API1:2023 Broken Object Level Authorization"),
        );
    }

    // 6. Headers
    for f in analyze_headers(headers, &header_map) {
        findings.push(
            Finding::from_parts(
                if f.is_missing { "🛡️" } else { "⚠️" },
                &f.header_name,
                f.severity.clone().into(),
                &f.description,
                f.start_offset,
                f.end_offset,
            )
            .with_owasp("API8:2023 Security Misconfiguration"),
        );
    }

    findings
}
