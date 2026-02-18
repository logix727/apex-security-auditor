use super::bola::{generate_bola_variants, BolaFinding};
use super::sqli::{check_sqli_response, generate_sqli_payloads, SqliFinding};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActiveScanResult {
    pub asset_id: i64,
    pub original_url: String,
    pub status: String,
    pub log: Vec<String>,
    pub bola_findings: Vec<BolaFinding>,
    pub sqli_findings: Vec<SqliFinding>,
}

pub async fn scan_active_target(
    asset_id: i64,
    url: String,
    method: String,
    headers: HashMap<String, String>,
) -> ActiveScanResult {
    let mut result = ActiveScanResult {
        asset_id,
        original_url: url.clone(),
        status: "Running".to_string(),
        log: Vec::new(),
        bola_findings: Vec::new(),
        sqli_findings: Vec::new(),
    };

    let client = reqwest::Client::new();
    let req_method = reqwest::Method::from_bytes(method.as_bytes()).unwrap_or(reqwest::Method::GET);
    let mut header_map = reqwest::header::HeaderMap::new();
    for (key, value) in headers {
        if let Ok(name) = reqwest::header::HeaderName::from_bytes(key.as_bytes()) {
            if let Ok(val) = reqwest::header::HeaderValue::from_str(&value) {
                header_map.insert(name, val);
            }
        }
    }

    // 1. BOLA Check
    result.log.push("Starting BOLA check...".to_string());
    let variants = generate_bola_variants(&url);
    if variants.is_empty() {
        result
            .log
            .push("No numeric IDs found for BOLA check.".to_string());
    } else {
        result
            .log
            .push(format!("Generated {} BOLA variants.", variants.len()));
        for variant in variants {
            match client
                .request(req_method.clone(), &variant)
                .headers(header_map.clone())
                .send()
                .await
            {
                Ok(resp) => {
                    let status = resp.status().as_u16();
                    if status >= 200 && status < 300 {
                        result.bola_findings.push(BolaFinding {
                            original_url: url.clone(),
                            tested_url: variant.clone(),
                            status,
                            evidence: "Success Status Code (Possible BOLA)".to_string(),
                        });
                    }
                }
                Err(e) => {
                    result
                        .log
                        .push(format!("Failed to scan {}: {}", variant, e));
                }
            }
        }
    }

    // 2. SQLi Check
    result.log.push("Starting SQLi check...".to_string());
    if url.contains("?") {
        let payloads = generate_sqli_payloads();
        for payload in payloads {
            if let Ok(mut parsed) = url::Url::parse(&url) {
                let mut pairs: Vec<(String, String)> = parsed.query_pairs().into_owned().collect();
                if !pairs.is_empty() {
                    // Inject into first param
                    let original_val = pairs[0].1.clone();
                    pairs[0].1 = format!("{}{}", original_val, payload);

                    parsed.query_pairs_mut().clear().extend_pairs(pairs);
                    let target_url = parsed.to_string();

                    match client
                        .request(req_method.clone(), &target_url)
                        .headers(header_map.clone())
                        .send()
                        .await
                    {
                        Ok(resp) => {
                            if let Ok(text) = resp.text().await {
                                if let Some(db_error) = check_sqli_response(&text) {
                                    result.sqli_findings.push(SqliFinding {
                                        parameter: "query_param".to_string(),
                                        payload: payload.clone(),
                                        evidence: db_error,
                                        severity: "High".to_string(),
                                    });
                                }
                            }
                        }
                        Err(_) => {}
                    }
                }
            }
        }
    } else {
        result
            .log
            .push("No query parameters found for SQLi check.".to_string());
    }

    result.status = "Completed".to_string();
    result
}
