# Apex Security Auditor API Reference

This document outlines the Tauri commands (IPC bridge) available in the Apex Security Auditor application.

## Asset Management

### `import_assets`
Scans and imports list of URLs or text content.
- **Args**: `urls: Vec<String>`, `source: String`, `recursive: bool`

### `enhanced_import_assets`
Newer robust import logic for various file types (CSV, JSON, YAML).
- **Args**: `content: String`, `format: String`, `options: ImportOptions`

### `get_assets`
Retrieves all assets from the database.

### `delete_asset`
Removes a specific asset.
- **Args**: `id: i64`

### `update_asset_triage`
Updates the triage status and notes for an asset.
- **Args**: `id: i64`, `status: String`, `notes: String`

## Scanning & Intelligence

### `rescan_asset`
Triggers a fresh scan of a specific asset.
- **Args**: `id: i64`

### `analyze_finding`
Uses AI to provide deep dive insights for a specific finding.
- **Args**: `asset_id: i64`, `finding: Badge`

### `analyze_asset_summary`
Generates a high-level security summary for an asset.
- **Args**: `asset_id: i64`

### `get_vulnerability_badge`
Quickly classifies or classifies a vulnerability.

## Workspace & Folders

### `get_folders`
Lists all asset folders.

### `add_folder`
Creates a new folder.
- **Args**: `name: String`

### `move_assets_to_folder`
Batch move assets.
- **Args**: `asset_ids: Vec<i64>`, `folder_id: i64`

## Shadow API & Discovery

### `import_openapi_spec_and_detect_shadow_apis`
Compares active traffic with OpenAPI specs to find undocumented endpoints.

### `discover_subdomains`
Runs subdomain enumeration.
- **Args**: `domain: String`

## Settings & Debug

### `get_setting` / `set_setting`
Manage application-wide configuration.

### `log_debug`
Sends logs from frontend to backend debug sink.
