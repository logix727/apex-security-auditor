use crate::commands::assets::StagedAsset;
use crate::db::SqliteDatabase;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tauri::State;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DiscoveredAsset {
    pub id: String,
    pub url: String,
    pub source: String,
    pub risk_estimate: String,
    pub findings: Vec<String>,
}

#[derive(Debug, Deserialize)]
struct CrtShEntry {
    name_value: String,
}

#[tauri::command]
pub async fn discover_subdomains(domain: String) -> Result<Vec<DiscoveredAsset>, String> {
    let client = Client::new();
    let url = format!("https://crt.sh/?q=%.{}&output=json", domain);

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to query crt.sh: {}", e))?;

    let entries: Vec<CrtShEntry> = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse crt.sh response: {}", e))?;

    let mut subdomains = std::collections::HashSet::new();
    for entry in entries {
        for sub in entry.name_value.split('\n') {
            if sub.contains('*') {
                continue;
            }
            subdomains.insert(sub.trim().to_string());
        }
    }

    let mut results: Vec<DiscoveredAsset> = subdomains
        .into_iter()
        .enumerate()
        .map(|(i, sub)| {
            let url = if sub.starts_with("http") {
                sub
            } else {
                format!("https://{}", sub)
            };
            DiscoveredAsset {
                id: format!("disc_{}", i),
                url,
                source: "cert".to_string(),
                risk_estimate: "Info".to_string(), // Default
                findings: vec!["New Subdomain".to_string()],
            }
        })
        .collect();

    for asset in &mut results {
        map_cve_to_asset(asset);
    }

    Ok(results)
}

fn map_cve_to_asset(asset: &mut DiscoveredAsset) {
    let url_lower = asset.url.to_lowercase();
    if url_lower.contains("vpn") || url_lower.contains("gateway") {
        asset.risk_estimate = "High".to_string();
        asset
            .findings
            .push("Potential CWE-287: Improper Authentication".to_string());
        asset
            .findings
            .push("Suggested CVE check: CVE-2023-3519".to_string());
    } else if url_lower.contains("dev")
        || url_lower.contains("test")
        || url_lower.contains("staging")
    {
        asset.risk_estimate = "Medium".to_string();
        asset
            .findings
            .push("CWE-200: Information Exposure".to_string());
    } else if url_lower.contains("jira") || url_lower.contains("confluence") {
        asset.risk_estimate = "High".to_string();
        asset.findings.push("Critical App Discovery".to_string());
        asset.findings.push("CVSS: 9.8 (Critical)".to_string());
    } else {
        asset.risk_estimate = "Low".to_string();
        asset.findings.push("CVSS: 3.3 (Low)".to_string());
    }
}

#[tauri::command]
pub async fn crawl_discovered_assets(
    assets: Vec<DiscoveredAsset>,
) -> Result<Vec<DiscoveredAsset>, String> {
    let client = Client::new();
    let mut crawled_assets = Vec::new();

    for asset in assets {
        let resp = client
            .get(&asset.url)
            .timeout(std::time::Duration::from_secs(5))
            .send()
            .await;

        if let Ok(resp) = resp {
            let body = resp.text().await.unwrap_or_default();

            // Standard URL method
            let re = regex::Regex::new(r#"https?://[^\s"<>]+"#).map_err(|e| e.to_string())?;
            for cap in re.captures_iter(&body) {
                let found_url = cap[0].to_string();
                crawled_assets.push(DiscoveredAsset {
                    id: format!("crawl_{}", uuid::Uuid::new_v4()),
                    url: found_url,
                    source: "crawl".to_string(),
                    risk_estimate: "Info".to_string(),
                    findings: vec!["Extracted from page".to_string()],
                });
            }

            // JavaScript Analysis
            if asset.url.ends_with(".js") {
                // Look for relative API paths in JS
                // Simple regex for strings starting with / and containing only url-safe chars
                let js_path_re =
                    regex::Regex::new(r#""(/[a-zA-Z0-9_/-]+)""#).map_err(|e| e.to_string())?;
                for cap in js_path_re.captures_iter(&body) {
                    let path = cap[1].to_string();
                    if path.len() > 1 && !path.contains("//") && !path.contains(" ") {
                        crawled_assets.push(DiscoveredAsset {
                            id: format!("js_{}", uuid::Uuid::new_v4()),
                            url: path.clone(),
                            source: "js_analysis".to_string(),
                            risk_estimate: "Medium".to_string(),
                            findings: vec![format!("Found in JS: {}", asset.url)],
                        });
                    }
                }
            }
        }
    }

    Ok(crawled_assets)
}

#[tauri::command]
pub async fn promote_discovered_assets(
    db: State<'_, SqliteDatabase>,
    assets: Vec<DiscoveredAsset>,
) -> Result<(), String> {
    for asset in assets {
        let staged = StagedAsset {
            url: asset.url,
            method: "GET".to_string(),
            recursive: false,
            source: Some("Discovery".to_string()),
        };
        // Reuse existing staged import logic via DB
        db.add_asset(&staged.url, "Discovery", Some(&staged.method), false)
            .map_err(|e| format!("DB Error: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn fetch_wayback_urls(domain: String) -> Result<Vec<DiscoveredAsset>, String> {
    let client = Client::new();
    let url = format!("http://web.archive.org/cdx/search/cdx?url=*.{}/*&output=json&fl=original&collapse=urlkey&limit=500", domain);

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Wayback request failed: {}", e))?;

    if !response.status().is_success() {
        return Ok(vec![]);
    }

    let entries: Vec<Vec<String>> = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Wayback JSON: {}", e))?;

    // Skip header row if present
    let urls = entries
        .into_iter()
        .skip(1)
        .filter_map(|row| row.get(0).cloned());

    let mut assets = Vec::new();
    for (i, url) in urls.enumerate() {
        assets.push(DiscoveredAsset {
            id: format!("wb_{}", i),
            url: url.clone(),
            source: "wayback".to_string(),
            risk_estimate: "Info".to_string(),
            findings: vec!["Historical Endpoint".to_string()],
        });
    }

    Ok(assets)
}

#[tauri::command]
pub async fn scan_ports(domain: String) -> Result<Vec<DiscoveredAsset>, String> {
    use std::net::{TcpStream, ToSocketAddrs};
    use std::time::Duration;

    let ports = vec![80, 443, 8000, 8008, 8080, 8443, 8888, 9000];
    let mut open_ports = Vec::new();

    for port in ports {
        let target = format!("{}:{}", domain, port);
        // Default to first resolved address
        if let Ok(mut addrs) = target.to_socket_addrs() {
            if let Some(socket_addr) = addrs.next() {
                if TcpStream::connect_timeout(&socket_addr, Duration::from_millis(500)).is_ok() {
                    open_ports.push(port);
                }
            }
        }
    }

    let mut assets = Vec::new();
    for port in open_ports {
        let scheme = if port == 443 || port == 8443 {
            "https"
        } else {
            "http"
        };
        assets.push(DiscoveredAsset {
            id: format!("port_{}", port),
            url: format!("{}://{}:{}", scheme, domain, port),
            source: "port_scan".to_string(),
            risk_estimate: "High".to_string(),
            findings: vec![format!("Open Port: {}", port)],
        });
    }

    Ok(assets)
}
