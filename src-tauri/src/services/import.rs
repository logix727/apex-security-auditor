use crate::commands::debug::{emit_log, LogLevel};
use crate::db::{ImportResult, SqliteDatabase, StagedAsset};
use regex::Regex;
use std::collections::HashSet;
use tauri::{AppHandle, Emitter, Manager};

pub struct ImportService {
    db: SqliteDatabase,
}

impl ImportService {
    pub fn new(db: SqliteDatabase) -> Self {
        Self { db }
    }

    pub async fn process_staged_assets(
        &self,
        app: AppHandle,
        assets: Vec<StagedAsset>,
        source: String,
        options: crate::db::ImportOptions,
    ) -> Result<ImportResult, String> {
        emit_log(
            &app,
            LogLevel::Info,
            "backend:import",
            &format!(
                "Staged import started for {} assets. Global Source: {}",
                assets.len(),
                source
            ),
            None,
        );
        let mut ids = Vec::new();
        let mut errors = Vec::new();

        for asset in assets {
            // Only skip duplicates if NOT importing to Workbench.
            // Workbench imports need to pass through so is_workbench gets set on existing assets.
            let is_workbench_dest = options.destination == "workbench";
            if options.skip_duplicates
                && !is_workbench_dest
                && self
                    .db
                    .asset_exists_by_url_method(&asset.url, &asset.method)
            {
                emit_log(
                    &app,
                    LogLevel::Warn,
                    "backend:import",
                    &format!("Skipping duplicate asset: {}", asset.url),
                    None,
                );
                continue;
            }

            emit_log(
                &app,
                LogLevel::Info,
                "backend:import",
                &format!("Processing staged asset: {}", asset.url),
                Some(serde_json::json!({ "method": asset.method, "source": asset.source })),
            );
            // Initial simple normalization
            let mut normalized_url = asset.url.trim().to_string();
            if !normalized_url.starts_with("http://")
                && !normalized_url.starts_with("https://")
                && normalized_url.contains('.')
            {
                normalized_url = format!("https://{}", normalized_url);
            }

            let normalized = match crate::utils::url_utils::normalize_url(&normalized_url) {
                Some(n) => n,
                None => normalized_url.clone(),
            };

            let asset_id = match self.db.add_asset(
                &normalized,
                asset.source.as_ref().unwrap_or(&source),
                Some(&asset.method),
                asset.recursive,
                is_workbench_dest,
                0,
            ) {
                Ok(id) => {
                    emit_log(
                        &app,
                        LogLevel::Success,
                        "backend:import",
                        &format!("Asset successfully added/updated with ID: {}", id),
                        Some(serde_json::json!({ "id": id, "url": normalized })),
                    );
                    id
                }
                Err(e) => {
                    let err_msg = format!("Failed to add staged asset {}: {}", asset.url, e);
                    emit_log(&app, LogLevel::Error, "backend:import", &err_msg, None);
                    errors.push(err_msg);
                    continue;
                }
            };

            // Force workbench status if the global intent is Workbench.
            if source == "Workbench" {
                if let Err(e) = self.db.update_asset_workbench_status(asset_id, true) {
                    emit_log(
                        &app,
                        LogLevel::Error,
                        "backend:import",
                        &format!("Failed to set Workbench status for {}: {}", asset_id, e),
                        None,
                    );
                } else {
                    emit_log(
                        &app,
                        LogLevel::Info,
                        "backend:import",
                        &format!("Set Workbench status for asset {}", asset_id),
                        None,
                    );
                }
            }

            ids.push(asset_id);

            // Smart Caching: Skip scan if recently processed (within last 10 mins)
            let cached_result = if self
                .db
                .is_asset_recently_scanned(&normalized, &asset.method, 10)
            {
                let _ = app.emit("scan-update", asset_id);
                true
            } else {
                false
            };

            let app_handle = app.clone();
            let url_clone = normalized.clone();
            let method_clone = asset.method.clone();
            let recursive_flag = asset.recursive;

            tauri::async_runtime::spawn(async move {
                let db_state = app_handle.state::<SqliteDatabase>();

                let scan_service =
                    crate::services::scan::ScanService::new(db_state.inner().clone());

                let result = if !cached_result {
                    let r = scan_service.scan_url(&url_clone, &method_clone).await;

                    let _ = db_state.update_scan_result(
                        asset_id,
                        &r.status,
                        r.status_code,
                        r.risk_score,
                        r.findings.clone(),
                        &r.response_headers,
                        &r.response_body,
                        &r.request_headers,
                        &r.request_body,
                    );
                    let _ = app_handle.emit("scan-update", asset_id);
                    Some(r)
                } else if recursive_flag {
                    Some(scan_service.scan_url(&url_clone, &method_clone).await)
                } else {
                    None
                };

                if recursive_flag {
                    if let Some(r) = result {
                        let authorized_domains =
                            db_state.get_authorized_domains().unwrap_or_default();
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

                        for discovered_url in r.discovered_urls {
                            if let Ok(parsed) = url::Url::parse(&discovered_url) {
                                if let Some(host) = parsed.host_str() {
                                    let is_blacklisted =
                                        blacklist.iter().any(|&d| host.to_lowercase().contains(d));
                                    let is_authorized = authorized_domains
                                        .iter()
                                        .any(|d| host == d || host.ends_with(&format!(".{}", d)));

                                    if !is_blacklisted && is_authorized {
                                        let _ = db_state.add_asset(
                                            &discovered_url,
                                            "Recursive",
                                            None,
                                            true,
                                            false,
                                            0,
                                        );
                                    }
                                }
                            }
                        }
                    }
                }
            });
        }

        Ok(ImportResult { ids, errors })
    }

    pub fn analyze_content(content: &str) -> Vec<String> {
        let mut urls = Vec::new();
        let mut seen = HashSet::new();

        let url_pattern = r#"https?://[^\s<>"{}|\\^`\[\]]+"#;
        let re = Regex::new(url_pattern).unwrap();

        let domain_pattern =
            r#"\b(?:[a-zA-Z0-9][-a-zA-Z0-9]*\.)+[a-zA-Z]{2,}(?:/[^\s<>"{}|\\^`\[\]]*)?"#;
        let domain_re = Regex::new(domain_pattern).unwrap();

        for cap in re.find_iter(content) {
            let url = cap.as_str().trim().to_string();
            if !seen.contains(&url) {
                seen.insert(url.clone());
                urls.push(url);
            }
        }

        for cap in domain_re.find_iter(content) {
            let domain = cap.as_str().trim();

            let has_letters = domain.chars().any(|c| c.is_alphabetic());
            if !has_letters && domain.matches('.').count() < 3 {
                continue;
            }

            if domain.starts_with("http://") || domain.starts_with("https://") {
                continue;
            }
            let url = format!("https://{}", domain);
            if !seen.contains(&url) {
                seen.insert(url.clone());
                urls.push(url);
            }
        }

        urls
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_analyze_content_basic() {
        let content = "https://example.com and http://test.org";
        let urls = ImportService::analyze_content(content);
        assert_eq!(urls.len(), 2);
        assert!(urls.contains(&"https://example.com".to_string()));
        assert!(urls.contains(&"http://test.org".to_string()));
    }

    #[test]
    fn test_analyze_content_domains() {
        let content = "example.com and test.org/path";
        let urls = ImportService::analyze_content(content);
        // Should infer https
        assert!(urls.contains(&"https://example.com".to_string()));
        assert!(urls.contains(&"https://test.org/path".to_string()));
    }

    #[test]
    fn test_analyze_content_duplicates() {
        let content = "https://example.com https://example.com";
        let urls = ImportService::analyze_content(content);
        assert_eq!(urls.len(), 1);
    }
}
