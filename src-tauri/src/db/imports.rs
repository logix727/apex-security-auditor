use crate::db::{ImportAsset, ImportOperation, ImportOptions, SqliteDatabase};
use crate::error::Result;

impl SqliteDatabase {
    pub fn record_import_operation(&self, operation: ImportOperation) -> Result<i64> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| crate::error::Error::Internal(e.to_string()))?;

        let options_json = serde_json::to_string(&operation.options)
            .map_err(crate::error::Error::Serialization)?;

        conn.execute(
            "INSERT INTO import_operations (import_id, source, total_assets, successful_assets, failed_assets, duplicate_assets, status, options) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            (
                &operation.import_id,
                &operation.source,
                operation.total_assets,
                operation.successful_assets,
                operation.failed_assets,
                operation.duplicate_assets,
                &operation.status,
                options_json
            ),
        )?;

        let id: i64 = conn.query_row(
            "SELECT id FROM import_operations WHERE import_id = ?1",
            [operation.import_id],
            |row| row.get(0),
        )?;
        Ok(id)
    }

    pub fn update_import_operation(
        &self,
        import_id: &str,
        status: &str,
        duration_ms: Option<i64>,
        error_message: Option<&str>,
    ) -> Result<()> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| crate::error::Error::Internal(e.to_string()))?;

        match (duration_ms, error_message) {
            (Some(duration), Some(error)) => {
                conn.execute(
                    "UPDATE import_operations SET status = ?1, duration_ms = ?2, error_message = ?3, updated_at = CURRENT_TIMESTAMP WHERE import_id = ?4",
                    (status, duration, error, import_id),
                )?;
            }
            (Some(duration), None) => {
                conn.execute(
                    "UPDATE import_operations SET status = ?1, duration_ms = ?2, updated_at = CURRENT_TIMESTAMP WHERE import_id = ?3",
                    (status, duration, import_id),
                )?;
            }
            (None, Some(error)) => {
                conn.execute(
                    "UPDATE import_operations SET status = ?1, error_message = ?2, updated_at = CURRENT_TIMESTAMP WHERE import_id = ?3",
                    (status, error, import_id),
                )?;
            }
            (None, None) => {
                conn.execute(
                    "UPDATE import_operations SET status = ?1, updated_at = CURRENT_TIMESTAMP WHERE import_id = ?2",
                    (status, import_id),
                )?;
            }
        }

        Ok(())
    }

    #[allow(clippy::too_many_arguments)]
    pub fn record_import_asset(
        &self,
        import_id: &str,
        asset_id: i64,
        url: &str,
        method: &str,
        status: &str,
        error_message: Option<&str>,
        processing_time_ms: Option<i64>,
    ) -> Result<()> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| crate::error::Error::Internal(e.to_string()))?;

        conn.execute(
            "INSERT INTO import_assets (import_id, asset_id, url, method, status, error_message, processing_time_ms) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            (
                import_id,
                asset_id,
                url,
                method,
                status,
                error_message.unwrap_or_default(),
                processing_time_ms.unwrap_or(0)
            ),
        )?;
        Ok(())
    }

    pub fn get_import_history(&self, limit: usize, offset: usize) -> Result<Vec<ImportOperation>> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| crate::error::Error::Internal(e.to_string()))?;

        let mut stmt = conn.prepare(
            "SELECT id, import_id, source, total_assets, successful_assets, failed_assets, duplicate_assets, status, options, duration_ms, error_message, created_at, updated_at 
             FROM import_operations 
             ORDER BY created_at DESC 
             LIMIT ?1 OFFSET ?2"
        )?;

        let import_iter = stmt.query_map((limit, offset), |row| {
            let options_json: String = row.get(8)?;
            let options: ImportOptions = serde_json::from_str(&options_json).unwrap_or_default();

            Ok(ImportOperation {
                id: row.get(0)?,
                import_id: row.get(1)?,
                source: row.get(2)?,
                total_assets: row.get(3)?,
                successful_assets: row.get(4)?,
                failed_assets: row.get(5)?,
                duplicate_assets: row.get(6)?,
                status: row.get(7)?,
                options,
                duration_ms: row.get(9)?,
                error_message: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
            })
        })?;

        let mut operations = Vec::new();
        for operation in import_iter {
            operations.push(operation?);
        }
        Ok(operations)
    }

    pub fn get_import_assets(&self, import_id: &str) -> Result<Vec<ImportAsset>> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| crate::error::Error::Internal(e.to_string()))?;

        let mut stmt = conn.prepare(
            "SELECT id, import_id, asset_id, url, method, status, error_message, processing_time_ms, created_at 
             FROM import_assets 
             WHERE import_id = ?1 
             ORDER BY created_at ASC"
        )?;

        let asset_iter = stmt.query_map([import_id], |row| {
            Ok(ImportAsset {
                id: row.get(0)?,
                import_id: row.get(1)?,
                asset_id: row.get(2)?,
                url: row.get(3)?,
                method: row.get(4)?,
                status: row.get(5)?,
                error_message: row.get(6)?,
                processing_time_ms: row.get(7).unwrap_or(0),
                created_at: row.get(8)?,
            })
        })?;

        let mut assets = Vec::new();
        for asset in asset_iter {
            assets.push(asset?);
        }
        Ok(assets)
    }

    pub fn clear_import_history(&self) -> Result<()> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| crate::error::Error::Internal(e.to_string()))?;

        conn.execute("DELETE FROM import_assets", [])?;
        conn.execute("DELETE FROM import_operations", [])?;

        Ok(())
    }

    pub fn get_import_operation(&self, import_id: &str) -> Result<Option<ImportOperation>> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| crate::error::Error::Internal(e.to_string()))?;

        let mut stmt = conn.prepare(
            "SELECT id, import_id, source, total_assets, successful_assets, failed_assets, duplicate_assets, status, options, duration_ms, error_message, created_at, updated_at 
             FROM import_operations 
             WHERE import_id = ?1"
        )?;

        let mut import_iter = stmt.query_map([import_id], |row| {
            let options_json: String = row.get(8)?;
            let options: ImportOptions = serde_json::from_str(&options_json).unwrap_or_default();

            Ok(ImportOperation {
                id: row.get(0)?,
                import_id: row.get(1)?,
                source: row.get(2)?,
                total_assets: row.get(3)?,
                successful_assets: row.get(4)?,
                failed_assets: row.get(5)?,
                duplicate_assets: row.get(6)?,
                status: row.get(7)?,
                options,
                duration_ms: row.get(9)?,
                error_message: row.get(10)?,
                created_at: row.get(11)?,
                updated_at: row.get(12)?,
            })
        })?;

        if let Some(op) = import_iter.next() {
            Ok(Some(op?))
        } else {
            Ok(None)
        }
    }
}
