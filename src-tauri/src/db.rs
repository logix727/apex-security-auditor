use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

pub use crate::data::{Badge, Severity};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Folder {
    pub id: i64,
    pub name: String,
    pub parent_id: Option<i64>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Asset {
    pub id: i64,
    pub url: String,
    pub method: String,
    pub status: String,
    pub status_code: i32,
    pub risk_score: i32,
    pub findings: Vec<Badge>,
    pub folder_id: i64,
    pub response_headers: String,
    pub response_body: String,
    pub request_headers: String,
    pub request_body: String,
    pub created_at: String,
    pub updated_at: String,
    pub notes: String,
    pub triage_status: String,
    pub is_documented: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ScanHistoryEntry {
    pub id: i64,
    pub asset_id: i64,
    pub timestamp: String,
    pub status_code: i32,
    pub risk_score: i32,
    pub findings: Vec<Badge>,
    pub response_headers: String,
    pub response_body: String,
}

pub struct Database {
    conn: Mutex<Connection>,
    pub client: reqwest::Client,
}

impl Database {
    pub fn new(path: &str) -> Result<Self> {
        let conn = Connection::open(path)?;

        // Create folders table
        if let Err(e) = conn.execute(
            "CREATE TABLE IF NOT EXISTS folders (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        ) {
            eprintln!("Database Folders Table Creation Error: {}", e);
        }

        // Create assets table with folder_id
        if let Err(e) = conn.execute(
            "CREATE TABLE IF NOT EXISTS assets (
                id INTEGER PRIMARY KEY,
                url TEXT NOT NULL UNIQUE,
                method TEXT DEFAULT 'GET',
                status TEXT DEFAULT 'Pending',
                status_code INTEGER DEFAULT 0,
                risk_score INTEGER DEFAULT 0,
                findings TEXT DEFAULT '',
                folder_id INTEGER DEFAULT 1,
                response_headers TEXT DEFAULT '',
                response_body TEXT DEFAULT '',
                request_headers TEXT DEFAULT '',
                request_body TEXT DEFAULT '',
                notes TEXT DEFAULT '',
                triage_status TEXT DEFAULT 'Unreviewed',
                is_documented BOOLEAN NOT NULL DEFAULT 1,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        ) {
            eprintln!("Database Assets Table Creation Error: {}", e);
        }

        // Ensure a default folder exists
        let _ = conn.execute(
            "INSERT OR IGNORE INTO folders (id, name) VALUES (1, 'Default')",
            [],
        );

        // Robust Migration: Check if column exists before adding
        let col_exists: bool = conn
            .query_row(
                "SELECT count(*) FROM pragma_table_info('assets') WHERE name='status_code'",
                [],
                |row| row.get::<_, i32>(0),
            )
            .unwrap_or(0)
            > 0;

        if !col_exists {
            if let Err(e) = conn.execute(
                "ALTER TABLE assets ADD COLUMN status_code INTEGER DEFAULT 0",
                [],
            ) {
                eprintln!("Migration Error (status_code): {}", e);
            } else {
                println!("Successfully added status_code column.");
            }
        }

        // Migration: Check for updated_at
        let updated_at_exists: bool = conn
            .query_row(
                "SELECT count(*) FROM pragma_table_info('assets') WHERE name='updated_at'",
                [],
                |row| row.get::<_, i32>(0),
            )
            .unwrap_or(0)
            > 0;

        if !updated_at_exists {
            if let Err(e) = conn.execute(
                "ALTER TABLE assets ADD COLUMN updated_at DATETIME DEFAULT '1970-01-01 00:00:00'",
                [],
            ) {
                eprintln!("Migration Error (updated_at add): {}", e);
            } else {
                // Now update existing rows to current timestamp
                if let Err(e) = conn.execute("UPDATE assets SET updated_at = CURRENT_TIMESTAMP", [])
                {
                    eprintln!("Migration Error (updated_at init): {}", e);
                } else {
                    println!("Successfully added and initialized updated_at column.");
                }
            }
        }

        // Migration: Check for folder_id
        let folder_id_exists: bool = conn
            .query_row(
                "SELECT count(*) FROM pragma_table_info('assets') WHERE name='folder_id'",
                [],
                |row| row.get::<_, i32>(0),
            )
            .unwrap_or(0)
            > 0;

        if !folder_id_exists {
            if let Err(e) = conn.execute(
                "ALTER TABLE assets ADD COLUMN folder_id INTEGER DEFAULT 1",
                [],
            ) {
                eprintln!("Migration Error (folder_id): {}", e);
            } else {
                println!("Successfully added folder_id column.");
            }
        }

        // Migration: Check for parent_id in folders
        let parent_id_exists: bool = conn
            .query_row(
                "SELECT count(*) FROM pragma_table_info('folders') WHERE name='parent_id'",
                [],
                |row| row.get::<_, i32>(0),
            )
            .unwrap_or(0)
            > 0;

        if !parent_id_exists {
            if let Err(e) = conn.execute("ALTER TABLE folders ADD COLUMN parent_id INTEGER", []) {
                eprintln!("Migration Error (parent_id): {}", e);
            } else {
                println!("Successfully added parent_id column to folders.");
            }
        }

        // Migration: Check for response/request columns
        let columns = vec![
            "response_headers",
            "response_body",
            "request_headers",
            "request_body",
            "notes",
            "triage_status",
        ];
        for col in columns {
            let col_exists: bool = conn
                .query_row(
                    &format!(
                        "SELECT count(*) FROM pragma_table_info('assets') WHERE name='{}'",
                        col
                    ),
                    [],
                    |row| row.get::<_, i32>(0),
                )
                .unwrap_or(0)
                > 0;

            if !col_exists {
                if let Err(e) = conn.execute(
                    &format!("ALTER TABLE assets ADD COLUMN {} TEXT DEFAULT ''", col),
                    [],
                ) {
                    eprintln!("Migration Error ({}): {}", col, e);
                } else {
                    println!("Successfully added {} column.", col);
                }
            }
        }

        // Migration: Check for is_documented column (Shadow API detection support)
        let is_documented_exists: bool = conn
            .query_row(
                "SELECT count(*) FROM pragma_table_info('assets') WHERE name='is_documented'",
                [],
                |row| row.get::<_, i32>(0),
            )
            .unwrap_or(0)
            > 0;

        if !is_documented_exists {
            if let Err(e) = conn.execute(
                "ALTER TABLE assets ADD COLUMN is_documented BOOLEAN NOT NULL DEFAULT 1",
                [],
            ) {
                eprintln!("Migration Error (is_documented): {}", e);
            } else {
                println!("Successfully added is_documented column for Shadow API detection.");
            }
        }

        // Create scan_history table
        if let Err(e) = conn.execute(
            "CREATE TABLE IF NOT EXISTS scan_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                asset_id INTEGER NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                status_code INTEGER DEFAULT 0,
                risk_score INTEGER DEFAULT 0,
                findings TEXT DEFAULT '[]',
                response_headers TEXT DEFAULT '',
                response_body TEXT DEFAULT '',
                FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE CASCADE
            )",
            [],
        ) {
            eprintln!("Database Scan History Table Creation Error: {}", e);
        }

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .danger_accept_invalid_certs(true)
            .build()
            .unwrap_or_default();

        Ok(Database {
            conn: Mutex::new(conn),
            client,
        })
    }

    pub fn add_asset(&self, url: &str) -> Result<i64> {
        let conn = match self.conn.lock() {
            Ok(c) => c,
            Err(e) => {
                eprintln!("Database Mutex poisoned: {}", e);
                return Err(rusqlite::Error::InvalidPath(std::path::PathBuf::from(
                    "Poisoned Mutex",
                )));
            }
        };
        // Quietly ignore duplicates (OR IGNORE)
        conn.execute(
            "INSERT OR IGNORE INTO assets (url, status) VALUES (?1, 'Pending')",
            params![url],
        )?;
        // Return the ID of the inserted (or existing) row
        // In case of IGNORE, last_insert_rowid might not be what we want if it didn't insert.
        // For simplicity, let's select the ID.
        let id: i64 = conn.query_row(
            "SELECT id FROM assets WHERE url = ?1",
            params![url],
            |row| row.get(0),
        )?;
        Ok(id)
    }

    pub fn get_assets(&self) -> Result<Vec<Asset>> {
        let conn = match self.conn.lock() {
            Ok(c) => c,
            Err(e) => {
                eprintln!("Database Mutex poisoned: {}", e);
                return Err(rusqlite::Error::InvalidPath(std::path::PathBuf::from(
                    "Poisoned Mutex",
                )));
            }
        };
        let mut stmt = conn.prepare("SELECT id, url, method, status, status_code, risk_score, findings, folder_id, response_headers, response_body, request_headers, request_body, created_at, updated_at, notes, triage_status, is_documented FROM assets ORDER BY id DESC")?;

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
            })
        })?;

        let mut assets = Vec::new();
        for asset in asset_iter {
            assets.push(asset?);
        }
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
        let conn = match self.conn.lock() {
            Ok(c) => c,
            Err(e) => {
                eprintln!("Database Mutex poisoned: {}", e);
                return Err(rusqlite::Error::InvalidPath(std::path::PathBuf::from(
                    "Poisoned Mutex",
                )));
            }
        };

        // Archive current state before updating
        let current_asset: Result<(i32, i32, String, String, String)> = conn.query_row(
            "SELECT status_code, risk_score, findings, response_headers, response_body FROM assets WHERE id = ?1",
            params![id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?)),
        );

        if let Ok((old_code, old_risk, old_findings, old_headers, old_body)) = current_asset {
            // Only archive if it was already scanned (not freshly added 'Pending')
            if old_code != 0 || !old_body.is_empty() {
                let _ = conn.execute(
                    "INSERT INTO scan_history (asset_id, status_code, risk_score, findings, response_headers, response_body) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                    params![id, old_code, old_risk, old_findings, old_headers, old_body],
                );
            }
        }

        let findings_json = serde_json::to_string(&findings).unwrap_or_else(|_| "[]".to_string());
        if let Err(e) = conn.execute(
            "UPDATE assets SET status = ?1, status_code = ?2, risk_score = ?3, findings = ?4, response_headers = ?5, response_body = ?6, request_headers = ?7, request_body = ?8, updated_at = CURRENT_TIMESTAMP WHERE id = ?9",
            params![status, status_code, risk_score, findings_json, resp_headers, resp_body, req_headers, req_body, id],
        ) {
            eprintln!("Database Update Error for ID {}: {}", id, e);
            return Err(e);
        }
        Ok(())
    }

    pub fn get_asset_history(&self, asset_id: i64) -> Result<Vec<ScanHistoryEntry>> {
        let conn = self.conn.lock().map_err(|_| {
            rusqlite::Error::InvalidPath(std::path::PathBuf::from("Poisoned Mutex"))
        })?;

        let mut stmt = conn.prepare("SELECT id, asset_id, timestamp, status_code, risk_score, findings, response_headers, response_body FROM scan_history WHERE asset_id = ?1 ORDER BY id DESC LIMIT 50")?;

        let history_iter = stmt.query_map(params![asset_id], |row| {
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

    pub fn get_suspect_assets(&self) -> Result<Vec<Asset>> {
        let conn = self.conn.lock().map_err(|_| {
            rusqlite::Error::InvalidPath(std::path::PathBuf::from("Poisoned Mutex"))
        })?;

        let mut stmt = conn.prepare("SELECT id, url, method, status, status_code, risk_score, findings, folder_id, response_headers, response_body, request_headers, request_body, created_at, updated_at, notes, triage_status, is_documented FROM assets WHERE triage_status = 'Suspect' OR risk_score > 0 ORDER BY risk_score DESC")?;

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
            })
        })?;

        let mut assets = Vec::new();
        for asset in asset_iter {
            assets.push(asset?);
        }
        Ok(assets)
    }

    pub fn update_asset_triage(&self, id: i64, triage_status: &str, notes: &str) -> Result<()> {
        let conn = self.conn.lock().map_err(|_| {
            rusqlite::Error::InvalidPath(std::path::PathBuf::from("Poisoned Mutex"))
        })?;
        conn.execute(
            "UPDATE assets SET triage_status = ?1, notes = ?2, updated_at = CURRENT_TIMESTAMP WHERE id = ?3",
            params![triage_status, notes, id],
        )?;
        Ok(())
    }

    pub fn get_stale_assets(&self, limit: i32, minutes_stale: i32) -> Result<Vec<Asset>> {
        let conn = match self.conn.lock() {
            Ok(c) => c,
            Err(e) => {
                eprintln!("Database Mutex poisoned: {}", e);
                return Err(rusqlite::Error::InvalidPath(std::path::PathBuf::from(
                    "Poisoned Mutex",
                )));
            }
        };

        let mut stmt = conn.prepare("
            SELECT id, url, method, status, status_code, risk_score, findings, folder_id, response_headers, response_body, request_headers, request_body, created_at, updated_at, notes, triage_status, is_documented 
            FROM assets 
            WHERE datetime(updated_at, '+' || ?1 || ' minutes') < datetime('now')
            OR status = 'Pending'
            ORDER BY updated_at ASC
            LIMIT ?2
        ")?;

        let asset_iter = stmt.query_map(params![minutes_stale, limit], |row| {
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
            })
        })?;

        let mut assets = Vec::new();
        for asset in asset_iter {
            assets.push(asset?);
        }
        Ok(assets)
    }

    pub fn delete_asset(&self, id: i64) -> Result<()> {
        let conn = match self.conn.lock() {
            Ok(c) => c,
            Err(e) => {
                eprintln!("Database Mutex poisoned: {}", e);
                return Err(rusqlite::Error::InvalidPath(std::path::PathBuf::from(
                    "Poisoned Mutex",
                )));
            }
        };
        conn.execute("DELETE FROM assets WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn add_folder(&self, name: &str, parent_id: Option<i64>) -> Result<i64> {
        let conn = self.conn.lock().map_err(|_| {
            rusqlite::Error::InvalidPath(std::path::PathBuf::from("Poisoned Mutex"))
        })?;
        conn.execute(
            "INSERT INTO folders (name, parent_id) VALUES (?1, ?2)",
            params![name, parent_id],
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn get_folders(&self) -> Result<Vec<Folder>> {
        let conn = self.conn.lock().map_err(|_| {
            rusqlite::Error::InvalidPath(std::path::PathBuf::from("Poisoned Mutex"))
        })?;
        let mut stmt =
            conn.prepare("SELECT id, name, parent_id, created_at FROM folders ORDER BY id ASC")?;
        let folder_iter = stmt.query_map([], |row| {
            Ok(Folder {
                id: row.get(0)?,
                name: row.get(1)?,
                parent_id: row.get(2)?,
                created_at: row.get(3)?,
            })
        })?;
        let mut folders = Vec::new();
        for f in folder_iter {
            folders.push(f?);
        }
        Ok(folders)
    }

    pub fn move_assets_to_folder(&self, asset_ids: Vec<i64>, folder_id: i64) -> Result<()> {
        let conn = self.conn.lock().map_err(|_| {
            rusqlite::Error::InvalidPath(std::path::PathBuf::from("Poisoned Mutex"))
        })?;
        for id in asset_ids {
            conn.execute(
                "UPDATE assets SET folder_id = ?1 WHERE id = ?2",
                params![folder_id, id],
            )?;
        }
        Ok(())
    }

    pub fn delete_folder(&self, id: i64) -> Result<()> {
        let conn = self.conn.lock().map_err(|_| {
            rusqlite::Error::InvalidPath(std::path::PathBuf::from("Poisoned Mutex"))
        })?;
        // Move assets to default folder (1) before deleting
        conn.execute(
            "UPDATE assets SET folder_id = 1 WHERE folder_id = ?1",
            params![id],
        )?;
        conn.execute("DELETE FROM folders WHERE id = ?1 AND id != 1", params![id])?;
        Ok(())
    }

    pub fn clear_all_assets(&self) -> Result<()> {
        let conn = self.conn.lock().map_err(|_| {
            rusqlite::Error::InvalidPath(std::path::PathBuf::from("Poisoned Mutex"))
        })?;
        conn.execute("DELETE FROM assets", [])?;
        Ok(())
    }

    pub fn sanitize_urls(&self) -> Result<usize> {
        let conn = self.conn.lock().map_err(|_| {
            rusqlite::Error::InvalidPath(std::path::PathBuf::from("Poisoned Mutex"))
        })?;

        let mut stmt = conn.prepare("SELECT id, url FROM assets")?;
        let asset_iter = stmt.query_map([], |row| {
            Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?))
        })?;

        let mut count = 0;
        for asset in asset_iter {
            let (id, url) = asset?;
            // Aggressive cleaning: Split by comma, semicolon, space, tab and take first part
            let clean_url = url
                .split(|c| c == ',' || c == ';' || c == '\t' || c == ' ')
                .next()
                .unwrap_or("")
                .trim();

            if clean_url != url {
                conn.execute(
                    "UPDATE assets SET url = ?1 WHERE id = ?2",
                    params![clean_url, id],
                )?;
                count += 1;
            }
        }
        Ok(count)
    }

    /// Mark a single asset as a Shadow API (not documented in OpenAPI spec)
    #[allow(dead_code)]
    pub fn mark_asset_as_shadow_api(&self, asset_id: i64) -> Result<()> {
        let conn = self.conn.lock().map_err(|_| {
            rusqlite::Error::InvalidPath(std::path::PathBuf::from("Poisoned Mutex"))
        })?;
        conn.execute(
            "UPDATE assets SET is_documented = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
            params![asset_id],
        )?;
        Ok(())
    }

    /// Mark multiple assets as Shadow APIs in a single transaction
    /// Returns the number of assets updated
    pub fn batch_mark_shadow_apis(&self, asset_ids: &[i64]) -> Result<usize> {
        let conn = self.conn.lock().map_err(|_| {
            rusqlite::Error::InvalidPath(std::path::PathBuf::from("Poisoned Mutex"))
        })?;

        let mut count = 0;
        for asset_id in asset_ids {
            let rows_affected = conn.execute(
                "UPDATE assets SET is_documented = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?1 AND is_documented = 1",
                params![asset_id],
            )?;
            count += rows_affected;
        }

        Ok(count)
    }
}
