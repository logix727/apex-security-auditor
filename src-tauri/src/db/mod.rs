use crate::error::Result;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::sync::{Arc, Mutex};

pub mod assets;
pub mod folders;
pub mod imports;
pub mod sequences;
pub mod traits;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImportOperation {
    pub id: i64,
    pub import_id: String,
    pub source: String,
    pub total_assets: i32,
    pub successful_assets: i32,
    pub failed_assets: i32,
    pub duplicate_assets: i32,
    pub status: String,
    pub options: ImportOptions,
    pub duration_ms: Option<i64>,
    pub error_message: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImportAsset {
    pub id: i64,
    pub import_id: String,
    pub asset_id: i64,
    pub url: String,
    pub method: String,
    pub status: String,
    pub error_message: Option<String>,
    pub processing_time_ms: i64,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ImportOptions {
    pub destination: String,
    pub recursive: bool,
    pub batch_mode: bool,
    pub rate_limit: i32,
    pub auto_triage: bool,
}

impl Default for ImportOptions {
    fn default() -> Self {
        ImportOptions {
            destination: "asset_manager".to_string(),
            recursive: false,
            batch_mode: true,
            rate_limit: 10,
            auto_triage: false,
        }
    }
}

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
    pub source: String,
    pub recursive: bool,
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

pub struct SqliteDatabase {
    pub(crate) conn: Arc<Mutex<Connection>>,
    pub client: reqwest::Client,
    pub rate_limiter: crate::core::rate_limiter::SharedRateLimiter,
}

impl Clone for SqliteDatabase {
    fn clone(&self) -> Self {
        Self {
            conn: self.conn.clone(),
            client: self.client.clone(),
            rate_limiter: self.rate_limiter.clone(),
        }
    }
}

impl SqliteDatabase {
    pub fn new(path: &str) -> Result<Self> {
        let conn_raw = Connection::open(path)?;
        let conn = Arc::new(Mutex::new(conn_raw));
        let conn_lock = conn
            .lock()
            .map_err(|e| crate::error::Error::Internal(e.to_string()))?;

        Self::init_tables(&conn_lock)?;
        Self::run_migrations(&conn_lock)?;

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .danger_accept_invalid_certs(true)
            .build()
            .unwrap_or_default();

        let rate_limiter = Arc::new(crate::core::rate_limiter::RateLimiter::new(100)); // Default 100ms

        drop(conn_lock);

        Ok(SqliteDatabase {
            conn,
            client,
            rate_limiter,
        })
    }

    fn init_tables(conn: &Connection) -> Result<()> {
        conn.execute(
            "CREATE TABLE IF NOT EXISTS folders (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL UNIQUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )",
            [],
        )?;

        conn.execute(
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
                source TEXT DEFAULT 'User',
                recursive BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        conn.execute(
            "INSERT OR IGNORE INTO folders (id, name) VALUES (1, 'Default')",
            [],
        )?;

        conn.execute(
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
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS import_operations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                import_id TEXT NOT NULL UNIQUE,
                source TEXT NOT NULL,
                total_assets INTEGER NOT NULL,
                successful_assets INTEGER NOT NULL DEFAULT 0,
                failed_assets INTEGER NOT NULL DEFAULT 0,
                duplicate_assets INTEGER NOT NULL DEFAULT 0,
                status TEXT NOT NULL DEFAULT 'queued',
                options TEXT NOT NULL,
                duration_ms INTEGER,
                error_message TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS import_assets (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                import_id TEXT NOT NULL,
                asset_id INTEGER NOT NULL,
                url TEXT NOT NULL,
                method TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                error_message TEXT,
                processing_time_ms INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY(import_id) REFERENCES import_operations(import_id) ON DELETE CASCADE,
                FOREIGN KEY(asset_id) REFERENCES assets(id) ON DELETE CASCADE
            )",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_import_operations_status ON import_operations(status)",
            [],
        )?;
        conn.execute("CREATE INDEX IF NOT EXISTS idx_import_operations_created_at ON import_operations(created_at)", [])?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_import_assets_import_id ON import_assets(import_id)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_import_assets_status ON import_assets(status)",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS sequences (
                id TEXT PRIMARY KEY,
                name TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                context_summary TEXT
            )",
            [],
        )?;

        conn.execute(
            "CREATE TABLE IF NOT EXISTS sequence_steps (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sequence_id TEXT NOT NULL,
                asset_id INTEGER NOT NULL,
                method TEXT NOT NULL,
                url TEXT NOT NULL,
                status_code INTEGER DEFAULT 0,
                request_body TEXT,
                response_body TEXT,
                request_headers TEXT,
                response_headers TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                captures TEXT DEFAULT '[]',
                FOREIGN KEY(sequence_id) REFERENCES sequences(id) ON DELETE CASCADE
            )",
            [],
        )?;

        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_assets_url ON assets(url)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_assets_status ON assets(status)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_assets_folder ON assets(folder_id)",
            [],
        )?;
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_scan_history_asset_id ON scan_history(asset_id)",
            [],
        )?;

        Ok(())
    }

    fn run_migrations(conn: &Connection) -> Result<()> {
        let columns = [
            ("assets", "status_code", "INTEGER DEFAULT 0"),
            (
                "assets",
                "updated_at",
                "DATETIME DEFAULT '1970-01-01 00:00:00'",
            ),
            ("assets", "folder_id", "INTEGER DEFAULT 1"),
            ("folders", "parent_id", "INTEGER"),
            ("assets", "response_headers", "TEXT DEFAULT ''"),
            ("assets", "response_body", "TEXT DEFAULT ''"),
            ("assets", "request_headers", "TEXT DEFAULT ''"),
            ("assets", "request_body", "TEXT DEFAULT ''"),
            ("assets", "notes", "TEXT DEFAULT ''"),
            ("assets", "triage_status", "TEXT DEFAULT 'Unreviewed'"),
            ("assets", "is_documented", "BOOLEAN NOT NULL DEFAULT 1"),
            ("assets", "source", "TEXT DEFAULT 'User'"),
            ("assets", "recursive", "BOOLEAN DEFAULT 0"),
            ("sequence_steps", "captures", "TEXT DEFAULT '[]'"),
        ];

        for (table, name, def) in columns {
            let exists: bool = conn
                .query_row(
                    &format!(
                        "SELECT count(*) FROM pragma_table_info('{}') WHERE name='{}'",
                        table, name
                    ),
                    [],
                    |row| row.get::<_, i32>(0),
                )
                .unwrap_or(0)
                > 0;

            if !exists {
                conn.execute(
                    &format!("ALTER TABLE {} ADD COLUMN {} {}", table, name, def),
                    [],
                )?;
                if name == "updated_at" {
                    conn.execute("UPDATE assets SET updated_at = CURRENT_TIMESTAMP", [])?;
                }
            }
        }
        Ok(())
    }

    pub fn get_setting(&self, key: &str) -> Result<Option<String>> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| crate::error::Error::Internal(e.to_string()))?;
        let mut stmt = conn.prepare("SELECT value FROM settings WHERE key = ?")?;
        let mut rows = stmt.query([key])?;
        if let Some(row) = rows.next()? {
            Ok(Some(row.get(0)?))
        } else {
            Ok(None)
        }
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| crate::error::Error::Internal(e.to_string()))?;
        conn.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
            [key, value],
        )?;
        Ok(())
    }
}

impl traits::DatabaseTrait for SqliteDatabase {
    fn add_asset(
        &self,
        url: &str,
        source: &str,
        method: Option<&str>,
        recursive: bool,
    ) -> Result<i64> {
        SqliteDatabase::add_asset(self, url, source, method, recursive)
    }
    fn get_assets(&self) -> Result<Vec<Asset>> {
        SqliteDatabase::get_assets(self)
    }
    fn update_scan_result(
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
        SqliteDatabase::update_scan_result(
            self,
            id,
            status,
            status_code,
            risk_score,
            findings,
            resp_headers,
            resp_body,
            req_headers,
            req_body,
        )
    }
    fn delete_asset(&self, id: i64) -> Result<()> {
        SqliteDatabase::delete_asset(self, id)
    }
    fn get_asset_history(&self, asset_id: i64) -> Result<Vec<ScanHistoryEntry>> {
        SqliteDatabase::get_asset_history(self, asset_id)
    }
    fn get_authorized_domains(&self) -> Result<std::collections::HashSet<String>> {
        SqliteDatabase::get_authorized_domains(self)
    }
    fn update_asset_triage(&self, id: i64, triage_status: &str, notes: &str) -> Result<()> {
        SqliteDatabase::update_asset_triage(self, id, triage_status, notes)
    }
    fn update_finding_fp(
        &self,
        asset_id: i64,
        short_name: &str,
        evidence: Option<&str>,
        is_fp: bool,
        reason: Option<&str>,
    ) -> Result<()> {
        SqliteDatabase::update_finding_fp(self, asset_id, short_name, evidence, is_fp, reason)
    }
    fn recalculate_asset_risk_score(&self, asset_id: i64) -> Result<()> {
        SqliteDatabase::recalculate_asset_risk_score(self, asset_id)
    }
    fn update_asset_source(&self, id: i64, new_source: &str) -> Result<()> {
        SqliteDatabase::update_asset_source(self, id, new_source)
    }
    fn get_stale_assets(&self, limit: i32, minutes_stale: i32) -> Result<Vec<Asset>> {
        SqliteDatabase::get_stale_assets(self, limit, minutes_stale)
    }
    fn clear_all_assets(&self) -> Result<()> {
        SqliteDatabase::clear_all_assets(self)
    }
    fn purge_recursive_assets(&self) -> Result<usize> {
        SqliteDatabase::purge_recursive_assets(self)
    }
    fn sanitize_urls(&self) -> Result<usize> {
        SqliteDatabase::sanitize_urls(self)
    }
    fn update_asset_documentation(&self, id: i64, is_documented: bool) -> Result<()> {
        SqliteDatabase::update_asset_documentation(self, id, is_documented)
    }
    fn batch_mark_shadow_apis(&self, asset_ids: &[i64]) -> Result<usize> {
        SqliteDatabase::batch_mark_shadow_apis(self, asset_ids)
    }

    fn add_folder(&self, name: &str, parent_id: Option<i64>) -> Result<i64> {
        SqliteDatabase::add_folder(self, name, parent_id)
    }
    fn get_folders(&self) -> Result<Vec<Folder>> {
        SqliteDatabase::get_folders(self)
    }
    fn move_assets_to_folder(&self, asset_ids: Vec<i64>, folder_id: i64) -> Result<()> {
        SqliteDatabase::move_assets_to_folder(self, asset_ids, folder_id)
    }
    fn delete_folder(&self, id: i64) -> Result<()> {
        SqliteDatabase::delete_folder(self, id)
    }

    fn record_import_operation(&self, operation: ImportOperation) -> Result<i64> {
        SqliteDatabase::record_import_operation(self, operation)
    }
    fn update_import_operation(
        &self,
        import_id: &str,
        status: &str,
        duration_ms: Option<i64>,
        error_message: Option<&str>,
    ) -> Result<()> {
        SqliteDatabase::update_import_operation(self, import_id, status, duration_ms, error_message)
    }
    fn record_import_asset(
        &self,
        import_id: &str,
        asset_id: i64,
        url: &str,
        method: &str,
        status: &str,
        error_message: Option<&str>,
        processing_time_ms: Option<i64>,
    ) -> Result<()> {
        SqliteDatabase::record_import_asset(
            self,
            import_id,
            asset_id,
            url,
            method,
            status,
            error_message,
            processing_time_ms,
        )
    }
    fn get_import_history(&self, limit: usize, offset: usize) -> Result<Vec<ImportOperation>> {
        SqliteDatabase::get_import_history(self, limit, offset)
    }
    fn get_import_assets(&self, import_id: &str) -> Result<Vec<ImportAsset>> {
        SqliteDatabase::get_import_assets(self, import_id)
    }
    fn clear_import_history(&self) -> Result<()> {
        SqliteDatabase::clear_import_history(self)
    }
    fn get_import_operation(&self, import_id: &str) -> Result<Option<ImportOperation>> {
        SqliteDatabase::get_import_operation(self, import_id)
    }

    fn create_sequence(&self, name: &str, context_summary: Option<String>) -> Result<String> {
        SqliteDatabase::create_sequence(self, name, context_summary)
    }
    fn add_step_to_sequence(&self, step: &crate::data::SequenceStep) -> Result<()> {
        SqliteDatabase::add_step_to_sequence(self, step)
    }
    fn get_sequence(&self, id: &str) -> Result<crate::data::RequestSequence> {
        SqliteDatabase::get_sequence(self, id)
    }
    fn list_sequences(&self) -> Result<Vec<crate::data::RequestSequence>> {
        SqliteDatabase::list_sequences(self)
    }

    fn get_setting(&self, key: &str) -> Result<Option<String>> {
        SqliteDatabase::get_setting(self, key)
    }
    fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        SqliteDatabase::set_setting(self, key, value)
    }
}
