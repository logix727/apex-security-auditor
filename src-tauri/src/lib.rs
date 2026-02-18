use tauri::Manager;

pub mod core;
pub mod db;
pub mod error;
pub mod ui;

pub mod commands;
pub mod services;
pub mod utils;

use crate::db::SqliteDatabase;
pub use core::data::{Badge, Severity};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

// Re-exports for convenience within the crate
pub use core::detectors::classify_vulnerability;

// ============================================
// SHARED DATA STRUCTURES & UTILS
// ============================================

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct OpenApiSpec {
    pub info: OpenApiInfo,
    pub servers: Option<Vec<OpenApiServer>>,
    pub paths: std::collections::HashMap<String, serde_json::Value>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct OpenApiServer {
    pub url: String,
    pub description: Option<String>,
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct OpenApiInfo {
    pub title: String,
    pub version: String,
}

impl OpenApiSpec {
    pub fn get_paths(&self) -> std::collections::HashMap<String, Vec<String>> {
        let mut map = std::collections::HashMap::new();
        for (path, methods) in &self.paths {
            if let Some(obj) = methods.as_object() {
                let m: Vec<String> = obj.keys().map(|k| k.to_uppercase()).collect();
                map.insert(path.clone(), m);
            }
        }
        map
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize tracing
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Starting Apex Security Auditor...");

    let db = SqliteDatabase::new("apex.db").expect("Failed to initialize database");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(db)
        .manage(services::proxy::ProxyService::new())
        .manage(utils::crypto::CryptoManager::new())
        .setup(|app| {
            let window = app
                .get_webview_window("main")
                .expect("Failed to get main window");
            let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize {
                width: 1280.0,
                height: 800.0,
            }));

            services::monitor::start_background_monitor(app.handle().clone());
            core::ai::auto_initialize_ai(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::settings::get_setting,
            commands::settings::set_setting,
            commands::assets::get_assets,
            commands::assets::get_asset_history,
            commands::export::generate_audit_report,
            commands::export::export_findings_to_csv,
            commands::export::generate_html_report,
            commands::assets::delete_asset,
            commands::scan::rescan_asset,
            commands::assets::clear_database,
            commands::folders::get_folders,
            commands::folders::add_folder,
            commands::folders::move_assets_to_folder,
            commands::folders::delete_folder,
            commands::scan::get_vulnerability_badge,
            commands::assets::sanitize_database,
            core::ai::analyze_logic_flaws,
            ui::inspector::sign_jwt,
            ui::inspector::decode_jwt,
            ui::inspector::generate_curl,
            commands::assets::update_asset_triage,
            commands::assets::update_asset_workbench_status,
            core::ai::analyze_finding,
            commands::assets::update_asset_source,
            core::ai::analyze_asset_summary,
            core::ai::get_llm_config,
            core::ai::update_llm_config,
            core::ai::check_local_model_status,
            core::ai::pull_local_model,
            commands::debug::log_debug,
            commands::shadow_api::import_openapi_spec_and_detect_shadow_apis,
            commands::shadow_api::import_missing_endpoints,
            commands::shadow_api::clear_documentation_status,
            commands::assets::add_asset,
            // Enhanced import commands
            commands::assets::get_import_status,
            commands::assets::get_import_history,
            commands::assets::reimport_assets,
            commands::assets::clear_import_history,
            commands::assets::validate_urls,
            commands::assets::import_staged_assets,
            // Sequence Commands
            commands::sequence::start_sequence,
            commands::sequence::add_to_sequence,
            commands::sequence::get_sequence,
            commands::sequence::list_sequences,
            commands::sequence::execute_sequence_step,
            commands::sequence::delete_sequence_step,
            commands::diff::compare_responses,
            core::ai::analyze_sequence,
            core::ai::generate_exploit_narrative,
            core::ai::generate_remediation_diff,
            core::ai::generate_remediation_guide,
            commands::proxy::start_proxy_service,
            commands::proxy::stop_proxy_service,
            commands::proxy::get_proxy_status,
            commands::proxy::set_proxy_intercept,
            commands::proxy::forward_intercepted_request,
            commands::proxy::drop_intercepted_request,
            commands::assets::toggle_finding_fp,
            commands::active_scan::execute_active_scan,
            commands::repeater::send_request,
            commands::discovery::discover_subdomains,
            commands::discovery::promote_discovered_assets,
            commands::discovery::fetch_wayback_urls,
            commands::discovery::scan_ports,
            commands::discovery::crawl_discovered_assets,
            commands::crypto::encrypt_api_key,
            commands::crypto::decrypt_api_key
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
