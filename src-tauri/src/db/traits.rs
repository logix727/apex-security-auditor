use crate::db::{Asset, Folder, ImportAsset, ImportOperation, ScanHistoryEntry};
use crate::error::Result;
use std::collections::HashSet;

pub trait DatabaseTrait: Send + Sync {
    // Assets
    fn add_asset(
        &self,
        url: &str,
        source: &str,
        method: Option<&str>,
        recursive: bool,
        is_workbench: bool,
        depth: i32,
    ) -> Result<i64>;
    fn get_assets(&self) -> Result<Vec<Asset>>;
    #[allow(clippy::too_many_arguments)]
    fn update_scan_result(
        &self,
        id: i64,
        status: &str,
        status_code: i32,
        risk_score: i32,
        findings: Vec<crate::db::Badge>,
        resp_headers: &str,
        resp_body: &str,
        req_headers: &str,
        req_body: &str,
    ) -> Result<()>;
    fn delete_asset(&self, id: i64) -> Result<()>;
    fn get_asset_history(&self, asset_id: i64) -> Result<Vec<ScanHistoryEntry>>;
    fn get_authorized_domains(&self) -> Result<HashSet<String>>;
    fn add_authorized_domain(&self, domain: &str) -> Result<()>;
    fn update_asset_triage(&self, id: i64, triage_status: &str, notes: &str) -> Result<()>;
    fn update_finding_fp(
        &self,
        asset_id: i64,
        short_name: &str,
        evidence: Option<&str>,
        is_fp: bool,
        reason: Option<&str>,
    ) -> Result<()>;
    fn recalculate_asset_risk_score(&self, asset_id: i64) -> Result<()>;
    fn update_asset_source(&self, id: i64, new_source: &str) -> Result<()>;
    fn get_stale_assets(&self, limit: i32, minutes_stale: i32) -> Result<Vec<Asset>>;
    fn clear_all_assets(&self) -> Result<()>;
    fn purge_recursive_assets(&self) -> Result<usize>;
    fn sanitize_urls(&self) -> Result<usize>;
    fn update_asset_documentation(&self, id: i64, is_documented: bool) -> Result<()>;
    fn update_asset_workbench_status(&self, id: i64, is_workbench: bool) -> Result<()>;
    fn batch_mark_shadow_apis(&self, asset_ids: &[i64]) -> Result<usize>;

    // Folders
    fn add_folder(&self, name: &str, parent_id: Option<i64>) -> Result<i64>;
    fn get_folders(&self) -> Result<Vec<Folder>>;
    fn move_assets_to_folder(&self, asset_ids: Vec<i64>, folder_id: i64) -> Result<()>;
    fn delete_folder(&self, id: i64) -> Result<()>;

    // Imports
    fn record_import_operation(&self, operation: ImportOperation) -> Result<i64>;
    fn update_import_operation(
        &self,
        import_id: &str,
        status: &str,
        duration_ms: Option<i64>,
        error_message: Option<&str>,
    ) -> Result<()>;
    #[allow(clippy::too_many_arguments)]
    fn record_import_asset(
        &self,
        import_id: &str,
        asset_id: i64,
        url: &str,
        method: &str,
        status: &str,
        error_message: Option<&str>,
        processing_time_ms: Option<i64>,
    ) -> Result<()>;
    fn get_import_history(&self, limit: usize, offset: usize) -> Result<Vec<ImportOperation>>;
    fn get_import_assets(&self, import_id: &str) -> Result<Vec<ImportAsset>>;
    fn clear_import_history(&self) -> Result<()>;
    fn get_import_operation(&self, import_id: &str) -> Result<Option<ImportOperation>>;

    // Sequences
    fn create_sequence(&self, name: &str, context_summary: Option<String>) -> Result<String>;
    fn add_step_to_sequence(&self, step: &crate::core::data::SequenceStep) -> Result<()>;
    fn get_sequence(&self, id: &str) -> Result<crate::core::data::RequestSequence>;
    fn list_sequences(&self) -> Result<Vec<crate::core::data::RequestSequence>>;

    // Settings
    fn get_setting(&self, key: &str) -> Result<Option<String>>;
    fn set_setting(&self, key: &str, value: &str) -> Result<()>;
}
