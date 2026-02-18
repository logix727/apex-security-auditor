use crate::db::{SqliteDatabase, StagedAsset};
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

use futures::stream::{self, StreamExt};

#[tauri::command]
pub async fn discover_subdomains(domain: String) -> Result<Vec<DiscoveredAsset>, String> {
    let client = Client::builder()
        .timeout(std::time::Duration::from_secs(3))
        .build()
        .map_err(|e| e.to_string())?;

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

    // Limit to 50 subdomains for performance if the list is huge, or just process them all?
    // crt.sh can return thousands. Let's process max 100 for now to be safe.
    let target_urls: Vec<String> = subdomains
        .into_iter()
        .take(100)
        .map(|sub| {
            if sub.starts_with("http") {
                sub
            } else {
                format!("https://{}", sub)
            }
        })
        .collect();

    let results = stream::iter(target_urls)
        .map(|url| {
            let client = &client;
            async move { probe_asset(client, url).await }
        })
        .buffer_unordered(10) // Concurrency limit
        .collect::<Vec<_>>()
        .await;

    // Assign IDs based on index
    let final_assets = results
        .into_iter()
        .enumerate()
        .map(|(i, mut asset)| {
            asset.id = format!("disc_{}", i);
            asset
        })
        .collect();

    Ok(final_assets)
}

async fn probe_asset(client: &Client, url: String) -> DiscoveredAsset {
    let static_risk = crate::core::risk::calculate_risk_for_asset(&url, "GET");
    let mut findings = vec!["New Subdomain".to_string()];
    let mut risk_level = static_risk.risk_level;
    let source;

    // Active Probing
    match client.head(&url).send().await {
        Ok(resp) => {
            let status = resp.status();
            source = format!("cert+probe({})", status.as_u16());

            if status.is_success() {
                findings.push(format!("Accessible ({})", status));
                // If completely safe (Info), bump to Low because it's public
                if risk_level == "Info" {
                    risk_level = "Low".to_string();
                }

                // Add interesting headers
                if let Some(server) = resp.headers().get("server") {
                    if let Ok(s) = server.to_str() {
                        findings.push(format!("Server: {}", s));
                    }
                }
            } else if status.as_u16() == 401 || status.as_u16() == 403 {
                findings.push(format!("Protected ({})", status));
                // Downgrade risk because it's protected
                if risk_level == "High" || risk_level == "Critical" {
                    findings.push(format!("Downgraded from {} (Protected)", risk_level));
                    risk_level = "Info".to_string();
                }
            } else {
                findings.push(format!("Status: {}", status));
            }
        }
        Err(_) => {
            // Unreachable
            source = "cert (unreachable)".to_string();
            findings.push("Unreachable".to_string());
            risk_level = "Info".to_string();
        }
    }

    // Merge static factors if relevant (and not downgraded)
    if risk_level != "Info" {
        for f in static_risk.risk_factors {
            findings.push(f);
        }
    }

    DiscoveredAsset {
        id: String::new(), // Set later
        url,
        source,
        risk_estimate: risk_level,
        findings,
    }
}

#[tauri::command]
pub async fn crawl_discovered_assets(
    assets: Vec<DiscoveredAsset>,
) -> Result<Vec<DiscoveredAsset>, String> {
    let client = Client::new();
    let mut crawled_assets = Vec::new();

    let url_re = regex::Regex::new(r#"https?://[^\s"<>]+"#).map_err(|e| e.to_string())?;
    let js_path_re = regex::Regex::new(r#""(/[a-zA-Z0-9_/-]+)""#).map_err(|e| e.to_string())?;

    for asset in assets {
        let resp = client
            .get(&asset.url)
            .timeout(std::time::Duration::from_secs(5))
            .send()
            .await;

        if let Ok(resp) = resp {
            let body = resp.text().await.unwrap_or_default();

            // Standard URL method
            for cap in url_re.captures_iter(&body) {
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
        db.add_asset(
            &staged.url,
            "Discovery",
            Some(&staged.method),
            false,
            false,
            0,
        )
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
