use crate::db::SqliteDatabase;
use crate::error::Result;

impl SqliteDatabase {
    pub fn create_sequence(&self, name: &str, context_summary: Option<String>) -> Result<String> {
        let conn = self.conn.lock().map_err(|e| crate::error::Error::Internal(e.to_string()))?;

        let id = uuid::Uuid::new_v4().to_string();
        
        conn.execute(
            "INSERT INTO sequences (id, name, context_summary) VALUES (?1, ?2, ?3)",
            (&id, name, context_summary),
        )?;

        Ok(id)
    }

    pub fn add_step_to_sequence(&self, step: &crate::core::data::SequenceStep) -> Result<()> {
        let conn = self.conn.lock().map_err(|e| crate::error::Error::Internal(e.to_string()))?;

        conn.execute(
            "INSERT INTO sequence_steps (sequence_id, asset_id, method, url, status_code, request_body, response_body, request_headers, response_headers, captures)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            (
                &step.sequence_id, 
                &step.asset_id, 
                &step.method, 
                &step.url, 
                &step.status_code, 
                &step.request_body, 
                &step.response_body,
                &step.request_headers,
                &step.response_headers,
                serde_json::to_string(&step.captures).unwrap_or_else(|_| "[]".to_string())
            ),
        )?;

        Ok(())
    }

    pub fn get_sequence(&self, id: &str) -> Result<crate::core::data::RequestSequence> {
        let conn = self.conn.lock().map_err(|e| crate::error::Error::Internal(e.to_string()))?;

        let entry: (String, Option<String>, String, Option<String>) = conn.query_row(
            "SELECT id, name, created_at, context_summary FROM sequences WHERE id = ?1",
            [id],
            |row| Ok((
                row.get(0)?,
                row.get(1)?,
                row.get(2)?,
                row.get(3)?,
            )),
        )?;

        let (seq_id, name, created_at, context_summary) = entry;

        let mut steps_stmt = conn.prepare(
            "SELECT id, sequence_id, asset_id, method, url, status_code, request_body, response_body, request_headers, response_headers, timestamp, captures 
             FROM sequence_steps 
             WHERE sequence_id = ?1 
             ORDER BY timestamp ASC"
        )?;

        let step_iter = steps_stmt.query_map([id], |row| {
            Ok(crate::core::data::SequenceStep {
                id: row.get(0)?,
                sequence_id: row.get(1)?,
                asset_id: row.get(2)?,
                method: row.get(3)?,
                url: row.get(4)?,
                status_code: row.get(5)?,
                request_body: row.get(6)?,
                response_body: row.get(7)?,
                request_headers: row.get(8)?,
                response_headers: row.get(9)?,
                timestamp: row.get(10)?,
                captures: serde_json::from_str(&row.get::<_, String>(11).unwrap_or_else(|_| "[]".to_string())).unwrap_or_default(),
            })
        })?;

        let mut steps = Vec::new();
        for s in step_iter {
            steps.push(s?);
        }

        Ok(crate::core::data::RequestSequence {
            id: seq_id,
            flow_name: name,
            steps,
            created_at,
            context_summary,
        })
    }

    pub fn list_sequences(&self) -> Result<Vec<crate::core::data::RequestSequence>> {
        let conn = self.conn.lock().map_err(|e| crate::error::Error::Internal(e.to_string()))?;

        let mut stmt = conn.prepare("SELECT id, name, created_at, context_summary FROM sequences ORDER BY created_at DESC")?;
        let seq_iter = stmt.query_map([], |row| {
             Ok(crate::core::data::RequestSequence {
                id: row.get(0)?,
                flow_name: row.get(1)?,
                steps: vec![],
                created_at: row.get(2)?,
                context_summary: row.get(3)?,
            })
        })?;

        let mut sequences = Vec::new();
        for s in seq_iter {
            sequences.push(s?);
        }
        Ok(sequences)
    }
    pub fn delete_step_from_sequence(&self, step_id: i64) -> Result<()> {
        let conn = self.conn.lock().map_err(|e| crate::error::Error::Internal(e.to_string()))?;
        conn.execute("DELETE FROM sequence_steps WHERE id = ?1", [step_id])?;
        Ok(())
    }
}
