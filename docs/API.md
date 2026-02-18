# Apex Security Auditor API Reference

This document outlines the Tauri commands (IPC bridge) available in the Apex Security Auditor application.

## Asset Management

### `import_assets`
Scans and imports list of URLs or text content.
- **Args**: `urls: Vec<String>`, `source: String`, `recursive: bool`
- **Returns**: `Vec<i64>` - List of imported asset IDs

### `enhanced_import_assets`
Newer robust import logic for various file types (CSV, JSON, YAML).
- **Args**: `content: String`, `format: String`, `options: ImportOptions`
- **Returns**: `ImportResult`
  - `import_id: String`
  - `successful: u32`
  - `failed: u32`
  - `duplicates: u32`
  - `total: u32`
  - `duration: u64`
  - `errors: Vec<ImportError>`
  - `asset_ids: Vec<i64>`

### `get_assets`
Retrieves all assets from the database.
- **Returns**: `Vec<Asset>`

### `get_asset_by_id`
Retrieves a single asset by ID.
- **Args**: `id: i64`
- **Returns**: `Option<Asset>`

### `delete_asset`
Removes a specific asset.
- **Args**: `id: i64`

### `update_asset_triage`
Updates the triage status and notes for an asset.
- **Args**: `id: i64`, `status: String`, `notes: String`

### `move_assets_to_folder`
Batch move assets to a folder.
- **Args**: `asset_ids: Vec<i64>`, `folder_id: i64`

## Folder Management

### `get_folders`
Lists all asset folders.
- **Returns**: `Vec<Folder>`

### `add_folder`
Creates a new folder.
- **Args**: `name: String`, `parent_id: Option<i64>`
- **Returns**: `Folder`

### `delete_folder`
Removes a folder.
- **Args**: `id: i64`

### `rename_folder`
Renames a folder.
- **Args**: `id: i64`, `name: String`

## Scanning & Intelligence

### `rescan_asset`
Triggers a fresh scan of a specific asset.
- **Args**: `id: i64`

### `rescan_assets`
Triggers scans for multiple assets.
- **Args**: `ids: Vec<i64>`

### `analyze_finding`
Uses AI to provide deep dive insights for a specific finding.
- **Args**: `asset_id: i64`, `finding: Badge`
- **Returns**: `String` - AI analysis result

### `analyze_asset_summary`
Generates a high-level security summary for an asset.
- **Args**: `asset_id: i64`
- **Returns**: `Vec<Badge>` - List of findings

### `get_vulnerability_badge`
Quickly classifies or classifies a vulnerability.
- **Args**: `code: u16`, `body: String`, `headers: String`
- **Returns**: `Option<Badge>`

## Shadow API & Discovery

### `import_openapi_spec_and_detect_shadow_apis`
Compares active traffic with OpenAPI specs to find undocumented endpoints.
- **Args**: `spec_content: String`, `format: String`
- **Returns**: `ShadowApiReport`

### `discover_subdomains`
Runs subdomain enumeration.
- **Args**: `domain: String`
- **Returns**: `Vec<String>` - List of discovered subdomains

## Settings & Debug

### `get_setting`
Retrieves a setting value.
- **Args**: `key: String`
- **Returns**: `Option<String>`

### `set_setting`
Sets a setting value.
- **Args**: `key: String`, `value: String`

### `log_debug`
Sends logs from frontend to backend debug sink.
- **Args**: `level: String`, `source: String`, `message: String`

## Data Types

### Asset
```rust
struct Asset {
    id: i64,
    url: String,
    method: String,
    status: String,
    status_code: i32,
    risk_score: i32,
    findings: Vec<Badge>,
    folder_id: i64,
    response_headers: String,
    response_body: String,
    request_headers: String,
    request_body: String,
    created_at: String,
    updated_at: String,
    notes: String,
    triage_status: String,
    is_documented: bool,
    source: String,
    recursive: bool,
    is_workbench: bool,
    depth: i32,
}
```

### Badge
```rust
struct Badge {
    emoji: String,
    short: String,
    severity: String,
    description: String,
    owasp_category: Option<String>,
    evidence: Option<String>,
    start: Option<i32>,
    end: Option<i32>,
    is_fp: Option<bool>,
    fp_reason: Option<String>,
    cvss_score: Option<f32>,
    cvss_vector: Option<String>,
    secret_type: Option<String>,
    request_header_name: Option<String>,
    parameter: Option<String>,
    key: Option<String>,
}
```

### ImportOptions
```rust
struct ImportOptions {
    destination: String,       // "asset_manager" or "workbench"
    recursive: bool,
    batch_mode: bool,
    batch_size: u32,
    rate_limit: u32,
    skip_duplicates: bool,
    validate_urls: bool,
    auto_triage: bool,
}
```

## Frontend Hooks

The frontend provides several React hooks for easier API interaction:

### `useAssetApi`
- `fetchAssets(forceRefresh?)` - Fetch all assets with caching
- `fetchFolders(forceRefresh?)` - Fetch all folders
- `importAssets(content, format, options)` - Import assets
- `deleteAsset(id)` - Delete an asset
- `updateAssetTriage(id, status, notes)` - Update triage status
- `addFolder(name, parentId?)` - Create a new folder
- `moveAssetsToFolder(assetIds, folderId)` - Move assets to folder
- `rescanAsset(id)` - Rescan an asset
- `analyzeAsset(id)` - Analyze asset with AI
- `refreshAll()` - Clear cache and refresh all data

### `useBulkAssetOperations`
- `selectedIds` - Set of selected asset IDs
- `hasSelection` - Whether any assets are selected
- `selectionCount` - Number of selected assets
- `selectAll(ids)` - Select multiple assets
- `toggleSelection(id)` - Toggle single asset selection
- `clearSelection()` - Clear all selections
- `bulkDelete(ids)` - Delete multiple assets
- `bulkMoveToFolder(ids, folderId)` - Move multiple assets

### `useImportProcessor`
- `stagedAssets` - Currently staged assets for import
- `isProcessing` - Whether import is in progress
- `errorMsg` - Current error message
- `processFiles(files)` - Process files for import
- `parseContent(content, type, filename)` - Parse content
