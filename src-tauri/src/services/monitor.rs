use crate::commands::debug::log_debug;
use crate::db::SqliteDatabase;
use crate::scan_url;
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

            match db.get_stale_assets(10, 5) {
                Ok(stale_assets) => {
                    if !stale_assets.is_empty() {
                        println!(
                            "Background Monitor: Processing {} assets.",
                            stale_assets.len()
                        );
                    }
                    for asset in stale_assets {
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
                            let result =
                                scan_url(&db_state.client, &url, &method, &db_state.rate_limiter)
                                    .await;
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
                                                let _ = db_state.add_asset(
                                                    &discovered_url,
                                                    "Recursive",
                                                    None,
                                                    true,
                                                );
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
                    "Background Monitor Error: Failed to fetch stale assets: {}",
                    e
                ),
            }
        }
    });
}
