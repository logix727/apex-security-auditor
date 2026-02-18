use crate::commands::debug::log_debug;
use crate::db::SqliteDatabase;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

pub fn start_background_monitor(app_handle: AppHandle) {
    tauri::async_runtime::spawn(async move {
        println!("Background Monitor: Initializing specialized security loop...");
        loop {
            tokio::time::sleep(Duration::from_secs(10)).await;

            let db = app_handle.state::<SqliteDatabase>();

            let recursive_enabled = match db.get_setting("recursive_discovery_enabled") {
                Ok(Some(val)) => val == "true",
                _ => false,
            };

            match db.get_pending_scans(10) {
                Ok(pending_assets) => {
                    if !pending_assets.is_empty() {
                        println!(
                            "Background Monitor: Processing {} pending assets.",
                            pending_assets.len()
                        );
                    }
                    for asset in pending_assets {
                        let id = asset.id;
                        let url = asset.url.clone();
                        let method = asset.method.clone();
                        let source = asset.source.clone();
                        let handle = app_handle.clone();

                        tauri::async_runtime::spawn(async move {
                            if source == "Workbench" {
                                if let Err(e) = log_debug(
                                    handle.clone(),
                                    "Info".to_string(),
                                    "Scanner".to_string(),
                                    format!("Skipping recursive scan for Workbench asset: {}", url),
                                    None,
                                ) {
                                    eprintln!("Log error: {}", e);
                                }
                            }

                            let db_state = handle.state::<SqliteDatabase>();
                            let scan_service =
                                crate::services::scan::ScanService::new(db_state.inner().clone());
                            let result = scan_service.scan_url(&url, &method).await;
                            let _ = db_state.update_scan_result(
                                id,
                                &result.status,
                                result.status_code,
                                result.risk_score,
                                result.findings,
                                &result.response_headers,
                                &result.response_body,
                                &result.request_headers,
                                &result.request_body,
                            );

                            let should_recurse = asset.recursive && source != "Workbench";

                            if should_recurse {
                                if !recursive_enabled && source == "Recursive" {
                                    println!("Recursing on asset {} due to Recursive source", url);
                                }

                                if !recursive_enabled && source == "Recursive" {
                                    return;
                                }

                                // 1. Get authorized domains to enforce scope
                                let authorized_domains =
                                    db_state.get_authorized_domains().unwrap_or_default();

                                // 2. Define global recursive blacklist
                                let blacklist = vec![
                                    "twitter.com",
                                    "x.com",
                                    "facebook.com",
                                    "instagram.com",
                                    "linkedin.com",
                                    "youtube.com",
                                    "wikipedia.org",
                                    "github.com",
                                    "apple.com",
                                    "google.com",
                                    "microsoft.com",
                                    "cdn.prod.website-files.com",
                                ];

                                for discovered_url in result.discovered_urls {
                                    if let Ok(parsed) = url::Url::parse(&discovered_url) {
                                        if let Some(host) = parsed.host_str() {
                                            // Check blacklist (case insensitive)
                                            let is_blacklisted = blacklist
                                                .iter()
                                                .any(|&d| host.to_lowercase().contains(d));

                                            // Check domain scope: host must match an authorized domain
                                            // OR be a subdomain of an authorized domain
                                            let is_authorized =
                                                authorized_domains.iter().any(|d| {
                                                    host == d || host.ends_with(&format!(".{}", d))
                                                });

                                            if !is_blacklisted && is_authorized {
                                                // Depth control: limit to depth 3
                                                if asset.depth < 3 {
                                                    let _ = db_state.add_asset(
                                                        &discovered_url,
                                                        "Recursive",
                                                        None,
                                                        true,
                                                        false,
                                                        asset.depth + 1,
                                                    );
                                                } else {
                                                    println!("Depth limit reached for {}, skipping recursive sub-discovery", discovered_url);
                                                    // Still add the asset but stop recursing further from it
                                                    let _ = db_state.add_asset(
                                                        &discovered_url,
                                                        "Recursive",
                                                        None,
                                                        false,
                                                        false,
                                                        asset.depth + 1,
                                                    );
                                                }
                                            } else if is_blacklisted {
                                                // Log for visibility during debugging
                                                println!("Skipping blacklisted recursive discovery: {} (host: {})", discovered_url, host);
                                            } else {
                                                println!("Skipping out-of-scope recursive discovery: {} (host: {})", discovered_url, host);
                                            }
                                        }
                                    }
                                }
                            }

                            let _ = handle.emit("scan-update", id);
                        });
                    }
                }
                Err(e) => eprintln!(
                    "Background Monitor Error: Failed to fetch pending assets: {}",
                    e
                ),
            }
        }
    });
}
