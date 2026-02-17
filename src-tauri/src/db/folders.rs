use crate::db::{Folder, SqliteDatabase};
use crate::error::Result;

impl SqliteDatabase {
    pub fn add_folder(&self, name: &str, parent_id: Option<i64>) -> Result<i64> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| crate::error::Error::Internal(e.to_string()))?;
        conn.execute(
            "INSERT INTO folders (name, parent_id) VALUES (?1, ?2)",
            (name, parent_id),
        )?;
        Ok(conn.last_insert_rowid())
    }

    pub fn get_folders(&self) -> Result<Vec<Folder>> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| crate::error::Error::Internal(e.to_string()))?;
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
        let conn = self
            .conn
            .lock()
            .map_err(|e| crate::error::Error::Internal(e.to_string()))?;
        for id in asset_ids {
            conn.execute(
                "UPDATE assets SET folder_id = ?1 WHERE id = ?2",
                (folder_id, id),
            )?;
        }
        Ok(())
    }

    pub fn delete_folder(&self, id: i64) -> Result<()> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| crate::error::Error::Internal(e.to_string()))?;
        // Move assets to default folder (1) before deleting
        conn.execute("UPDATE assets SET folder_id = 1 WHERE folder_id = ?1", [id])?;
        conn.execute("DELETE FROM folders WHERE id = ?1 AND id != 1", [id])?;
        Ok(())
    }
}
