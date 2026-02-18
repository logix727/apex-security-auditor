use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SqliFinding {
    pub parameter: String,
    pub payload: String,
    pub evidence: String,
    pub severity: String,
}

pub fn generate_sqli_payloads() -> Vec<String> {
    vec![
        "'".to_string(),
        "\"".to_string(),
        "' OR '1'='1".to_string(),
        "\" OR \"1\"=\"1".to_string(),
        ";--".to_string(),
        ") OR 1=1--".to_string(),
    ]
}

pub fn check_sqli_response(body: &str) -> Option<String> {
    let error_patterns = [
        (Regex::new(r"(?i)SQL syntax.*MySQL").unwrap(), "MySQL Error"),
        (
            Regex::new(r"(?i)Warning.*mysql_.*").unwrap(),
            "MySQL Warning",
        ),
        (
            Regex::new(r"(?i)valid PostgreSQL result").unwrap(),
            "PostgreSQL Error",
        ),
        (
            Regex::new(r"(?i)Npgsql\.").unwrap(),
            "PostgreSQL Npgsql Error",
        ),
        (
            Regex::new(r"(?i)PG::SyntaxError:").unwrap(),
            "PostgreSQL Syntax Error",
        ),
        (
            Regex::new(r"(?i)org\.hibernate\.QueryException").unwrap(),
            "Hibernate Query Exception",
        ),
        (
            Regex::new(r"(?i)System\.Data\.SqlClient\.SqlException").unwrap(),
            "SQL Server Exception",
        ),
        (
            Regex::new(r"(?i)SQLite3::SQLException").unwrap(),
            "SQLite Error",
        ),
        (
            Regex::new(r"(?i)unclosed quotation mark after the character string").unwrap(),
            "SQL Server Unclosed Quote",
        ),
        (
            Regex::new(r"(?i)quoted string not properly terminated").unwrap(),
            "Oracle/Generic SQL Error",
        ),
    ];

    for (regex, db_type) in &error_patterns {
        if regex.is_match(body) {
            return Some(db_type.to_string());
        }
    }
    None
}
