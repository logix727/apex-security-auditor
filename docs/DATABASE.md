# Apex Security Auditor Database Schema

Apex uses SQLite for local data persistence. The database is typically named `apex.db`.

## Tables

### `assets`
The core table storing discovered and imported API endpoints.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary Key |
| `url` | TEXT | Unique URL of the endpoint |
| `method` | TEXT | HTTP Method (GET, POST, etc.) |
| `status` | TEXT | Scan status (Pending, Scanned) |
| `status_code` | INTEGER | Last observed HTTP response code |
| `risk_score` | INTEGER | Calculated security risk Score (0-100) |
| `findings` | TEXT | JSON array of detected vulnerabilities |
| `folder_id` | INTEGER | Reference to `folders.id` |
| `request_body` | TEXT | Last captured request body |
| `response_body`| TEXT | Last captured response body |
| `triage_status`| TEXT | User decision (Unreviewed, Safe, Issue) |
| `source` | TEXT | Discovery source (User, Import, Proxy) |

### `folders`
Organization structure for assets.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary Key |
| `name` | TEXT | Unique folder name |
| `parent_id` | INTEGER | Reference to parent folder for nested structures |

### `scan_history`
Historical snapshots of asset scans for diffing.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary Key |
| `asset_id` | INTEGER | FK to `assets.id` |
| `timestamp` | DATETIME | Snapshot time |
| `findings` | TEXT | Findings at that point in time |

### `import_operations`
Tracking for batch import tasks.

| Column | Type | Description |
|--------|------|-------------|
| `import_id` | TEXT | UUID for the operation |
| `status` | TEXT | queued, processing, completed, failed |
| `total_assets` | INTEGER| Count of assets in batch |

## Relationships

- `assets.folder_id` -> `folders.id`
- `scan_history.asset_id` -> `assets.id`
- `import_assets.import_id` -> `import_operations.import_id`
