use crate::db::{Badge, Severity};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};

#[allow(dead_code)]
/// Finding with offset information for precise masking
/// Extends Badge with start and end character positions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Finding {
    #[serde(flatten)]
    pub badge: Badge,
    pub start_offset: usize,
    pub end_offset: usize,
}

#[allow(dead_code)]
impl Finding {
    pub fn new(badge: Badge, start_offset: usize, end_offset: usize) -> Self {
        Self {
            badge,
            start_offset,
            end_offset,
        }
    }

    /// Create a Finding from Badge components with offsets
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
}

pub fn analyze(body: &str, status: u16, method: &str, headers: &str) -> Vec<Badge> {
    let mut badges = Vec::new();
    let lower_body = body.to_lowercase();
    let lower_headers = headers.to_lowercase();

    // 1. Critical Infrastructure & Injection (Red / Critical)

    // Automotive Data
    let vin_regex = Regex::new(r"\b[(A-H|J-N|P|R-Z|0-9)]{17}\b").unwrap();
    if vin_regex.is_match(body)
        || lower_body.contains("telemetry")
        || lower_body.contains("odometer")
        || lower_body.contains("gnss")
        || lower_body.contains("canbus")
        || lower_body.contains("ecu_id")
    {
        badges.push(Badge::new(
            "🚗",
            "Auto",
            Severity::Critical,
            "Automotive data (VIN/CANbus/Telemetry) detected in response context.",
        ));
    }

    // Critical Injection
    if lower_body.contains("sql syntax")
        || lower_body.contains("ora-")
        || lower_body.contains("mysql")
        || lower_body.contains("syntax error")
        || lower_body.contains("postgresql")
    {
        badges.push(Badge::new(
            "💉",
            "SQLi",
            Severity::Critical,
            "Potential SQL Injection detected via error message or database signature.",
        ));
    }

    if lower_body.contains("eval()")
        || lower_body.contains("system()")
        || lower_body.contains("root:")
        || lower_body.contains("/bin/sh")
        || lower_body.contains("cmd.exe")
        || lower_body.contains("bash -i")
        || lower_body.contains("/etc/passwd")
    {
        badges.push(Badge::new(
            "💣",
            "RCE",
            Severity::Critical,
            "Remote Code Execution (RCE) primitive or system call detected.",
        ));
    }

    // Command Injection Fragments
    if lower_body.contains("; whoami")
        || lower_body.contains("& whoami")
        || lower_body.contains("| whoami")
        || lower_body.contains("; ls")
        || lower_body.contains("& ls")
        || lower_body.contains("| ls")
    {
        badges.push(Badge::new(
            "🐚",
            "CmdInj",
            Severity::Critical,
            "OS Command Injection fragment detected in response.",
        ));
    }

    if lower_body.contains("metadata service")
        || lower_body.contains("169.254")
        || lower_body.contains("compute.internal")
        || lower_body.contains("metadata.google.internal")
    {
        badges.push(Badge::new(
            "🌩️",
            "SSRF",
            Severity::Critical,
            "Server-Side Request Forgery logic or Cloud Metadata leak detected.",
        ));
    }

    if lower_body.contains("<!entity")
        || lower_body.contains("<!doctype")
        || lower_body.contains("system \"file://")
    {
        badges.push(Badge::new(
            "📑",
            "XXE",
            Severity::Critical,
            "XML External Entity (XXE) pattern or local file access detected.",
        ));
    }

    // 2. Identity, Finance & Compliance (Orange / High)

    // PCI-DSS
    let cc_regex = Regex::new(r"\b(?:\d[ -]*?){13,19}\b").unwrap();
    if cc_regex.is_match(body)
        || lower_body.contains("cvv")
        || lower_body.contains("track2")
        || lower_body.contains("pan")
    {
        badges.push(Badge::new(
            "💳",
            "PCI",
            Severity::High,
            "PCI-DSS violation: Credit Card number, CVV or Track data detected.",
        ));
    }

    // HIPAA / Healthcare
    let npi_regex = Regex::new(r"\b\d{10}\b").unwrap(); // Simplified NPI
    if npi_regex.is_match(body)
        && (lower_body.contains("patient")
            || lower_body.contains("medical")
            || lower_body.contains("clinic"))
        || lower_body.contains("phi")
        || lower_body.contains("icd-10")
        || lower_body.contains("healthcare")
    {
        badges.push(Badge::new(
            "🏥",
            "HIPAA",
            Severity::High,
            "Health/PHI data detected. Potential HIPAA compliance violation.",
        ));
    }

    // JWT Weaknesses
    if lower_body.contains("eyj0e") || lower_body.contains("eyJhbGciOiJub25lIn0") {
        badges.push(Badge::new(
            "🎟️",
            "JWT",
            Severity::High,
            "Weak JWT detected (potential 'alg:none' or exposed token).",
        ));
    }

    // BOLA / IDOR Patterns
    if lower_body.contains("\"user_id\"")
        || lower_body.contains("\"account_id\"")
        || lower_body.contains("\"customer_id\"")
    {
        let id_pattern = Regex::new(r#""(?:user|account|customer)_id"\s*:\s*\d{1,8}"#).unwrap();
        if id_pattern.is_match(body) {
            badges.push(Badge::new(
                "🆔",
                "BOLA",
                Severity::High,
                "Potential BOLA/IDOR: Predictable internal identifier exposed in JSON.",
            ));
        }
    }

    // 3. Privacy, Secrets & Logic (Yellow / Medium)

    // PII
    let email_regex = Regex::new(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}").unwrap();
    if email_regex.is_match(body)
        || lower_body.contains("ssn")
        || lower_body.contains("first_name")
        || lower_body.contains("last_name")
        || lower_body.contains("dob")
        || lower_body.contains("phone_number")
    {
        badges.push(Badge::new(
            "👤",
            "PII",
            Severity::Medium,
            "Personally Identifiable Information (PII) detected (Email/Name/SSN).",
        ));
    }

    // Secrets
    if lower_body.contains("api_key")
        || lower_body.contains("bearer ")
        || lower_body.contains("aws_secret")
        || lower_body.contains("private_key")
        || lower_body.contains("begin rsa private key")
        || lower_body.contains("client_secret")
    {
        badges.push(Badge::new(
            "🔑",
            "Key",
            Severity::Medium,
            "Hardcoded Secret found: API Key, Bearer Token, or Private Key detected.",
        ));
    }

    // Mass Assignment Risk
    if lower_body.contains("\"isadmin\"")
        || lower_body.contains("\"is_admin\"")
        || lower_body.contains("\"role\"")
        || lower_body.contains("\"privilege\"")
    {
        badges.push(Badge::new(
            "📦",
            "MassAssign",
            Severity::Medium,
            "Potential Mass Assignment: Sensitive administrative keys found in JSON.",
        ));
    }

    // Legal & Compliance
    if lower_body.contains("gdpr")
        || lower_body.contains("privacy policy")
        || lower_body.contains("terms of service")
        || lower_body.contains("disclaimer")
    {
        badges.push(Badge::new(
            "⚖️",
            "Legal",
            Severity::Medium,
            "Legal/Compliance data detected (GDPR, TOS, or Legal Disclaimer).",
        ));
    }

    // DB Dump
    if lower_body.contains(".sql")
        || lower_body.contains("dump")
        || lower_body.contains("insert into")
    {
        badges.push(Badge::new(
            "💾",
            "Dump",
            Severity::Medium,
            "Database Dump or Backup file leak detected.",
        ));
    }

    // 4. Configuration & Infrastructure (Blue / Low)

    // 6. Verbose Errors / Stack Traces
    if lower_body.contains("stack trace")
        || lower_body.contains("at std::")
        || lower_body.contains("exception in thread")
        || lower_body.contains("traceback (most recent call last)")
        || lower_body.contains("debug: true")
        || lower_body.contains("console.log")
    {
        badges.push(Badge::new(
            "🗣️",
            "Verbose",
            Severity::Medium,
            "Verbose Error: Stack trace or internal implementation details leaked.",
        ));
    }

    // Directory Listing
    if lower_body.contains("index of /") || lower_body.contains("parent directory") {
        badges.push(Badge::new(
            "📂",
            "Dir",
            Severity::Low,
            "Directory Listing enabled: Server exposed internal file structure.",
        ));
    }

    // Security Headers & Info Leak
    // 7. Security Headers / Infrastructure info (Modified from 4)
    if lower_headers.contains("server:") || lower_headers.contains("x-powered-by:") {
        badges.push(Badge::new(
            "ℹ️",
            "Infra",
            Severity::Info,
            "Infrastructure Info: Server version headers are present.",
        ));
    }

    if !lower_headers.contains("strict-transport-security")
        || !lower_headers.contains("content-security-policy")
    {
        badges.push(Badge::new(
            "🛡️",
            "SecHeaders",
            Severity::Low,
            "Missing Security Headers: HSTS or CSP headers are not present.",
        ));
    }

    // Unsafe Methods
    if (method == "PUT" || method == "DELETE" || method == "PATCH") && status < 400 {
        badges.push(Badge::new(
            "⚠️",
            "Method",
            Severity::Low,
            "Unsafe HTTP Method permitted on public endpoint without error.",
        ));
    }

    // 5. Status Related (Moved to independent tags for UI filtering)
    if status == 401 || lower_body.contains("invalid token") || lower_body.contains("unauthorized")
    {
        badges.push(Badge::new(
            "🔒",
            "Auth",
            Severity::High,
            "Broken Authentication: Endpoint returned 401 or invalid token error.",
        ));
    }
    if status == 403 || lower_body.contains("access denied") || lower_body.contains("forbidden") {
        badges.push(Badge::new(
            "🚫",
            "403",
            Severity::High,
            "Broken Access Control: Unauthorized access attempt resulted in 403 Forbidden.",
        ));
    }
    if status == 429 || lower_headers.contains("retry-after") {
        badges.push(Badge::new(
            "⏱️",
            "Rate",
            Severity::High,
            "Rate Limiting: API is throttling requests (Status 429).",
        ));
    }

    badges
}

// Legacy function to maintain compatibility during migration
pub fn classify_vulnerability(finding: &str) -> Option<Badge> {
    let badges = analyze(finding, 0, "GET", "");
    badges.into_iter().next()
}

/// Analyze content and return findings with offset information for precise masking
/// This function tracks the start and end positions of each finding in the content
#[allow(dead_code)]
pub fn analyze_with_offsets(body: &str, status: u16, method: &str, headers: &str) -> Vec<Finding> {
    let mut findings = Vec::new();
    let _lower_body = body.to_lowercase();
    let lower_headers = headers.to_lowercase();

    // 1. Critical Infrastructure & Auto (Red / Critical)

    // Automotive Data
    let vin_regex = Regex::new(r"\b[(A-H|J-N|P|R-Z|0-9)]{17}\b").unwrap();
    if let Some(m) = vin_regex.find(body) {
        findings.push(Finding::from_parts(
            "🚗",
            "Auto",
            Severity::Critical,
            "Automotive data (VIN/CANbus/Telemetry) detected in response context.",
            m.start(),
            m.end(),
        ));
    }
    if let Some(pos) = find_case_insensitive(body, "telemetry") {
        findings.push(Finding::from_parts(
            "🚗",
            "Auto",
            Severity::Critical,
            "Automotive data (VIN/CANbus/Telemetry) detected in response context.",
            pos.0,
            pos.1,
        ));
    }
    if let Some(pos) = find_case_insensitive(body, "odometer") {
        findings.push(Finding::from_parts(
            "🚗",
            "Auto",
            Severity::Critical,
            "Automotive data (VIN/CANbus/Telemetry) detected in response context.",
            pos.0,
            pos.1,
        ));
    }
    if let Some(pos) = find_case_insensitive(body, "gnss") {
        findings.push(Finding::from_parts(
            "🚗",
            "Auto",
            Severity::Critical,
            "Automotive data (VIN/CANbus/Telemetry) detected in response context.",
            pos.0,
            pos.1,
        ));
    }
    if let Some(pos) = find_case_insensitive(body, "canbus") {
        findings.push(Finding::from_parts(
            "🚗",
            "Auto",
            Severity::Critical,
            "Automotive data (VIN/CANbus/Telemetry) detected in response context.",
            pos.0,
            pos.1,
        ));
    }
    if let Some(pos) = find_case_insensitive(body, "ecu_id") {
        findings.push(Finding::from_parts(
            "🚗",
            "Auto",
            Severity::Critical,
            "Automotive data (VIN/CANbus/Telemetry) detected in response context.",
            pos.0,
            pos.1,
        ));
    }

    // Critical Injection - SQLi
    if let Some(pos) = find_case_insensitive(body, "sql syntax") {
        findings.push(Finding::from_parts(
            "💉",
            "SQLi",
            Severity::Critical,
            "Potential SQL Injection detected via error message or database signature.",
            pos.0,
            pos.1,
        ));
    }
    if let Some(pos) = find_case_insensitive(body, "ora-") {
        findings.push(Finding::from_parts(
            "💉",
            "SQLi",
            Severity::Critical,
            "Potential SQL Injection detected via error message or database signature.",
            pos.0,
            pos.1,
        ));
    }
    if let Some(pos) = find_case_insensitive(body, "mysql") {
        findings.push(Finding::from_parts(
            "💉",
            "SQLi",
            Severity::Critical,
            "Potential SQL Injection detected via error message or database signature.",
            pos.0,
            pos.1,
        ));
    }
    if let Some(pos) = find_case_insensitive(body, "syntax error") {
        findings.push(Finding::from_parts(
            "💉",
            "SQLi",
            Severity::Critical,
            "Potential SQL Injection detected via error message or database signature.",
            pos.0,
            pos.1,
        ));
    }
    if let Some(pos) = find_case_insensitive(body, "postgresql") {
        findings.push(Finding::from_parts(
            "💉",
            "SQLi",
            Severity::Critical,
            "Potential SQL Injection detected via error message or database signature.",
            pos.0,
            pos.1,
        ));
    }

    // Critical Injection - RCE
    if let Some(pos) = find_case_insensitive(body, "eval()") {
        findings.push(Finding::from_parts(
            "💣",
            "RCE",
            Severity::Critical,
            "Remote Code Execution (RCE) primitive or system call detected.",
            pos.0,
            pos.1,
        ));
    }
    if let Some(pos) = find_case_insensitive(body, "system()") {
        findings.push(Finding::from_parts(
            "💣",
            "RCE",
            Severity::Critical,
            "Remote Code Execution (RCE) primitive or system call detected.",
            pos.0,
            pos.1,
        ));
    }
    if let Some(pos) = find_case_insensitive(body, "root:") {
        findings.push(Finding::from_parts(
            "💣",
            "RCE",
            Severity::Critical,
            "Remote Code Execution (RCE) primitive or system call detected.",
            pos.0,
            pos.1,
        ));
    }
    if let Some(pos) = find_case_insensitive(body, "/bin/sh") {
        findings.push(Finding::from_parts(
            "💣",
            "RCE",
            Severity::Critical,
            "Remote Code Execution (RCE) primitive or system call detected.",
            pos.0,
            pos.1,
        ));
    }
    if let Some(pos) = find_case_insensitive(body, "cmd.exe") {
        findings.push(Finding::from_parts(
            "💣",
            "RCE",
            Severity::Critical,
            "Remote Code Execution (RCE) primitive or system call detected.",
            pos.0,
            pos.1,
        ));
    }

    // Critical Injection - SSRF
    if let Some(pos) = find_case_insensitive(body, "metadata service") {
        findings.push(Finding::from_parts(
            "🌩️",
            "SSRF",
            Severity::Critical,
            "Server-Side Request Forgery logic or Cloud Metadata leak detected.",
            pos.0,
            pos.1,
        ));
    }
    if let Some(pos) = find_case_insensitive(body, "169.254") {
        findings.push(Finding::from_parts(
            "🌩️",
            "SSRF",
            Severity::Critical,
            "Server-Side Request Forgery logic or Cloud Metadata leak detected.",
            pos.0,
            pos.1,
        ));
    }
    if let Some(pos) = find_case_insensitive(body, "compute.internal") {
        findings.push(Finding::from_parts(
            "🌩️",
            "SSRF",
            Severity::Critical,
            "Server-Side Request Forgery logic or Cloud Metadata leak detected.",
            pos.0,
            pos.1,
        ));
    }
    if let Some(pos) = find_case_insensitive(body, "metadata.google.internal") {
        findings.push(Finding::from_parts(
            "🌩️",
            "SSRF",
            Severity::Critical,
            "Server-Side Request Forgery logic or Cloud Metadata leak detected.",
            pos.0,
            pos.1,
        ));
    }

    // Critical Injection - XXE
    if let Some(pos) = find_case_insensitive(body, "entity") {
        findings.push(Finding::from_parts(
            "📄",
            "XXE",
            Severity::Critical,
            "XML External Entity (XXE) pattern or local file access detected.",
            pos.0,
            pos.1,
        ));
    }
    if let Some(pos) = find_case_insensitive(body, "system") {
        findings.push(Finding::from_parts(
            "📄",
            "XXE",
            Severity::Critical,
            "XML External Entity (XXE) pattern or local file access detected.",
            pos.0,
            pos.1,
        ));
    }
    if let Some(pos) = find_case_insensitive(body, "file://") {
        findings.push(Finding::from_parts(
            "📄",
            "XXE",
            Severity::Critical,
            "XML External Entity (XXE) pattern or local file access detected.",
            pos.0,
            pos.1,
        ));
    }
    if let Some(pos) = find_case_insensitive(body, "saxparser") {
        findings.push(Finding::from_parts(
            "📄",
            "XXE",
            Severity::Critical,
            "XML External Entity (XXE) pattern or local file access detected.",
            pos.0,
            pos.1,
        ));
    }

    // 2. Finance & Compliance (Orange / High)

    // PCI-DSS - Credit Card
    let cc_regex = Regex::new(r"\b(?:\d[ -]*?){13,19}\b").unwrap();
    if let Some(m) = cc_regex.find(body) {
        findings.push(Finding::from_parts(
            "💳",
            "PCI",
            Severity::High,
            "PCI-DSS violation: Credit Card number, CVV or Track data detected.",
            m.start(),
            m.end(),
        ));
    }
    if let Some(pos) = find_case_insensitive(body, "cvv") {
        findings.push(Finding::from_parts(
            "💳",
            "PCI",
            Severity::High,
            "PCI-DSS violation: Credit Card number, CVV or Track data detected.",
            pos.0,
            pos.1,
        ));
    }
    if let Some(pos) = find_case_insensitive(body, "track2") {
        findings.push(Finding::from_parts(
            "💳",
            "PCI",
            Severity::High,
            "PCI-DSS violation: Credit Card number, CVV or Track data detected.",
            pos.0,
            pos.1,
        ));
    }
    if let Some(pos) = find_case_insensitive(body, "pan") {
        findings.push(Finding::from_parts(
            "💳",
            "PCI",
            Severity::High,
            "PCI-DSS violation: Credit Card number, CVV or Track data detected.",
            pos.0,
            pos.1,
        ));
    }

    // Auth - 401
    if status == 401 {
        findings.push(Finding::new(
            Badge::new(
                "🔒",
                "Auth",
                Severity::High,
                "Broken Authentication: Endpoint returned 401 or invalid token error.",
            ),
            0,
            0,
        ));
    }
    if let Some(pos) = find_case_insensitive(body, "invalid token") {
        findings.push(Finding::from_parts(
            "🔒",
            "Auth",
            Severity::High,
            "Broken Authentication: Endpoint returned 401 or invalid token error.",
            pos.0,
            pos.1,
        ));
    }
    if let Some(pos) = find_case_insensitive(body, "unauthorized") {
        findings.push(Finding::from_parts(
            "🔒",
            "Auth",
            Severity::High,
            "Broken Authentication: Endpoint returned 401 or invalid token error.",
            pos.0,
            pos.1,
        ));
    }

    // Auth - 403
    if status == 403 {
        findings.push(Finding::new(
            Badge::new(
                "🚫",
                "403",
                Severity::High,
                "Broken Access Control: Unauthorized access attempt resulted in 403 Forbidden.",
            ),
            0,
            0,
        ));
    }
    if let Some(pos) = find_case_insensitive(body, "access denied") {
        findings.push(Finding::from_parts(
            "🚫",
            "403",
            Severity::High,
            "Broken Access Control: Unauthorized access attempt resulted in 403 Forbidden.",
            pos.0,
            pos.1,
        ));
    }
    if let Some(pos) = find_case_insensitive(body, "forbidden") {
        findings.push(Finding::from_parts(
            "🚫",
            "403",
            Severity::High,
            "Broken Access Control: Unauthorized access attempt resulted in 403 Forbidden.",
            pos.0,
            pos.1,
        ));
    }

    // Rate Limiting
    if status == 429 || lower_headers.contains("retry-after") {
        findings.push(Finding::new(
            Badge::new(
                "⏱️",
                "Rate",
                Severity::High,
                "Rate Limiting: API is throttling requests (Status 429).",
            ),
            0,
            0,
        ));
    }

    // 3. Privacy & Secrets (Yellow / Medium)

    // PII
    let email_regex = Regex::new(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}").unwrap();
    if let Some(m) = email_regex.find(body) {
        findings.push(Finding::from_parts(
            "👤",
            "PII",
            Severity::Medium,
            "Personally Identifiable Information (PII) detected (Email/Name/SSN).",
            m.start(),
            m.end(),
        ));
    }
    if let Some(pos) = find_case_insensitive(body, "ssn") {
        findings.push(Finding::from_parts(
            "👤",
            "PII",
            Severity::Medium,
            "Personally Identifiable Information (PII) detected (Email/Name/SSN).",
            pos.0,
            pos.1,
        ));
    }
    if let Some(pos) = find_case_insensitive(body, "first_name") {
        findings.push(Finding::from_parts(
            "👤",
            "PII",
            Severity::Medium,
            "Personally Identifiable Information (PII) detected (Email/Name/SSN).",
            pos.0,
            pos.1,
        ));
    }
    if let Some(pos) = find_case_insensitive(body, "dob") {
        findings.push(Finding::from_parts(
            "👤",
            "PII",
            Severity::Medium,
            "Personally Identifiable Information (PII) detected (Email/Name/SSN).",
            pos.0,
            pos.1,
        ));
    }
    if let Some(pos) = find_case_insensitive(body, "phone") {
        findings.push(Finding::from_parts(
            "👤",
            "PII",
            Severity::Medium,
            "Personally Identifiable Information (PII) detected (Email/Name/SSN).",
            pos.0,
            pos.1,
        ));
    }

    // Secrets
    if let Some(pos) = find_case_insensitive(body, "api_key") {
        findings.push(Finding::from_parts(
            "🔑",
            "Key",
            Severity::Medium,
            "Hardcoded Secret found: API Key, Bearer Token, or Private Key detected.",
            pos.0,
            pos.1,
        ));
    }
    if let Some(pos) = find_case_insensitive(body, "bearer") {
        findings.push(Finding::from_parts(
            "🔑",
            "Key",
            Severity::Medium,
            "Hardcoded Secret found: API Key, Bearer Token, or Private Key detected.",
            pos.0,
            pos.1,
        ));
    }
    if let Some(pos) = find_case_insensitive(body, "aws_secret") {
        findings.push(Finding::from_parts(
            "🔑",
            "Key",
            Severity::Medium,
            "Hardcoded Secret found: API Key, Bearer Token, or Private Key detected.",
            pos.0,
            pos.1,
        ));
    }
    if let Some(pos) = find_case_insensitive(body, "private_key") {
        findings.push(Finding::from_parts(
            "🔑",
            "Key",
            Severity::Medium,
            "Hardcoded Secret found: API Key, Bearer Token, or Private Key detected.",
            pos.0,
            pos.1,
        ));
    }
    if let Some(pos) = find_case_insensitive(body, "begin rsa private key") {
        findings.push(Finding::from_parts(
            "🔑",
            "Key",
            Severity::Medium,
            "Hardcoded Secret found: API Key, Bearer Token, or Private Key detected.",
            pos.0,
            pos.1,
        ));
    }

    // DB Dump
    if let Some(pos) = find_case_insensitive(body, ".sql") {
        findings.push(Finding::from_parts(
            "💾",
            "Dump",
            Severity::Medium,
            "Database Dump or Backup file leak detected.",
            pos.0,
            pos.1,
        ));
    }
    if let Some(pos) = find_case_insensitive(body, "dump") {
        findings.push(Finding::from_parts(
            "💾",
            "Dump",
            Severity::Medium,
            "Database Dump or Backup file leak detected.",
            pos.0,
            pos.1,
        ));
    }
    if let Some(pos) = find_case_insensitive(body, "insert into") {
        findings.push(Finding::from_parts(
            "💾",
            "Dump",
            Severity::Medium,
            "Database Dump or Backup file leak detected.",
            pos.0,
            pos.1,
        ));
    }

    // 4. Configuration (Blue / Low)

    // Debug
    if let Some(pos) = find_case_insensitive(body, "traceback") {
        findings.push(Finding::from_parts(
            "🐛",
            "Debug",
            Severity::Low,
            "Debug Mode active: Stack trace or verbose internal logging detected.",
            pos.0,
            pos.1,
        ));
    }
    if let Some(pos) = find_case_insensitive(body, "stack trace") {
        findings.push(Finding::from_parts(
            "🐛",
            "Debug",
            Severity::Low,
            "Debug Mode active: Stack trace or verbose internal logging detected.",
            pos.0,
            pos.1,
        ));
    }
    if let Some(pos) = find_case_insensitive(body, "debug") {
        findings.push(Finding::from_parts(
            "🐛",
            "Debug",
            Severity::Low,
            "Debug Mode active: Stack trace or verbose internal logging detected.",
            pos.0,
            pos.1,
        ));
    }
    if let Some(pos) = find_case_insensitive(body, "console.log") {
        findings.push(Finding::from_parts(
            "🐛",
            "Debug",
            Severity::Low,
            "Debug Mode active: Stack trace or verbose internal logging detected.",
            pos.0,
            pos.1,
        ));
    }

    // Directory Listing
    if let Some(pos) = find_case_insensitive(body, "index of /") {
        findings.push(Finding::from_parts(
            "📂",
            "Dir",
            Severity::Low,
            "Directory Listing enabled: Server exposed internal file structure.",
            pos.0,
            pos.1,
        ));
    }
    if let Some(pos) = find_case_insensitive(body, "parent directory") {
        findings.push(Finding::from_parts(
            "📂",
            "Dir",
            Severity::Low,
            "Directory Listing enabled: Server exposed internal file structure.",
            pos.0,
            pos.1,
        ));
    }

    // Unsafe Methods
    if (method == "PUT" || method == "DELETE") && status < 400 {
        findings.push(Finding::new(
            Badge::new(
                "⚠️",
                "Method",
                Severity::Low,
                "Unsafe HTTP Method (PUT/DELETE) permitted on public endpoint.",
            ),
            0,
            0,
        ));
    }

    // Docs
    if status == 200 {
        if let Some(pos) = find_case_insensitive(body, "\"swagger\":") {
            findings.push(Finding::from_parts(
                "📜",
                "Docs",
                Severity::Info,
                "API Documentation endpoint found (Swagger/OpenAPI).",
                pos.0,
                pos.1,
            ));
        }
        if let Some(pos) = find_case_insensitive(body, "\"openapi\":") {
            findings.push(Finding::from_parts(
                "📜",
                "Docs",
                Severity::Info,
                "API Documentation endpoint found (Swagger/OpenAPI).",
                pos.0,
                pos.1,
            ));
        }
        if let Some(pos) = find_case_insensitive(body, "swagger-ui") {
            findings.push(Finding::from_parts(
                "📜",
                "Docs",
                Severity::Info,
                "API Documentation endpoint found (Swagger/OpenAPI).",
                pos.0,
                pos.1,
            ));
        }
        if let Some(pos) = find_case_insensitive(body, "api-docs") {
            findings.push(Finding::from_parts(
                "📜",
                "Docs",
                Severity::Info,
                "API Documentation endpoint found (Swagger/OpenAPI).",
                pos.0,
                pos.1,
            ));
        }
    }

    // --- BUSINESS LOGIC & PRICE MANIPULATION ---
    let logic_keywords = [
        ("price", "Potential Price Manipulation"),
        ("discount", "Discount Logic Check"),
        ("amount", "Sensitive Amount Field"),
        ("quantity", "Quantity Logic Vector"),
        ("balance", "Balance Inquiry/Update"),
        ("limit", "Rate/Amount Limit Check"),
        ("max", "Maximum Value Logic"),
    ];

    let body_lower = body.to_lowercase();
    for (kw, _name) in logic_keywords {
        if body_lower.contains(kw) && (method == "POST" || method == "PUT" || method == "PATCH") {
            if let Some(pos) = find_case_insensitive(body, kw) {
                findings.push(Finding::from_parts(
                    "⚖️",
                    "Logic",
                    Severity::Medium,
                    &format!("Request contains sensitive keyword '{}' in a state-changing operation. Verify logic for manipulation (e.g., negative amounts, price override).", kw),
                    pos.0,
                    pos.1,
                ));
            }
        }
    }

    if status == 200
        && (body.contains("\"success\":true") || body.contains("\"ok\":true"))
        && method == "GET"
    {
        // Just an info badge for potential race condition targets
        if body_lower.contains("status") || body_lower.contains("state") {
            if let Some(pos) = find_case_insensitive(body, "status")
                .or_else(|| find_case_insensitive(body, "state"))
            {
                findings.push(Finding::from_parts(
                    "🏁",
                    "Race",
                    Severity::Info,
                    "This endpoint returns state/status. If it's part of a multi-step flow, check for race conditions.",
                    pos.0,
                    pos.1,
                ));
            }
        }
    }

    // Open Access
    if findings.is_empty() && status == 200 {
        findings.push(Finding::new(
            Badge::new(
                "🌍",
                "Open",
                Severity::Info,
                "Public Access: Endpoint is open and returned 200 OK.",
            ),
            0,
            0,
        ));
    }

    findings
}

/// Helper function to find case-insensitive substring and return its position
#[allow(dead_code)]
fn find_case_insensitive(haystack: &str, needle: &str) -> Option<(usize, usize)> {
    let lower_haystack = haystack.to_lowercase();
    if let Some(pos) = lower_haystack.find(&needle.to_lowercase()) {
        Some((pos, pos + needle.len()))
    } else {
        None
    }
}

// ============================================================================
// ENHANCED SECURITY DETECTION CAPABILITIES
// ============================================================================

// -----------------
// DATA STRUCTURES
// -----------------

/// Severity level for security findings
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

/// Represents a detected secret or PII finding
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecretFinding {
    /// Type of secret detected (e.g., "AWS Access Key", "SSN", "Credit Card")
    pub secret_type: String,
    /// Severity of the finding
    pub severity: FindingSeverity,
    /// The matched pattern value (masked for display)
    pub matched_value: String,
    /// Start offset in the original content
    pub start_offset: usize,
    /// End offset in the original content
    pub end_offset: usize,
    /// Confidence level (0.0-1.0)
    pub confidence: f64,
    /// Additional context or remediation advice
    pub description: String,
}

/// Represents a security header finding
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HeaderFinding {
    /// Name of the header
    pub header_name: String,
    /// Current value (if present)
    pub current_value: Option<String>,
    /// Whether the header is missing
    pub is_missing: bool,
    /// Whether the header has a weak/insecure value
    pub is_weak: bool,
    /// Severity of the finding
    pub severity: FindingSeverity,
    /// Description of the issue
    pub description: String,
    /// Recommended value or action
    pub recommendation: String,
}

/// Represents a BOLA/IDOR vulnerability finding
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BolaFinding {
    /// Type of BOLA/IDOR pattern detected
    pub finding_type: String,
    /// Severity of the finding
    pub severity: FindingSeverity,
    /// The URL or pattern where the issue was found
    pub location: String,
    /// Description of the vulnerability
    pub description: String,
    /// The resource ID pattern detected
    pub resource_pattern: String,
    /// Whether the ID is predictable (integer vs UUID)
    pub is_predictable: bool,
    /// Remediation advice
    pub remediation: String,
}

/// Represents a verbose error/tech stack disclosure finding
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorFinding {
    /// Technology/framework detected
    pub technology: String,
    /// Type of error disclosure
    pub error_type: String,
    /// Severity of the finding
    pub severity: FindingSeverity,
    /// Description of the finding
    pub description: String,
    /// The matched signature or pattern
    pub matched_pattern: String,
    /// Start offset in content
    pub start_offset: usize,
    /// End offset in content
    pub end_offset: usize,
}

// -----------------
// ENTROPY CALCULATION
// -----------------

/// Calculate Shannon entropy of a string
/// Returns a value between 0.0 (no entropy) and 8.0 (maximum entropy for bytes)
/// High entropy (> 4.5) often indicates encoded/encrypted content like secrets
#[allow(dead_code)]
pub fn calculate_entropy(s: &str) -> f64 {
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

/// Check if a string appears to be base64-encoded with high entropy
/// Returns true if the string looks like base64 and has entropy > 4.5
#[allow(dead_code)]
pub fn is_high_entropy_base64(s: &str) -> bool {
    // Check if it looks like base64 (alphanumeric + /+ and =)
    let base64_pattern = Regex::new(r"^[A-Za-z0-9+/]+=*$").unwrap();
    if !base64_pattern.is_match(s) {
        return false;
    }

    // Minimum length to be meaningful
    if s.len() < 20 {
        return false;
    }

    calculate_entropy(s) > 4.5
}

/// Detect high-entropy strings that might be secrets
#[allow(dead_code)]
pub fn detect_high_entropy_secrets(content: &str) -> Vec<SecretFinding> {
    let mut findings = Vec::new();

    // Pattern to find potential base64 strings
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
                confidence: ((entropy - 4.5) / 3.5).min(1.0), // Scale confidence based on entropy
                description: format!(
                    "High-entropy string detected (entropy: {:.2}). Potentially encoded secret or API key.",
                    entropy
                ),
            });
        }
    }

    findings
}

// -----------------
// ENHANCED SECRETS DETECTION
// -----------------

/// Secret pattern definition
#[allow(dead_code)]
struct SecretPattern {
    name: &'static str,
    pattern: &'static str,
    severity: FindingSeverity,
    confidence: f64,
    description: &'static str,
}

/// Get all secret patterns for detection
#[allow(dead_code)]
fn get_secret_patterns() -> Vec<SecretPattern> {
    vec![
        // === CLOUD PROVIDER SECRETS ===
        SecretPattern {
            name: "AWS Access Key ID",
            pattern: r"AKIA[0-9A-Z]{16}",
            severity: FindingSeverity::Critical,
            confidence: 0.95,
            description: "AWS Access Key ID detected. This credential can be used to access AWS services.",
        },
        SecretPattern {
            name: "AWS Secret Access Key",
            pattern: r#"(?i)aws(.{0,20})?['"][0-9a-zA-Z/+=]{40}['"]"#,
            severity: FindingSeverity::Critical,
            confidence: 0.90,
            description: "AWS Secret Access Key detected. This is a critical cloud credential.",
        },
        SecretPattern {
            name: "Google API Key",
            pattern: r"AIza[0-9A-Za-z\-_]{35}",
            severity: FindingSeverity::Critical,
            confidence: 0.95,
            description: "Google API Key detected. Can be used to access Google Cloud services.",
        },
        SecretPattern {
            name: "Google OAuth Client ID",
            pattern: r"[0-9]+-[0-9A-Za-z_]{32}\.apps\.googleusercontent\.com",
            severity: FindingSeverity::High,
            confidence: 0.90,
            description: "Google OAuth Client ID detected. May be used for authentication bypass.",
        },
        SecretPattern {
            name: "GitHub Personal Access Token",
            pattern: r"ghp_[0-9a-zA-Z]{36}",
            severity: FindingSeverity::Critical,
            confidence: 0.95,
            description: "GitHub Personal Access Token detected. Can access repositories and data.",
        },
        SecretPattern {
            name: "GitHub Fine-grained Token",
            pattern: r"github_pat_[0-9a-zA-Z_]{22,}",
            severity: FindingSeverity::Critical,
            confidence: 0.95,
            description: "GitHub Fine-grained Personal Access Token detected.",
        },
        SecretPattern {
            name: "GitHub OAuth Access Token",
            pattern: r"gho_[0-9a-zA-Z]{36}",
            severity: FindingSeverity::Critical,
            confidence: 0.95,
            description: "GitHub OAuth Access Token detected.",
        },
        SecretPattern {
            name: "GitHub App Token",
            pattern: r"(?:ghu|ghs)_[0-9a-zA-Z]{36}",
            severity: FindingSeverity::Critical,
            confidence: 0.95,
            description: "GitHub App Token detected.",
        },
        SecretPattern {
            name: "Slack Bot Token",
            pattern: r"xoxb-[0-9]{10,12}-[0-9]{10,12}-[0-9a-zA-Z]{24}",
            severity: FindingSeverity::Critical,
            confidence: 0.95,
            description: "Slack Bot Token detected. Can access Slack workspace data.",
        },
        SecretPattern {
            name: "Slack App Token",
            pattern: r"xoxa-[0-9]{10,12}-[0-9]{10,12}-[0-9a-zA-Z]{24}",
            severity: FindingSeverity::Critical,
            confidence: 0.95,
            description: "Slack App Token detected.",
        },
        SecretPattern {
            name: "Slack User Token",
            pattern: r"xoxp-[0-9]{10,12}-[0-9]{10,12}-[0-9a-zA-Z]{24}",
            severity: FindingSeverity::Critical,
            confidence: 0.95,
            description: "Slack User Token detected. Has user-level access to Slack.",
        },
        SecretPattern {
            name: "Slack Webhook URL",
            pattern: r"https://hooks\.slack\.com/services/T[0-9A-Z]{8,10}/B[0-9A-Z]{8,10}/[0-9a-zA-Z]{24}",
            severity: FindingSeverity::High,
            confidence: 0.95,
            description: "Slack Webhook URL detected. Can post messages to Slack channel.",
        },
        SecretPattern {
            name: "Private Key Header",
            pattern: r"-----BEGIN (?:RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----",
            severity: FindingSeverity::Critical,
            confidence: 0.99,
            description: "Private key detected. This is a critical credential for authentication.",
        },
        SecretPattern {
            name: "JWT Token",
            pattern: r"eyJ[a-zA-Z0-9\-_]+\.eyJ[a-zA-Z0-9\-_]+\.[a-zA-Z0-9\-_]+",
            severity: FindingSeverity::High,
            confidence: 0.90,
            description: "JWT Token detected. May contain sensitive data or be used for authentication.",
        },
        SecretPattern {
            name: "Twilio Account SID",
            pattern: r"AC[a-f0-9]{32}",
            severity: FindingSeverity::High,
            confidence: 0.90,
            description: "Twilio Account SID detected. Used for Twilio API access.",
        },
        SecretPattern {
            name: "Twilio Auth Token",
            pattern: r"(?i)twilio.{0,20}[a-f0-9]{32}",
            severity: FindingSeverity::Critical,
            confidence: 0.85,
            description: "Twilio Auth Token detected. Critical for Twilio account access.",
        },
        // === PAYMENT SECRETS ===
        SecretPattern {
            name: "Stripe Live Secret Key",
            pattern: r"sk_live_[0-9a-zA-Z]{24}",
            severity: FindingSeverity::Critical,
            confidence: 0.95,
            description: "Stripe Live Secret Key detected. Can process real payments.",
        },
        SecretPattern {
            name: "Stripe Test Secret Key",
            pattern: r"sk_test_[0-9a-zA-Z]{24}",
            severity: FindingSeverity::High,
            confidence: 0.95,
            description: "Stripe Test Secret Key detected. Should not be in production code.",
        },
        SecretPattern {
            name: "Stripe Live Publishable Key",
            pattern: r"pk_live_[0-9a-zA-Z]{24}",
            severity: FindingSeverity::Medium,
            confidence: 0.95,
            description: "Stripe Live Publishable Key detected.",
        },
        SecretPattern {
            name: "Stripe Test Publishable Key",
            pattern: r"pk_test_[0-9a-zA-Z]{24}",
            severity: FindingSeverity::Low,
            confidence: 0.95,
            description: "Stripe Test Publishable Key detected.",
        },
        SecretPattern {
            name: "Square Access Token",
            pattern: r"sq0atp-[0-9A-Za-z\-_]{22}",
            severity: FindingSeverity::Critical,
            confidence: 0.95,
            description: "Square Access Token detected. Can access Square payment processing.",
        },
        SecretPattern {
            name: "Square OAuth Secret",
            pattern: r"EAAA[a-zA-Z0-9\-_]{60}",
            severity: FindingSeverity::Critical,
            confidence: 0.90,
            description: "Square OAuth Secret detected.",
        },
        SecretPattern {
            name: "PayPal Client ID",
            pattern: r"(?i)paypal.{0,20}[A-Za-z0-9_-]{80}",
            severity: FindingSeverity::High,
            confidence: 0.80,
            description: "Potential PayPal Client ID detected.",
        },
        // === EMAIL/COMMUNICATION SECRETS ===
        SecretPattern {
            name: "Mailchimp API Key",
            pattern: r"[a-f0-9]{32}-us[0-9]{1,2}",
            severity: FindingSeverity::High,
            confidence: 0.95,
            description: "Mailchimp API Key detected. Can access email marketing data.",
        },
        SecretPattern {
            name: "SendGrid API Key",
            pattern: r"SG\.[a-zA-Z0-9\-_]{22}\.[a-zA-Z0-9\-_]{43}",
            severity: FindingSeverity::Critical,
            confidence: 0.95,
            description: "SendGrid API Key detected. Can send emails on your behalf.",
        },
        SecretPattern {
            name: "Mailgun API Key",
            pattern: r"key-[a-f0-9]{32}",
            severity: FindingSeverity::High,
            confidence: 0.95,
            description: "Mailgun API Key detected.",
        },
        SecretPattern {
            name: "SparkPost API Key",
            pattern: r"(?i)sparkpost.{0,20}[a-f0-9]{32}",
            severity: FindingSeverity::High,
            confidence: 0.85,
            description: "SparkPost API Key detected.",
        },
        // === CLOUD/INFRASTRUCTURE SECRETS ===
        SecretPattern {
            name: "Heroku API Key",
            pattern: r"(?i)heroku.{0,20}[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
            severity: FindingSeverity::Critical,
            confidence: 0.85,
            description: "Heroku API Key detected. Can access Heroku applications.",
        },
        SecretPattern {
            name: "Firebase API Key",
            pattern: r"(?i)firebase.{0,20}[A-Za-z0-9_-]{35,40}",
            severity: FindingSeverity::High,
            confidence: 0.80,
            description: "Firebase API Key detected.",
        },
        SecretPattern {
            name: "Azure Connection String",
            pattern: r"(?i)(?:connectionstring|connstring).{0,20}=[^;]{20,}",
            severity: FindingSeverity::Critical,
            confidence: 0.75,
            description: "Potential Azure Connection String detected.",
        },
        SecretPattern {
            name: "Azure Storage Key",
            pattern: r"(?i)(?:accountkey|storagekey).{0,20}[A-Za-z0-9+/]{88}==",
            severity: FindingSeverity::Critical,
            confidence: 0.90,
            description: "Azure Storage Account Key detected.",
        },
        SecretPattern {
            name: "DigitalOcean Token",
            pattern: r"dop_v1_[a-f0-9]{64}",
            severity: FindingSeverity::Critical,
            confidence: 0.95,
            description: "DigitalOcean Personal Access Token detected.",
        },
        SecretPattern {
            name: "Cloudflare API Token",
            pattern: r"(?i)cloudflare.{0,20}[A-Za-z0-9_-]{40}",
            severity: FindingSeverity::Critical,
            confidence: 0.85,
            description: "Cloudflare API Token detected.",
        },
        // === DATABASE SECRETS ===
        SecretPattern {
            name: "MongoDB Connection String",
            pattern: r"mongodb(?:\+srv)?://[^:]+:[^@]+@[^\s]+",
            severity: FindingSeverity::Critical,
            confidence: 0.95,
            description: "MongoDB Connection String with credentials detected.",
        },
        SecretPattern {
            name: "PostgreSQL Connection String",
            pattern: r"postgres(?:ql)?://[^:]+:[^@]+@[^\s]+",
            severity: FindingSeverity::Critical,
            confidence: 0.95,
            description: "PostgreSQL Connection String with credentials detected.",
        },
        SecretPattern {
            name: "MySQL Connection String",
            pattern: r"mysql://[^:]+:[^@]+@[^\s]+",
            severity: FindingSeverity::Critical,
            confidence: 0.95,
            description: "MySQL Connection String with credentials detected.",
        },
        SecretPattern {
            name: "Redis Connection String",
            pattern: r"redis://(?::[^@]+@)?[^\s]+",
            severity: FindingSeverity::High,
            confidence: 0.90,
            description: "Redis Connection String detected.",
        },
        // === AUTHENTICATION SECRETS ===
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
        SecretPattern {
            name: "Basic Auth Header",
            pattern: r"Basic\s+[A-Za-z0-9+/]+=*",
            severity: FindingSeverity::High,
            confidence: 0.85,
            description: "Basic Authentication header detected.",
        },
        SecretPattern {
            name: "OAuth Access Token",
            pattern: r#"(?i)access_token['"]?\s*[:=]\s*['"]?[a-zA-Z0-9_\-\.]{20,}['"]?"#,
            severity: FindingSeverity::High,
            confidence: 0.80,
            description: "OAuth Access Token detected.",
        },
        SecretPattern {
            name: "Refresh Token",
            pattern: r#"(?i)refresh_token['"]?\s*[:=]\s*['"]?[a-zA-Z0-9_\-\.]{20,}['"]?"#,
            severity: FindingSeverity::High,
            confidence: 0.80,
            description: "Refresh Token detected.",
        },
        SecretPattern {
            name: "Client Secret",
            pattern: r#"(?i)client[_-]?secret['"]?\s*[:=]\s*['"]?[a-zA-Z0-9_\-]{20,}['"]?"#,
            severity: FindingSeverity::Critical,
            confidence: 0.80,
            description: "Client Secret detected.",
        },
        // === OTHER SERVICES ===
        SecretPattern {
            name: "NPM Token",
            pattern: r"//registry\.npmjs\.org/:_authToken=[A-Za-z0-9-]{36}",
            severity: FindingSeverity::High,
            confidence: 0.95,
            description: "NPM Token detected. Can publish packages.",
        },
        SecretPattern {
            name: "Docker Hub Token",
            pattern: r"(?i)docker.{0,20}[a-f0-9]{32}",
            severity: FindingSeverity::High,
            confidence: 0.80,
            description: "Potential Docker Hub Token detected.",
        },
        SecretPattern {
            name: "Kubernetes Secret",
            pattern: r"(?i)kubernetes.{0,20}(?:token|password|secret).{0,20}[a-zA-Z0-9_\-]{20,}",
            severity: FindingSeverity::Critical,
            confidence: 0.75,
            description: "Potential Kubernetes Secret detected.",
        },
    ]
}

/// Get all PII patterns for detection
#[allow(dead_code)]
fn get_pii_patterns() -> Vec<SecretPattern> {
    vec![
        // === US IDENTIFIERS ===
        SecretPattern {
            name: "US SSN",
            pattern: r"\b[0-9]{3}-[0-9]{2}-[0-9]{4}\b",
            severity: FindingSeverity::Critical,
            confidence: 0.90,
            description: "US Social Security Number detected. Critical PII.",
        },
        SecretPattern {
            name: "US SSN (no dashes)",
            pattern: r"\b[0-9]{9}\b",
            severity: FindingSeverity::Medium,
            confidence: 0.30, // Low confidence without context
            description: "Potential US SSN (no dashes). Requires context verification.",
        },
        SecretPattern {
            name: "US Passport Number",
            pattern: r"\b[0-9]{9}\b",
            severity: FindingSeverity::High,
            confidence: 0.50,
            description: "Potential US Passport Number. Verify with context.",
        },
        // === DRIVER'S LICENSES ===
        SecretPattern {
            name: "CA Driver's License",
            pattern: r"\b[A][0-9]{7}\b",
            severity: FindingSeverity::High,
            confidence: 0.70,
            description: "Potential California Driver's License detected.",
        },
        SecretPattern {
            name: "NY Driver's License",
            pattern: r"\b[0-9]{3}[ -]?[0-9]{3}[ -]?[0-9]{3}\b",
            severity: FindingSeverity::High,
            confidence: 0.60,
            description: "Potential New York Driver's License detected.",
        },
        SecretPattern {
            name: "TX Driver's License",
            pattern: r"\b[0-9]{8}\b",
            severity: FindingSeverity::High,
            confidence: 0.50,
            description: "Potential Texas Driver's License detected.",
        },
        SecretPattern {
            name: "FL Driver's License",
            pattern: r"\b[A-Z][0-9]{3}[ -]?[0-9]{3}[ -]?[0-9]{3}[ -]?[0-9]{3}\b",
            severity: FindingSeverity::High,
            confidence: 0.70,
            description: "Potential Florida Driver's License detected.",
        },
        // === INTERNATIONAL ===
        SecretPattern {
            name: "IBAN",
            pattern: r"\b[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}\b",
            severity: FindingSeverity::High,
            confidence: 0.85,
            description: "International Bank Account Number (IBAN) detected.",
        },
        SecretPattern {
            name: "UK National Insurance Number",
            pattern: r"\b[A-Z]{2}[0-9]{6}[A-Z]\b",
            severity: FindingSeverity::High,
            confidence: 0.85,
            description: "UK National Insurance Number detected.",
        },
        SecretPattern {
            name: "Canadian SIN",
            pattern: r"\b[0-9]{3}[ -]?[0-9]{3}[ -]?[0-9]{3}\b",
            severity: FindingSeverity::High,
            confidence: 0.60,
            description: "Potential Canadian Social Insurance Number detected.",
        },
        // === CONTACT INFO ===
        SecretPattern {
            name: "Email Address",
            pattern: r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",
            severity: FindingSeverity::Medium,
            confidence: 0.95,
            description: "Email address detected.",
        },
        SecretPattern {
            name: "US Phone Number",
            pattern: r"\b(?:\+?1[-.]?)?\(?[0-9]{3}\)?[-.]?[0-9]{3}[-.]?[0-9]{4}\b",
            severity: FindingSeverity::Medium,
            confidence: 0.85,
            description: "US Phone Number detected.",
        },
        SecretPattern {
            name: "International Phone",
            pattern: r"\b\+[0-9]{1,3}[0-9]{4,14}[0-9]?\b",
            severity: FindingSeverity::Medium,
            confidence: 0.80,
            description: "International Phone Number detected.",
        },
        // === FINANCIAL ===
        SecretPattern {
            name: "Credit Card Number",
            pattern: r"\b(?:[0-9]{4}[- ]?){3}[0-9]{4}\b",
            severity: FindingSeverity::Critical,
            confidence: 0.85,
            description: "Credit Card Number pattern detected. Verify with Luhn check.",
        },
        SecretPattern {
            name: "Credit Card (Amex)",
            pattern: r"\b3[47][0-9]{13}\b",
            severity: FindingSeverity::Critical,
            confidence: 0.90,
            description: "American Express Card Number detected.",
        },
        SecretPattern {
            name: "Credit Card (Visa)",
            pattern: r"\b4[0-9]{12}(?:[0-9]{3})?\b",
            severity: FindingSeverity::Critical,
            confidence: 0.85,
            description: "Visa Card Number detected.",
        },
        SecretPattern {
            name: "Credit Card (MasterCard)",
            pattern: r"\b5[1-5][0-9]{14}\b",
            severity: FindingSeverity::Critical,
            confidence: 0.85,
            description: "MasterCard Number detected.",
        },
        SecretPattern {
            name: "Credit Card (Discover)",
            pattern: r"\b6(?:011|5[0-9]{2})[0-9]{12}\b",
            severity: FindingSeverity::Critical,
            confidence: 0.85,
            description: "Discover Card Number detected.",
        },
        // === MEDICAL ===
        SecretPattern {
            name: "US NPI Number",
            pattern: r"\b[0-9]{10}\b",
            severity: FindingSeverity::High,
            confidence: 0.50,
            description: "Potential National Provider Identifier (NPI) detected.",
        },
        SecretPattern {
            name: "Medical Record Number",
            pattern: r#"(?i)(?:mrn|medical[_-]?record)[_-]?id?['"]?\s*[:=]\s*['"]?[A-Z0-9\-]{6,20}"#,
            severity: FindingSeverity::High,
            confidence: 0.75,
            description: "Medical Record Number detected.",
        },
    ]
}

/// Validate credit card number using Luhn algorithm
#[allow(dead_code)]
pub fn luhn_check(card_number: &str) -> bool {
    let digits: Vec<u32> = card_number
        .chars()
        .filter(|c| c.is_ascii_digit())
        .map(|c| c.to_digit(10).unwrap())
        .collect();

    if digits.len() < 13 || digits.len() > 19 {
        return false;
    }

    let mut sum = 0;
    let mut alternate = false;

    for &digit in digits.iter().rev() {
        let mut n = digit;
        if alternate {
            n *= 2;
            if n > 9 {
                n = (n % 10) + 1;
            }
        }
        sum += n;
        alternate = !alternate;
    }

    sum % 10 == 0
}

/// Detect secrets in content
#[allow(dead_code)]
pub fn detect_secrets(content: &str) -> Vec<SecretFinding> {
    let mut findings = Vec::new();

    // Check all secret patterns
    for pattern in get_secret_patterns() {
        if let Ok(re) = Regex::new(pattern.pattern) {
            for cap in re.find_iter(content) {
                let matched = cap.as_str();
                findings.push(SecretFinding {
                    secret_type: pattern.name.to_string(),
                    severity: pattern.severity.clone(),
                    matched_value: if matched.len() > 12 {
                        format!("{}...{}", &matched[..4], &matched[matched.len()-4..])
                    } else {
                        "***".to_string()
                    },
                    start_offset: cap.start(),
                    end_offset: cap.end(),
                    confidence: pattern.confidence,
                    description: pattern.description.to_string(),
                });
            }
        }
    }

    // Check for high-entropy strings
    findings.extend(detect_high_entropy_secrets(content));

    // Deduplicate findings
    deduplicate_findings(&mut findings);

    findings
}

/// Detect PII in content
#[allow(dead_code)]
pub fn detect_pii(content: &str) -> Vec<SecretFinding> {
    let mut findings = Vec::new();

    for pattern in get_pii_patterns() {
        if let Ok(re) = Regex::new(pattern.pattern) {
            for cap in re.find_iter(content) {
                let matched = cap.as_str();

                // Special handling for credit cards - validate with Luhn
                if pattern.name.contains("Credit Card") {
                    if !luhn_check(matched) {
                        continue;
                    }
                }

                // Context-aware detection for SSN without dashes
                if pattern.name == "US SSN (no dashes)" {
                    let context_start = cap.start().saturating_sub(50);
                    let context_end = (cap.end() + 50).min(content.len());
                    let context = &content[context_start..context_end].to_lowercase();

                    if !context.contains("ssn") && !context.contains("social security") {
                        continue;
                    }
                }

                findings.push(SecretFinding {
                    secret_type: pattern.name.to_string(),
                    severity: pattern.severity.clone(),
                    matched_value: mask_pii(matched, pattern.name),
                    start_offset: cap.start(),
                    end_offset: cap.end(),
                    confidence: pattern.confidence,
                    description: pattern.description.to_string(),
                });
            }
        }
    }

    deduplicate_findings(&mut findings);
    findings
}

/// Mask PII value for safe display
#[allow(dead_code)]
fn mask_pii(value: &str, pii_type: &str) -> String {
    if pii_type.contains("Email") {
        if let Some(at_pos) = value.find('@') {
            if at_pos > 2 {
                return format!("{}***{}", &value[..2], &value[at_pos..]);
            }
        }
    } else if pii_type.contains("Phone") {
        if value.len() > 4 {
            return format!("***-***-{}", &value[value.len()-4..]);
        }
    } else if value.len() > 4 {
        return format!("{}***", &value[..2]);
    }
    "***".to_string()
}

/// Remove duplicate findings that overlap
#[allow(dead_code)]
fn deduplicate_findings(findings: &mut Vec<SecretFinding>) {
    let mut to_remove = HashSet::new();

    for i in 0..findings.len() {
        for j in (i + 1)..findings.len() {
            let f1 = &findings[i];
            let f2 = &findings[j];

            // Check for overlapping ranges
            if f1.start_offset < f2.end_offset && f2.start_offset < f1.end_offset {
                // Keep the one with higher confidence
                if f1.confidence >= f2.confidence {
                    to_remove.insert(j);
                } else {
                    to_remove.insert(i);
                }
            }
        }
    }

    let mut indices: Vec<usize> = to_remove.into_iter().collect();
    indices.sort_by(|a, b| b.cmp(a)); // Sort descending

    for idx in indices {
        findings.remove(idx);
    }
}

// -----------------
// SECURITY HEADERS ANALYSIS
// -----------------

/// Analyze HTTP response headers for security issues
#[allow(dead_code)]
pub fn analyze_headers(headers: &HashMap<String, String>) -> Vec<HeaderFinding> {
    let mut findings = Vec::new();

    // Helper to get header value case-insensitively
    let get_header = |name: &str| -> Option<(String, String)> {
        for (key, value) in headers {
            if key.to_lowercase() == name.to_lowercase() {
                return Some((key.clone(), value.clone()));
            }
        }
        None
    };

    // Check HSTS
    match get_header("strict-transport-security") {
        Some((key, value)) => {
            if !value.contains("max-age") {
                findings.push(HeaderFinding {
                    header_name: key,
                    current_value: Some(value.clone()),
                    is_missing: false,
                    is_weak: true,
                    severity: FindingSeverity::High,
                    description: "HSTS header present but missing max-age directive".to_string(),
                    recommendation: "Add 'max-age=31536000; includeSubDomains'".to_string(),
                });
            } else if !value.contains("includeSubDomains") {
                findings.push(HeaderFinding {
                    header_name: key,
                    current_value: Some(value.clone()),
                    is_missing: false,
                    is_weak: true,
                    severity: FindingSeverity::Medium,
                    description: "HSTS header missing includeSubDomains directive".to_string(),
                    recommendation: "Add 'includeSubDomains' to protect all subdomains".to_string(),
                });
            }
        }
        None => {
            findings.push(HeaderFinding {
                header_name: "Strict-Transport-Security".to_string(),
                current_value: None,
                is_missing: true,
                is_weak: false,
                severity: FindingSeverity::High,
                description: "Missing HSTS header. Site is vulnerable to SSL stripping attacks".to_string(),
                recommendation: "Add 'Strict-Transport-Security: max-age=31536000; includeSubDomains'".to_string(),
            });
        }
    }

    // Check CSP
    match get_header("content-security-policy") {
        Some((key, value)) => {
            let weak_patterns = ["unsafe-inline", "unsafe-eval", "*", "data:"];
            for weak in weak_patterns {
                if value.contains(weak) {
                    findings.push(HeaderFinding {
                        header_name: key.clone(),
                        current_value: Some(value.clone()),
                        is_missing: false,
                        is_weak: true,
                        severity: FindingSeverity::Medium,
                        description: format!("CSP contains weak directive: '{}'", weak),
                        recommendation: "Remove unsafe directives and use nonces/hashes instead".to_string(),
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
                severity: FindingSeverity::High,
                description: "Missing Content-Security-Policy header. Site is vulnerable to XSS attacks".to_string(),
                recommendation: "Add a restrictive CSP header to prevent XSS and data injection".to_string(),
            });
        }
    }

    // Check X-Content-Type-Options
    match get_header("x-content-type-options") {
        Some((key, value)) => {
            if value.to_lowercase() != "nosniff" {
                findings.push(HeaderFinding {
                    header_name: key,
                    current_value: Some(value.clone()),
                    is_missing: false,
                    is_weak: true,
                    severity: FindingSeverity::Medium,
                    description: "X-Content-Type-Options has incorrect value".to_string(),
                    recommendation: "Set to 'nosniff'".to_string(),
                });
            }
        }
        None => {
            findings.push(HeaderFinding {
                header_name: "X-Content-Type-Options".to_string(),
                current_value: None,
                is_missing: true,
                is_weak: false,
                severity: FindingSeverity::Medium,
                description: "Missing X-Content-Type-Options header. Browser may MIME-sniff content".to_string(),
                recommendation: "Add 'X-Content-Type-Options: nosniff'".to_string(),
            });
        }
    }

    // Check X-Frame-Options
    match get_header("x-frame-options") {
        Some((key, value)) => {
            let valid_values = ["deny", "sameorigin"];
            if !valid_values.contains(&value.to_lowercase().as_str()) {
                findings.push(HeaderFinding {
                    header_name: key,
                    current_value: Some(value.clone()),
                    is_missing: false,
                    is_weak: true,
                    severity: FindingSeverity::Medium,
                    description: "X-Frame-Options has invalid value".to_string(),
                    recommendation: "Set to 'DENY' or 'SAMEORIGIN'".to_string(),
                });
            }
        }
        None => {
            findings.push(HeaderFinding {
                header_name: "X-Frame-Options".to_string(),
                current_value: None,
                is_missing: true,
                is_weak: false,
                severity: FindingSeverity::Medium,
                description: "Missing X-Frame-Options header. Site may be vulnerable to clickjacking".to_string(),
                recommendation: "Add 'X-Frame-Options: SAMEORIGIN' or use CSP frame-ancestors".to_string(),
            });
        }
    }

    // Check X-XSS-Protection (deprecated but still checked)
    match get_header("x-xss-protection") {
        Some((key, value)) => {
            if !value.contains("1") {
                findings.push(HeaderFinding {
                    header_name: key,
                    current_value: Some(value.clone()),
                    is_missing: false,
                    is_weak: true,
                    severity: FindingSeverity::Low,
                    description: "X-XSS-Protection is disabled".to_string(),
                    recommendation: "Consider removing this deprecated header and relying on CSP instead".to_string(),
                });
            }
        }
        None => {
            findings.push(HeaderFinding {
                header_name: "X-XSS-Protection".to_string(),
                current_value: None,
                is_missing: true,
                is_weak: false,
                severity: FindingSeverity::Low,
                description: "Missing X-XSS-Protection header (deprecated, but may be expected by security scanners)".to_string(),
                recommendation: "Consider adding 'X-XSS-Protection: 0' to explicitly disable, or rely on CSP".to_string(),
            });
        }
    }

    // Check Referrer-Policy
    match get_header("referrer-policy") {
        Some((key, value)) => {
            let weak_values = ["unsafe-url", "no-referrer-when-downgrade"];
            if weak_values.contains(&value.to_lowercase().as_str()) {
                findings.push(HeaderFinding {
                    header_name: key,
                    current_value: Some(value.clone()),
                    is_missing: false,
                    is_weak: true,
                    severity: FindingSeverity::Low,
                    description: "Referrer-Policy may leak sensitive URLs".to_string(),
                    recommendation: "Use 'strict-origin-when-cross-origin' or 'no-referrer'".to_string(),
                });
            }
        }
        None => {
            findings.push(HeaderFinding {
                header_name: "Referrer-Policy".to_string(),
                current_value: None,
                is_missing: true,
                is_weak: false,
                severity: FindingSeverity::Low,
                description: "Missing Referrer-Policy header. Full URL may be leaked in referrer".to_string(),
                recommendation: "Add 'Referrer-Policy: strict-origin-when-cross-origin'".to_string(),
            });
        }
    }

    // Check Permissions-Policy (formerly Feature-Policy)
    match get_header("permissions-policy") {
        Some(_) => {
            // Header is present, could add more detailed analysis
        }
        None => {
            findings.push(HeaderFinding {
                header_name: "Permissions-Policy".to_string(),
                current_value: None,
                is_missing: true,
                is_weak: false,
                severity: FindingSeverity::Low,
                description: "Missing Permissions-Policy header. Browser features may be accessible without restriction".to_string(),
                recommendation: "Add Permissions-Policy to restrict access to sensitive browser features".to_string(),
            });
        }
    }

    // Check for information disclosure headers
    let info_headers = ["server", "x-powered-by", "x-aspnet-version", "x-runtime", "x-version"];
    for header in info_headers {
        if let Some((key, value)) = get_header(header) {
            findings.push(HeaderFinding {
                header_name: key,
                current_value: Some(value.clone()),
                is_missing: false,
                is_weak: false,
                severity: FindingSeverity::Info,
                description: format!("Information disclosure: {} header reveals technology information", header),
                recommendation: "Remove this header to reduce information disclosure".to_string(),
            });
        }
    }

    findings
}

// -----------------
// BOLA/IDOR DETECTION
// -----------------

/// Detect BOLA (Broken Object Level Authorization) / IDOR patterns
#[allow(dead_code)]
pub fn detect_bola_patterns(url: &str, response_body: &str) -> Vec<BolaFinding> {
    let mut findings = Vec::new();

    // Pattern for sequential integer IDs in URLs
    let int_id_patterns = [
        r"/users?/(\d+)",
        r"/accounts?/(\d+)",
        r"/orders?/(\d+)",
        r"/customers?/(\d+)",
        r"/documents?/(\d+)",
        r"/files?/(\d+)",
        r"/posts?/(\d+)",
        r"/items?/(\d+)",
        r"/products?/(\d+)",
        r"/invoices?/(\d+)",
        r"/transactions?/(\d+)",
        r"/records?/(\d+)",
        r"/api/v\d+/[^/]+/(\d+)",
    ];

    for pattern in &int_id_patterns {
        if let Ok(re) = Regex::new(pattern) {
            if let Some(cap) = re.captures(url) {
                if let Some(id_match) = cap.get(1) {
                    let id_value = id_match.as_str();
                    findings.push(BolaFinding {
                        finding_type: "Predictable Resource ID".to_string(),
                        severity: FindingSeverity::High,
                        location: url.to_string(),
                        description: format!(
                            "URL contains sequential integer ID '{}' which is vulnerable to IDOR attacks",
                            id_value
                        ),
                        resource_pattern: pattern.to_string(),
                        is_predictable: true,
                        remediation: "Use UUIDs instead of sequential IDs, or implement proper authorization checks".to_string(),
                    });
                }
            }
        }
    }

    // Check for UUID usage (more secure)
    let uuid_pattern = r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}";
    if let Ok(re) = Regex::new(uuid_pattern) {
        if re.is_match(url) {
            // UUID found - this is better, but still check for authorization
            findings.push(BolaFinding {
                finding_type: "UUID Resource ID".to_string(),
                severity: FindingSeverity::Medium,
                location: url.to_string(),
                description: "URL uses UUID for resource identification. While harder to guess, authorization checks are still required".to_string(),
                resource_pattern: uuid_pattern.to_string(),
                is_predictable: false,
                remediation: "Ensure proper authorization checks are implemented for each resource access".to_string(),
            });
        }
    }

    // Check response body for exposed user/account IDs
    let id_patterns = [
        (r#""user_id"\s*:\s*(\d+)"#, "user_id"),
        (r#""account_id"\s*:\s*(\d+)"#, "account_id"),
        (r#""customer_id"\s*:\s*(\d+)"#, "customer_id"),
        (r#""owner_id"\s*:\s*(\d+)"#, "owner_id"),
        (r#""created_by"\s*:\s*(\d+)"#, "created_by"),
    ];

    for (pattern, field_name) in &id_patterns {
        if let Ok(re) = Regex::new(pattern) {
            for cap in re.captures_iter(response_body) {
                if let Some(id_match) = cap.get(1) {
                    let id_value = id_match.as_str();
                    findings.push(BolaFinding {
                        finding_type: "Exposed Internal ID".to_string(),
                        severity: FindingSeverity::Medium,
                        location: format!("Response body field: {}", field_name),
                        description: format!(
                            "Response exposes internal {} with value '{}'. This could enable IDOR if not properly authorized",
                            field_name, id_value
                        ),
                        resource_pattern: pattern.to_string(),
                        is_predictable: true,
                        remediation: "Implement proper authorization checks and consider using indirect references".to_string(),
                    });
                }
            }
        }
    }

    // Check for mass assignment opportunities
    let mass_assignment_patterns = [
        (r#""is_admin"\s*:\s*(true|false)"#, "is_admin"),
        (r#""role"\s*:\s*"[^"]+""#, "role"),
        (r#""permissions"\s*:\s*\["#, "permissions"),
        (r#""is_superuser"\s*:\s*(true|false)"#, "is_superuser"),
        (r#""access_level"\s*:\s*\d+"#, "access_level"),
    ];

    for (pattern, field_name) in &mass_assignment_patterns {
        if let Ok(re) = Regex::new(pattern) {
            if re.is_match(response_body) {
                findings.push(BolaFinding {
                    finding_type: "Mass Assignment Risk".to_string(),
                    severity: FindingSeverity::High,
                    location: format!("Response body field: {}", field_name),
                    description: format!(
                        "Response contains sensitive privilege field '{}'. This may indicate mass assignment vulnerability",
                        field_name
                    ),
                    resource_pattern: pattern.to_string(),
                    is_predictable: false,
                    remediation: "Use DTOs or allowlists to prevent mass assignment of sensitive fields".to_string(),
                });
            }
        }
    }

    // Check for nested resource patterns that might indicate IDOR chains
    let nested_patterns = [
        r"/users/(\d+)/[^/]+/(\d+)",
        r"/organizations/(\d+)/[^/]+/(\d+)",
        r"/accounts/(\d+)/[^/]+/(\d+)",
    ];

    for pattern in &nested_patterns {
        if let Ok(re) = Regex::new(pattern) {
            if let Some(_cap) = re.captures(url) {
                findings.push(BolaFinding {
                    finding_type: "Nested Resource IDOR Chain".to_string(),
                    severity: FindingSeverity::High,
                    location: url.to_string(),
                    description: "URL contains nested resource IDs. Each level requires separate authorization check".to_string(),
                    resource_pattern: pattern.to_string(),
                    is_predictable: true,
                    remediation: "Verify authorization at each resource level in the hierarchy".to_string(),
                });
            }
        }
    }

    findings
}

// -----------------
// TECH STACK ERROR DETECTION
// -----------------

/// Technology stack error signature
#[allow(dead_code)]
struct TechSignature {
    technology: &'static str,
    patterns: Vec<&'static str>,
    severity: FindingSeverity,
    description: &'static str,
}

/// Get all technology signatures for error detection
#[allow(dead_code)]
fn get_tech_signatures() -> Vec<TechSignature> {
    vec![
        // === PHP FRAMEWORKS ===
        TechSignature {
            technology: "Laravel",
            patterns: vec![
                "Whoops, something went wrong",
                "laravel",
                "Illuminate\\",
                "vendor/laravel",
            ],
            severity: FindingSeverity::Medium,
            description: "Laravel framework error detected. May reveal stack traces and file paths.",
        },
        TechSignature {
            technology: "PHP",
            patterns: vec![
                "Fatal error:",
                "Parse error:",
                "Warning:",
                "PHP Notice:",
                "Call to undefined function",
                "Call to undefined method",
                "require_once(",
                "include_once(",
            ],
            severity: FindingSeverity::Medium,
            description: "PHP error detected. May reveal file paths and application structure.",
        },
        // === PYTHON FRAMEWORKS ===
        TechSignature {
            technology: "Django",
            patterns: vec![
                "TypeError at /",
                "Django Version:",
                "INSTALLED_APPS",
                "django.core",
                "django.conf",
                "Using the URLconf",
            ],
            severity: FindingSeverity::High,
            description: "Django debug page detected. Reveals configuration and code structure.",
        },
        TechSignature {
            technology: "Flask",
            patterns: vec![
                "werkzeug",
                "flask.",
                "jinja2",
                "Werkzeug Debugger",
            ],
            severity: FindingSeverity::High,
            description: "Flask/Werkzeug debug information detected.",
        },
        TechSignature {
            technology: "Python",
            patterns: vec![
                "Traceback (most recent call last)",
                "File \"",
                "line ",
                ", in <module>",
                "raise Exception",
                "ImportError:",
                "AttributeError:",
                "KeyError:",
                "ValueError:",
                "TypeError:",
            ],
            severity: FindingSeverity::Medium,
            description: "Python stack trace detected. May reveal code structure and file paths.",
        },
        // === JAVA FRAMEWORKS ===
        TechSignature {
            technology: "Spring Boot",
            patterns: vec![
                "Whitelabel Error Page",
                "springframework",
                "org.springframework",
                "spring-boot",
                "DispatcherServlet",
            ],
            severity: FindingSeverity::Medium,
            description: "Spring Boot error page detected. May reveal framework version and structure.",
        },
        TechSignature {
            technology: "Java",
            patterns: vec![
                "java.lang.Exception",
                "java.io.",
                "javax.servlet",
                "java.lang.NullPointerException",
                "java.lang.ClassNotFoundException",
                "java.sql.SQLException",
                "at java.",
                "at org.",
                "at com.",
            ],
            severity: FindingSeverity::Medium,
            description: "Java stack trace detected. May reveal class structure and dependencies.",
        },
        // === JAVASCRIPT/NODE ===
        TechSignature {
            technology: "Express.js",
            patterns: vec![
                "Error:",
                "node_modules",
                "at Module.",
                "at Object.",
                "express",
                "body-parser",
            ],
            severity: FindingSeverity::Medium,
            description: "Node.js/Express error detected. May reveal dependency structure.",
        },
        TechSignature {
            technology: "Next.js",
            patterns: vec![
                "Internal Server Error",
                ".next/",
                "next/dist",
                "_error.js",
            ],
            severity: FindingSeverity::Medium,
            description: "Next.js error detected.",
        },
        TechSignature {
            technology: "JavaScript",
            patterns: vec![
                "TypeError:",
                "ReferenceError:",
                "SyntaxError:",
                "undefined is not",
                "Cannot read property",
                "is not defined",
                "Uncaught",
            ],
            severity: FindingSeverity::Medium,
            description: "JavaScript error detected. May reveal client-side logic.",
        },
        // === .NET ===
        TechSignature {
            technology: "ASP.NET",
            patterns: vec![
                "Server Error in '/' Application",
                "ASP.NET",
                "System.Web",
                "System.Exception",
                "web.config",
                "at System.",
                "Microsoft.",
            ],
            severity: FindingSeverity::High,
            description: "ASP.NET error page detected. May reveal detailed stack trace and configuration.",
        },
        // === RUBY ===
        TechSignature {
            technology: "Ruby on Rails",
            patterns: vec![
                "Rails.root",
                "ActionController",
                "ActiveRecord",
                "NoMethodError",
                "NameError",
                "rails/",
                "Gem::",
            ],
            severity: FindingSeverity::High,
            description: "Ruby on Rails error detected. May reveal application structure and gems.",
        },
        TechSignature {
            technology: "Ruby",
            patterns: vec![
                "/usr/lib/ruby",
                "gem",
                "bundle",
                ".rb:",
            ],
            severity: FindingSeverity::Medium,
            description: "Ruby error detected.",
        },
        // === DATABASE ERRORS ===
        TechSignature {
            technology: "MySQL",
            patterns: vec![
                "mysql_",
                "MySQLSyntaxErrorException",
                "com.mysql",
                "SQL syntax",
                "mysql_fetch",
            ],
            severity: FindingSeverity::High,
            description: "MySQL error detected. May indicate SQL injection vulnerability.",
        },
        TechSignature {
            technology: "PostgreSQL",
            patterns: vec![
                "pg_",
                "PostgreSQL",
                "psql",
                "org.postgresql",
                "PG::",
            ],
            severity: FindingSeverity::High,
            description: "PostgreSQL error detected. May indicate SQL injection vulnerability.",
        },
        TechSignature {
            technology: "SQLite",
            patterns: vec![
                "sqlite3",
                "SQLite3::",
                "SQLITE_",
            ],
            severity: FindingSeverity::High,
            description: "SQLite error detected.",
        },
        TechSignature {
            technology: "MongoDB",
            patterns: vec![
                "MongoError",
                "MongoDB",
                "mongo:",
                "mongoose",
            ],
            severity: FindingSeverity::High,
            description: "MongoDB error detected.",
        },
        // === CLOUD PROVIDERS ===
        TechSignature {
            technology: "AWS",
            patterns: vec![
                "aws.",
                "AmazonS3",
                "EC2",
                "Lambda",
                "DynamoDB",
                "x-amz-",
            ],
            severity: FindingSeverity::Medium,
            description: "AWS service reference detected.",
        },
        TechSignature {
            technology: "Azure",
            patterns: vec![
                "azure",
                "windows.net",
                "azurewebsites",
                "core.windows.net",
            ],
            severity: FindingSeverity::Medium,
            description: "Azure service reference detected.",
        },
        TechSignature {
            technology: "GCP",
            patterns: vec![
                "googleapis.com",
                "gcloud",
                "firebase",
                "appspot.com",
            ],
            severity: FindingSeverity::Medium,
            description: "Google Cloud Platform reference detected.",
        },
    ]
}

/// Detect technology stack from error messages
#[allow(dead_code)]
pub fn detect_tech_stack_errors(body: &str) -> Vec<ErrorFinding> {
    let mut findings = Vec::new();
    let body_lower = body.to_lowercase();
    let mut detected_technologies: HashSet<String> = HashSet::new();

    for sig in get_tech_signatures() {
        for pattern in &sig.patterns {
            // Case-insensitive search
            if body_lower.contains(&pattern.to_lowercase()) {
                // Find the actual position in original body
                if let Some(pos) = body_lower.find(&pattern.to_lowercase()) {
                    // Only add one finding per technology
                    if !detected_technologies.contains(sig.technology) {
                        detected_technologies.insert(sig.technology.to_string());
                        findings.push(ErrorFinding {
                            technology: sig.technology.to_string(),
                            error_type: "Verbose Error".to_string(),
                            severity: sig.severity.clone(),
                            description: sig.description.to_string(),
                            matched_pattern: pattern.to_string(),
                            start_offset: pos,
                            end_offset: pos + pattern.len(),
                        });
                    }
                }
                break; // Move to next signature after first match
            }
        }
    }

    findings
}

// -----------------
// COMPREHENSIVE ANALYSIS
// -----------------

/// Comprehensive security analysis result
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityAnalysis {
    pub secrets: Vec<SecretFinding>,
    pub pii: Vec<SecretFinding>,
    pub header_findings: Vec<HeaderFinding>,
    pub bola_findings: Vec<BolaFinding>,
    pub error_findings: Vec<ErrorFinding>,
}

/// Perform comprehensive security analysis on HTTP response
#[allow(dead_code)]
pub fn analyze_security(
    body: &str,
    headers: &HashMap<String, String>,
    url: &str,
) -> SecurityAnalysis {
    SecurityAnalysis {
        secrets: detect_secrets(body),
        pii: detect_pii(body),
        header_findings: analyze_headers(headers),
        bola_findings: detect_bola_patterns(url, body),
        error_findings: detect_tech_stack_errors(body),
    }
}

/// Convert SecretFinding to Badge for compatibility
impl From<&SecretFinding> for Badge {
    fn from(finding: &SecretFinding) -> Self {
        let emoji = match finding.severity {
            FindingSeverity::Critical => "🔴",
            FindingSeverity::High => "🟠",
            FindingSeverity::Medium => "🟡",
            FindingSeverity::Low => "🟢",
            FindingSeverity::Info => "ℹ️",
        };

        let short = match finding.secret_type.len() {
            0..=8 => finding.secret_type.clone(),
            _ => format!("{}...", &finding.secret_type[..8]),
        };

        Badge::new(
            emoji,
            &short,
            finding.severity.clone().into(),
            &finding.description,
        )
    }
}

/// Convert HeaderFinding to Badge for compatibility
impl From<&HeaderFinding> for Badge {
    fn from(finding: &HeaderFinding) -> Self {
        let emoji = if finding.is_missing { "🛡️" } else { "⚠️" };

        Badge::new(
            emoji,
            &finding.header_name,
            finding.severity.clone().into(),
            &finding.description,
        )
    }
}

/// Convert BolaFinding to Badge for compatibility
impl From<&BolaFinding> for Badge {
    fn from(finding: &BolaFinding) -> Self {
        Badge::new(
            "🆔",
            "IDOR",
            finding.severity.clone().into(),
            &finding.description,
        )
    }
}

/// Convert ErrorFinding to Badge for compatibility
impl From<&ErrorFinding> for Badge {
    fn from(finding: &ErrorFinding) -> Self {
        Badge::new(
            "🗣️",
            &finding.technology,
            finding.severity.clone().into(),
            &finding.description,
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_entropy_calculation() {
        // Low entropy string
        assert!(calculate_entropy("aaaaaaaa") < 1.0);

        // High entropy string (random-looking)
        assert!(calculate_entropy("xK9mN2pL5qR8sT3v") > 3.5);

        // Empty string
        assert_eq!(calculate_entropy(""), 0.0);
    }

    #[test]
    fn test_luhn_check() {
        // Valid test credit card numbers
        assert!(luhn_check("4532015112830366")); // Visa
        assert!(luhn_check("5425233430109903")); // MasterCard
        assert!(luhn_check("374245455400126")); // Amex

        // Invalid numbers (failed Luhn check)
        assert!(!luhn_check("1234567890123456"));
        assert!(!luhn_check("1111111111111111")); // All same digits fails Luhn
        assert!(!luhn_check("4111111111111112")); // One digit off from valid
    }

    #[test]
    fn test_detect_aws_keys() {
        let content = r#"config = { access_key: "AKIAIOSFODNN7EXAMPLE" }"#;
        let findings = detect_secrets(content);
        assert!(!findings.is_empty());
        assert!(findings.iter().any(|f| f.secret_type == "AWS Access Key ID"));
    }

    #[test]
    fn test_detect_jwt() {
        let content = r#"token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U""#;
        let findings = detect_secrets(content);
        assert!(findings.iter().any(|f| f.secret_type == "JWT Token"));
    }

    #[test]
    fn test_detect_ssn() {
        let content = "SSN: 123-45-6789";
        let findings = detect_pii(content);
        assert!(findings.iter().any(|f| f.secret_type == "US SSN"));
    }

    #[test]
    fn test_analyze_headers_missing_hsts() {
        let mut headers = HashMap::new();
        headers.insert("Content-Type".to_string(), "application/json".to_string());

        let findings = analyze_headers(&headers);
        assert!(findings.iter().any(|f| f.header_name == "Strict-Transport-Security" && f.is_missing));
    }

    #[test]
    fn test_detect_bola_integer_id() {
        let url = "/api/v1/users/12345/profile";
        let body = r#"{"user_id": 12345, "name": "test"}"#;

        let findings = detect_bola_patterns(url, body);
        assert!(findings.iter().any(|f| f.finding_type == "Predictable Resource ID"));
    }

    #[test]
    fn test_detect_django_error() {
        let body = r#"<h1>TypeError at /api/users</h1><p>Django Version: 3.2.0</p>"#;
        let findings = detect_tech_stack_errors(body);
        assert!(findings.iter().any(|f| f.technology == "Django"));
    }

    #[test]
    fn test_detect_spring_boot() {
        let body = r#"<html><body><h1>Whitelabel Error Page</h1><p>springframework</p></body></html>"#;
        let findings = detect_tech_stack_errors(body);
        assert!(findings.iter().any(|f| f.technology == "Spring Boot"));
    }
}
