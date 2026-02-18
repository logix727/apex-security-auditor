use crate::db::{Asset, Badge, ScanHistoryEntry, Severity, SqliteDatabase};
use crate::error::Result;

impl SqliteDatabase {
    pub fn add_asset(
        &self,
        url: &str,
        source: &str,
        method: Option<&str>,
        recursive: bool,
        is_workbench: bool,
        depth: i32,
    ) -> Result<i64> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| crate::error::Error::Internal(e.to_string()))?;
        let method_val = method.unwrap_or("GET");

        println!(
            "[DB] Adding asset: {} ({}) Source: {}",
            url, method_val, source
        );

        conn.execute(
            "INSERT OR IGNORE INTO assets (url, method, status, source, recursive, is_workbench, depth) VALUES (?1, ?2, 'Pending', ?3, ?4, ?5, ?6)",
            (url, method_val, source, recursive, is_workbench, depth),
        )?;

        let (id, current_recursive, current_source): (i64, bool, String) = conn
            .query_row(
                "SELECT id, recursive, source FROM assets WHERE url = ?1 AND method = ?2",
                (url, method_val),
                |row| {
                    Ok((
                        row.get(0)?,
                        row.get::<_, bool>(1).unwrap_or(false),
                        row.get::<_, String>(2)
                            .unwrap_or_else(|_| "User".to_string()),
                    ))
                },
            )
            .map_err(|e| {
                println!("[DB] Failed to retrieve asset after insert/ignore: {}", e);
                e
            })?;

        println!(
            "[DB] Asset ID: {}, Current Source: {}, Target Source: {}",
            id, current_source, source
        );

        if recursive && !current_recursive {
            let _ = conn.execute("UPDATE assets SET recursive = 1 WHERE id = ?1", [id]);
        }

        // If newly added or existing, update source if provided source is not "Recursive"
        // This allows upgrading "Recursive" assets to "Import" or "Workbench"
        if source != "Recursive" && source != current_source {
            println!(
                "[DB] Updating source for asset {} from {} to {}",
                id, current_source, source
            );
            let _ = conn.execute("UPDATE assets SET source = ?1 WHERE id = ?2", (source, id));
        }

        // If is_workbench is requested, force it!
        if is_workbench {
            println!("[DB] SETTING is_workbench=true for asset ID: {}", id);
            let _ = conn.execute("UPDATE assets SET is_workbench = 1 WHERE id = ?1", [id]);
        }

        Ok(id)
    }

    pub fn get_assets(&self) -> Result<Vec<Asset>> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| crate::error::Error::Internal(e.to_string()))?;
        let mut stmt = conn.prepare("SELECT id, url, method, status, status_code, risk_score, findings, folder_id, response_headers, response_body, request_headers, request_body, created_at, updated_at, notes, triage_status, is_documented, source, recursive, is_workbench, depth FROM assets ORDER BY id DESC")?;

        let asset_iter = stmt.query_map([], |row| {
            let findings_json: String = row.get(6)?;
            let findings: Vec<Badge> = serde_json::from_str(&findings_json).unwrap_or_default();
            Ok(Asset {
                id: row.get(0)?,
                url: row.get(1)?,
                method: row.get(2)?,
                status: row.get(3)?,
                status_code: row.get(4)?,
                risk_score: row.get(5)?,
                findings,
                folder_id: row.get(7)?,
                response_headers: row.get(8)?,
                response_body: row.get(9)?,
                request_headers: row.get(10)?,
                request_body: row.get(11)?,
                created_at: row.get(12)?,
                updated_at: row.get(13)?,
                notes: row.get(14).unwrap_or_else(|_| "".to_string()),
                triage_status: row.get(15).unwrap_or_else(|_| "Unreviewed".to_string()),
                is_documented: row.get(16).unwrap_or(true),
                source: row.get(17).unwrap_or_else(|_| "User".to_string()),
                recursive: row.get(18).unwrap_or(false),
                is_workbench: row.get(19).unwrap_or(false),
                depth: row.get(20).unwrap_or(0),
            })
        })?;

        let mut assets = Vec::new();
        for asset in asset_iter {
            assets.push(asset?);
        }
        let wb_count = assets.iter().filter(|a| a.is_workbench).count();
        println!(
            "[DB] get_assets returning {} assets, {} with is_workbench=true",
            assets.len(),
            wb_count
        );
        Ok(assets)
    }

    pub fn update_scan_result(
        &self,
        id: i64,
        status: &str,
        status_code: i32,
        risk_score: i32,
        findings: Vec<Badge>,
        resp_headers: &str,
        resp_body: &str,
        req_headers: &str,
        req_body: &str,
    ) -> Result<()> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| crate::error::Error::Internal(e.to_string()))?;

        let current_asset: std::result::Result<(i32, i32, String, String, String), rusqlite::Error> = conn.query_row(
            "SELECT status_code, risk_score, findings, response_headers, response_body FROM assets WHERE id = ?1",
            [id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
        );

        if let Ok((old_code, old_risk, old_findings, old_headers, old_body)) = current_asset {
            if old_code != 0 || !old_body.is_empty() {
                let _ = conn.execute(
                    "INSERT INTO scan_history (asset_id, status_code, risk_score, findings, response_headers, response_body) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    (id, old_code, old_risk, old_findings, old_headers, old_body),
                );
            }
        }

        let findings_json = serde_json::to_string(&findings).unwrap_or_else(|_| "[]".to_string());
        conn.execute(
            "UPDATE assets SET status = ?1, status_code = ?2, risk_score = ?3, findings = ?4, response_headers = ?5, response_body = ?6, request_headers = ?7, request_body = ?8, updated_at = CURRENT_TIMESTAMP WHERE id = ?9",
            (status, status_code, risk_score, findings_json, resp_headers, resp_body, req_headers, req_body, id),
        )?;
        Ok(())
    }

    pub fn delete_asset(&self, id: i64) -> Result<()> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| crate::error::Error::Internal(e.to_string()))?;
        conn.execute("DELETE FROM assets WHERE id = ?1", [id])?;
        Ok(())
    }

    pub fn get_asset_history(&self, asset_id: i64) -> Result<Vec<ScanHistoryEntry>> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| crate::error::Error::Internal(e.to_string()))?;
        let mut stmt = conn.prepare("SELECT id, asset_id, timestamp, status_code, risk_score, findings, response_headers, response_body FROM scan_history WHERE asset_id = ?1 ORDER BY id DESC LIMIT 50")?;

        let history_iter = stmt.query_map([asset_id], |row| {
            let findings_json: String = row.get(5)?;
            let findings: Vec<Badge> = serde_json::from_str(&findings_json).unwrap_or_default();
            Ok(ScanHistoryEntry {
                id: row.get(0)?,
                asset_id: row.get(1)?,
                timestamp: row.get(2)?,
                status_code: row.get(3)?,
                risk_score: row.get(4)?,
                findings,
                response_headers: row.get(6)?,
                response_body: row.get(7)?,
            })
        })?;

        let mut history = Vec::new();
        for entry in history_iter {
            history.push(entry?);
        }
        Ok(history)
    }
    pub fn get_authorized_domains(&self) -> Result<std::collections::HashSet<String>> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| crate::error::Error::Internal(e.to_string()))?;
        let mut stmt =
            conn.prepare("SELECT DISTINCT url FROM assets WHERE source != 'Recursive'")?;
        let url_iter = stmt.query_map([], |row| row.get::<_, String>(0))?;

        let mut domains = std::collections::HashSet::new();
        for url_str in url_iter {
            if let Ok(u) = url_str {
                if let Ok(parsed) = url::Url::parse(&u) {
                    if let Some(host) = parsed.host_str() {
                        domains.insert(host.to_string());
                    }
                } else if u.contains('/') {
                    let host = u.split('/').next().unwrap_or(&u);
                    domains.insert(host.to_string());
                }
            }
        }
        Ok(domains)
    }
    pub fn add_authorized_domain(&self, _domain: &str) -> Result<()> {
        Ok(())
    }

    pub fn update_asset_triage(&self, id: i64, triage_status: &str, notes: &str) -> Result<()> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| crate::error::Error::Internal(e.to_string()))?;
        conn.execute(
            "UPDATE assets SET triage_status = ?1, notes = ?2, updated_at = CURRENT_TIMESTAMP WHERE id = ?3",
            (triage_status, notes, id),
        )?;
        Ok(())
    }

    pub fn update_finding_fp(
        &self,
        asset_id: i64,
        short_name: &str,
        evidence: Option<&str>,
        is_fp: bool,
        reason: Option<&str>,
    ) -> Result<()> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| crate::error::Error::Internal(e.to_string()))?;

        let findings_json: String = conn.query_row(
            "SELECT findings FROM assets WHERE id = ?1",
            [asset_id],
            |row| row.get(0),
        )?;

        let mut findings: Vec<Badge> = serde_json::from_str(&findings_json).unwrap_or_default();

        let mut updated = false;
        for f in &mut findings {
            if f.short == short_name && f.evidence.as_deref() == evidence {
                f.is_fp = is_fp;
                f.fp_reason = reason.map(|s| s.to_string());
                updated = true;
            }
        }

        if !updated {
            return Err(crate::error::Error::NotFound(
                "Finding not found".to_string(),
            ));
        }

        let new_findings_json =
            serde_json::to_string(&findings).unwrap_or_else(|_| "[]".to_string());
        conn.execute(
            "UPDATE assets SET findings = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
            (new_findings_json, asset_id),
        )?;

        Ok(())
    }

    pub fn recalculate_asset_risk_score(&self, asset_id: i64) -> Result<()> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| crate::error::Error::Internal(e.to_string()))?;

        let findings_json: String = conn.query_row(
            "SELECT findings FROM assets WHERE id = ?1",
            [asset_id],
            |row| row.get(0),
        )?;

        let findings: Vec<Badge> = serde_json::from_str(&findings_json).unwrap_or_default();

        let mut risk_score = 0;
        for f in &findings {
            if f.is_fp {
                continue;
            }
            risk_score += match f.severity {
                Severity::Critical => 100,
                Severity::High => 50,
                Severity::Medium => 25,
                Severity::Low => 10,
                Severity::Info => 0,
            };
        }

        let final_status = if risk_score >= 100 {
            "Critical"
        } else if risk_score >= 50 {
            "Warning"
        } else if risk_score > 0 {
            "Suspicious"
        } else {
            "Safe"
        };

        conn.execute(
            "UPDATE assets SET risk_score = ?1, status = ?2, updated_at = CURRENT_TIMESTAMP WHERE id = ?3",
            (risk_score, final_status, asset_id),
        )?;

        Ok(())
    }

    pub fn update_asset_source(&self, id: i64, new_source: &str) -> Result<()> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| crate::error::Error::Internal(e.to_string()))?;
        conn.execute(
            "UPDATE assets SET source = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
            (new_source, id),
        )?;
        Ok(())
    }

    pub fn get_pending_scans(&self, limit: i32) -> Result<Vec<Asset>> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| crate::error::Error::Internal(e.to_string()))?;

        let mut stmt = conn.prepare("
            SELECT id, url, method, status, status_code, risk_score, findings, folder_id, response_headers, response_body, request_headers, request_body, created_at, updated_at, notes, triage_status, is_documented, source, recursive, is_workbench, depth 
            FROM assets 
            WHERE status = 'Pending'
            ORDER BY created_at ASC
            LIMIT ?1
        ")?;

        let asset_iter = stmt.query_map([limit], |row| {
            let findings_json: String = row.get(6)?;
            let findings: Vec<Badge> = serde_json::from_str(&findings_json).unwrap_or_default();
            Ok(Asset {
                id: row.get(0)?,
                url: row.get(1)?,
                method: row.get(2)?,
                status: row.get(3)?,
                status_code: row.get(4)?,
                risk_score: row.get(5)?,
                findings,
                folder_id: row.get(7)?,
                response_headers: row.get(8)?,
                response_body: row.get(9)?,
                request_headers: row.get(10)?,
                request_body: row.get(11)?,
                created_at: row.get(12)?,
                updated_at: row.get(13)?,
                notes: row.get(14).unwrap_or_else(|_| "".to_string()),
                triage_status: row.get(15).unwrap_or_else(|_| "Unreviewed".to_string()),
                is_documented: row.get(16).unwrap_or(true),
                source: row.get(17).unwrap_or_else(|_| "User".to_string()),
                recursive: row.get(18).unwrap_or(false),
                is_workbench: row.get(19).unwrap_or(false),
                depth: row.get(20).unwrap_or(0),
            })
        })?;

        let mut assets = Vec::new();
        for asset in asset_iter {
            assets.push(asset?);
        }
        Ok(assets)
    }

    pub fn get_stale_assets(&self, limit: i32, minutes_stale: i32) -> Result<Vec<Asset>> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| crate::error::Error::Internal(e.to_string()))?;

        let mut stmt = conn.prepare("
            SELECT id, url, method, status, status_code, risk_score, findings, folder_id, response_headers, response_body, request_headers, request_body, created_at, updated_at, notes, triage_status, is_documented, source, recursive, is_workbench, depth 
            FROM assets 
            WHERE datetime(updated_at, '+' || ?1 || ' minutes') < datetime('now')
            OR status = 'Pending'
            ORDER BY updated_at ASC
            LIMIT ?2
        ")?;

        let asset_iter = stmt.query_map((minutes_stale, limit), |row| {
            let findings_json: String = row.get(6)?;
            let findings: Vec<Badge> = serde_json::from_str(&findings_json).unwrap_or_default();
            Ok(Asset {
                id: row.get(0)?,
                url: row.get(1)?,
                method: row.get(2)?,
                status: row.get(3)?,
                status_code: row.get(4)?,
                risk_score: row.get(5)?,
                findings,
                folder_id: row.get(7)?,
                response_headers: row.get(8)?,
                response_body: row.get(9)?,
                request_headers: row.get(10)?,
                request_body: row.get(11)?,
                created_at: row.get(12)?,
                updated_at: row.get(13)?,
                notes: row.get(14).unwrap_or_else(|_| "".to_string()),
                triage_status: row.get(15).unwrap_or_else(|_| "Unreviewed".to_string()),
                is_documented: row.get(16).unwrap_or(true),
                source: row.get(17).unwrap_or_else(|_| "User".to_string()),
                recursive: row.get(18).unwrap_or(false),
                is_workbench: row.get(19).unwrap_or(false),
                depth: row.get(20).unwrap_or(0),
            })
        })?;

        let mut assets = Vec::new();
        for asset in asset_iter {
            assets.push(asset?);
        }
        Ok(assets)
    }

    pub fn clear_all_assets(&self) -> Result<()> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| crate::error::Error::Internal(e.to_string()))?;
        conn.execute("DELETE FROM assets", [])?;
        Ok(())
    }

    pub fn purge_recursive_assets(&self) -> Result<usize> {
        let authorized_domains = self.get_authorized_domains()?;
        let conn = self
            .conn
            .lock()
            .map_err(|e| crate::error::Error::Internal(e.to_string()))?;

        let mut stmt = conn.prepare("SELECT id, url FROM assets WHERE source = 'Recursive'")?;
        let asset_iter = stmt.query_map([], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
        })?;

        let mut ids_to_delete = Vec::new();
        for asset in asset_iter {
            let (id, url_str) = asset?;
            if let Ok(parsed) = url::Url::parse(&url_str) {
                if let Some(host) = parsed.host_str() {
                    let is_authorized = authorized_domains
                        .iter()
                        .any(|d| host == d || host.ends_with(&format!(".{}", d)));
                    if !is_authorized {
                        ids_to_delete.push(id);
                    }
                }
            } else {
                ids_to_delete.push(id);
            }
        }

        let count = ids_to_delete.len();
        for id in ids_to_delete {
            conn.execute("DELETE FROM assets WHERE id = ?1", [id])?;
        }
        Ok(count)
    }

    pub fn sanitize_urls(&self) -> Result<usize> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| crate::error::Error::Internal(e.to_string()))?;

        let mut stmt = conn.prepare("SELECT id, url FROM assets")?;
        let asset_iter = stmt.query_map([], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
        })?;

        let mut count = 0;
        let mut ids_to_delete = Vec::new();

        for asset in asset_iter {
            let (id, url) = asset?;

            let has_binary = url.chars().any(|c| {
                let code = c as u32;
                (code < 32 && code != 9 && code != 10 && code != 13)
                    || code == 127
                    || (code > 127 && code < 160)
            });

            if has_binary {
                ids_to_delete.push(id);
                count += 1;
                continue;
            }

            let clean_url = url
                .split(|c| c == ',' || c == ';' || c == '\t' || c == ' ')
                .next()
                .unwrap_or("")
                .trim();

            if clean_url != url && !clean_url.is_empty() {
                conn.execute("UPDATE assets SET url = ?1 WHERE id = ?2", (clean_url, id))?;
                count += 1;
            } else if clean_url.is_empty() {
                ids_to_delete.push(id);
                count += 1;
            }
        }

        for id in ids_to_delete {
            conn.execute("DELETE FROM assets WHERE id = ?1", [id])?;
        }

        Ok(count)
    }

    pub fn update_asset_documentation(&self, id: i64, is_documented: bool) -> Result<()> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| crate::error::Error::Internal(e.to_string()))?;
        conn.execute(
            "UPDATE assets SET is_documented = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
            (is_documented, id),
        )?;
        Ok(())
    }

    pub fn update_asset_workbench_status(&self, id: i64, is_workbench: bool) -> Result<()> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| crate::error::Error::Internal(e.to_string()))?;
        conn.execute(
            "UPDATE assets SET is_workbench = ?1, updated_at = CURRENT_TIMESTAMP WHERE id = ?2",
            (is_workbench, id),
        )?;
        Ok(())
    }

    pub fn batch_mark_shadow_apis(&self, asset_ids: &[i64]) -> Result<usize> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| crate::error::Error::Internal(e.to_string()))?;

        let mut count = 0;
        for asset_id in asset_ids {
            let rows_affected = conn.execute(
                "UPDATE assets SET is_documented = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?1 AND is_documented = 1",
                [asset_id],
            )?;
            count += rows_affected;
        }

        Ok(count)
    }

    pub fn asset_exists_by_url_method(&self, url: &str, method: &str) -> bool {
        let conn = match self.conn.lock() {
            Ok(c) => c,
            Err(_) => return false,
        };
        let count: i32 = conn
            .query_row(
                "SELECT COUNT(*) FROM assets WHERE url = ?1 AND method = ?2",
                (url, method),
                |row| row.get(0),
            )
            .unwrap_or(0);
        count > 0
    }

    pub fn is_asset_recently_scanned(&self, url: &str, method: &str, minutes: i32) -> bool {
        let conn = match self.conn.lock() {
            Ok(c) => c,
            Err(_) => return false,
        };

        let result: std::result::Result<i32, rusqlite::Error> = conn.query_row(
            "SELECT 1 FROM assets WHERE url = ?1 AND method = ?2 AND status != 'Pending' AND datetime(updated_at, '+' || ?3 || ' minutes') > datetime('now')",
            (url, method, minutes),
            |row| row.get(0),
        );

        result.is_ok()
    }
}

#[cfg(test)]
mod tests {
    use crate::db::SqliteDatabase;

    fn setup_db() -> SqliteDatabase {
        SqliteDatabase::new(":memory:").expect("Failed to create in-memory db")
    }

    #[test]
    fn test_duplicate_asset_updates_source() {
        let db = setup_db();
        // 1. Add asset as Recursive
        let id1 = db
            .add_asset(
                "http://example.com",
                "Recursive",
                Some("GET"),
                true,
                false,
                0,
            )
            .unwrap();

        // Use verify asset exists
        // Since get_assets returns all, we can filter or just check first
        let assets = db.get_assets().unwrap();
        assert_eq!(assets.len(), 1);
        assert_eq!(assets[0].source, "Recursive");
        assert_eq!(assets[0].recursive, true);

        // 2. Add same asset as Workbench (should update source)
        let id2 = db
            .add_asset(
                "http://example.com",
                "Workbench",
                Some("GET"),
                true,
                true,
                0,
            )
            .unwrap();

        // IDs should be same as we return existing ID
        assert_eq!(id1, id2);

        let assets_updated = db.get_assets().unwrap();
        assert_eq!(assets_updated.len(), 1);
        assert_eq!(assets_updated[0].source, "Workbench"); // Source updated!
        assert_eq!(assets_updated[0].recursive, true);
    }

    #[test]
    fn test_recursive_flag_updates() {
        let db = setup_db();
        // 1. Add asset as Non-Recursive
        let id1 = db
            .add_asset("http://test.com", "Import", Some("GET"), false, false, 0)
            .unwrap();

        let assets = db.get_assets().unwrap();
        assert!(!assets[0].recursive);

        // 2. Add same asset as Recursive
        let id2 = db
            .add_asset("http://test.com", "Import", Some("GET"), true, false, 0)
            .unwrap();

        assert_eq!(id1, id2);

        let assets_updated = db.get_assets().unwrap();
        assert!(assets_updated[0].recursive); // Flag updated!
    }

    #[test]
    fn test_distinct_methods() {
        let db = setup_db();
        let _ = db
            .add_asset("http://api.com", "Import", Some("GET"), false, false, 0)
            .unwrap();
        let _ = db
            .add_asset("http://api.com", "Import", Some("POST"), false, false, 0)
            .unwrap();

        let assets = db.get_assets().unwrap();
        assert_eq!(assets.len(), 2);
    }
}
