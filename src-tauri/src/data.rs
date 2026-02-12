use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum Severity {
    Critical,
    High,
    Medium,
    Low,
    Info,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Badge {
    pub emoji: String,
    pub short: String,
    pub severity: Severity,
    pub description: String,
}

impl Badge {
    pub fn new(emoji: &str, short: &str, severity: Severity, description: &str) -> Self {
        Self {
            emoji: emoji.to_string(),
            short: short.to_string(),
            severity,
            description: description.to_string(),
        }
    }
}
