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
    #[serde(default)]
    pub owasp_category: Option<String>,
    #[serde(default)]
    pub evidence: Option<String>,
    #[serde(default)]
    pub start: Option<usize>,
    #[serde(default)]
    pub end: Option<usize>,
    #[serde(default)]
    pub is_fp: bool,
    #[serde(default)]
    pub fp_reason: Option<String>,
}

impl Badge {
    pub fn new(emoji: &str, short: &str, severity: Severity, description: &str) -> Self {
        Self {
            emoji: emoji.to_string(),
            short: short.to_string(),
            severity,
            description: description.to_string(),
            owasp_category: None,
            evidence: None,
            start: None,
            end: None,
            is_fp: false,
            fp_reason: None,
        }
    }

    pub fn with_owasp(mut self, category: &str) -> Self {
        self.owasp_category = Some(category.to_string());
        self
    }

    pub fn with_location(mut self, evidence: &str, start: usize, end: usize) -> Self {
        self.evidence = Some(evidence.to_string());
        self.start = Some(start);
        self.end = Some(end);
        self
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VariableCapture {
    pub name: String,
    pub source: String, // e.g. "json:body.id" or "header:Authorization"
    pub regex: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SequenceStep {
    pub id: i64, // Maps to DB ID
    pub sequence_id: String,
    pub asset_id: i64,
    pub method: String,
    pub url: String,
    pub status_code: i32,
    pub request_body: Option<String>,
    pub response_body: Option<String>,
    pub request_headers: Option<String>,
    pub response_headers: Option<String>,
    pub timestamp: String,
    #[serde(default)]
    pub captures: Vec<VariableCapture>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestSequence {
    pub id: String, // UUID
    pub flow_name: Option<String>,
    pub steps: Vec<SequenceStep>,
    pub created_at: String,
    pub context_summary: Option<String>, // LLM-generated summary of the flow so far
}
