# Apex Security Auditor - User Guide

## Overview

Apex Security Auditor is a specialized security auditing tool designed for auditing APIs with a focus on ease of use, modern aesthetics, and powerful analysis capabilities. It helps security professionals identify vulnerabilities such as BOLA, broken authentication, and sensitive data exposure.

## Key Features

- **Automated Scanning**: Quickly scan APIs for common vulnerabilities using integrated rulesets.
- **Visual Workbench**: Easily visualize API traffic, inspect requests/responses, and identify anomalies.
- **Deep Inspection**: View detailed request/response data, including JSON tree view and formatted headers.
- **Response Diffing**: Compare responses against historical scans to detect subtle changes.
- **Sequence Editor**: Create and edit complex attack sequences with variable capture and replay.
- **Data Export**: Export findings to CSV, JSON, XLSX, or generate comprehensive HTML/Markdown reports.
- **AI-Powered Analysis**: Leverage AI to analyze findings and suggest remediation steps (requires API key).

## Getting Started

### Installation

1. Download the latest release from the [Releases](https://github.com/logix727/apex-security-auditor/releases) page.
2. Install the application on your system (Windows, macOS, or Linux).

### Initial Setup

1. Launch the application.
2. Configure settings (e.g., AI provider, proxy settings) via the Settings view.

## Asset Manager

### Viewing Assets

The Asset Manager provides a comprehensive view of all imported API endpoints. Navigate to the Assets view to see your imported assets in a sortable, filterable table.

- **Table Columns**: URL, Method, Status, Risk Score, Source, Triage Status
- **Sorting**: Click column headers to sort ascending/descending
- **Selection**: Click rows to select, use Ctrl+Click for multi-select, Shift+Click for range select

### Filtering Assets

Use the filter bar to narrow down assets:

- **Method Filter**: Filter by HTTP method (GET, POST, PUT, DELETE, etc.)
- **Status Filter**: Filter by response status (2xx, 3xx, 4xx, 5xx)
- **Source Filter**: Filter by import source
- **Smart Filter**: Quick filters for Critical, PII, Secrets, or Shadow API findings

### Managing Folders

Organize your assets into folders:

1. Click "Add Folder" in the sidebar
2. Enter a folder name
3. Drag and drop assets into folders, or use "Move to Folder" from the context menu

## Importing Data

### Import Methods

Apex supports multiple import methods:

#### Text Input
Paste URLs directly into the import dialog:
```
https://example.com/api/users
https://example.com/api/products
http://api.test.com/v1
```

#### HTTP Methods with URLs
Include HTTP methods for more detailed imports:
```
GET https://example.com/api/users
POST https://example.com/api/users
DELETE https://example.com/api/users/1
```

#### CSV Import
Import from CSV files with flexible column detection:
```csv
url,method
https://example.com/api/users,GET
https://example.com/api/users,POST
```

Supported CSV headers: `url`, `path`, `endpoint`, `method`, `verb`

#### JSON Import
Import as a simple array of URLs:
```json
[
  "https://example.com/api/users",
  "https://example.com/api/products"
]
```

Or as an array of objects:
```json
[
  { "url": "https://example.com/api/users", "method": "GET" },
  { "url": "https://example.com/api/users", "method": "POST" }
]
```

#### OpenAPI/Swagger Import
Import directly from OpenAPI 3.x or Swagger 2.x specifications. The system automatically extracts all endpoints and their methods.

#### Excel Import
Import from `.xlsx` or `.xls` files. The first sheet is converted to CSV format for processing.

### Import Options

Configure import behavior:

- **Destination**: Asset Manager or Workbench
- **Recursive**: Enable recursive crawling
- **Batch Mode**: Process in batches
- **Batch Size**: Number of concurrent requests
- **Rate Limit**: Requests per second
- **Skip Duplicates**: Ignore already-imported URLs
- **Validate URLs**: Validate URLs before import
- **Auto-Triage**: Automatically assign triage status

### Import Process

1. Click "Import Assets" in the toolbar
2. Paste URLs or drag-and-drop files
3. Click "Process" to stage assets
4. Review staged assets in the preview table
5. Select/deselect assets to import
6. Click "Confirm Import" to complete

## Exporting Data

### Export Formats

Apex supports multiple export formats:

- **CSV**: Universal spreadsheet format
- **JSON**: Structured data format
- **XLSX**: Excel spreadsheet with formatting
- **TXT**: Plain text list of URLs

### Export Scope

Choose what to export:

- **All Assets**: Export all imported assets
- **Selected Assets**: Export only selected assets
- **Filtered Assets**: Export currently filtered view
- **Findings Only**: Export only assets with security findings

### Export Options

Customize export content:

- Include/exclude findings
- Include/exclude notes
- Custom filename

### Quick Export

Use the clipboard for quick exports:

- Copy URLs to clipboard (one per line)
- Copy as JSON array

## Using the Workbench

### Viewing API Traffic

- The Workbench displays captured API traffic in a tabular view.
- Use filters to narrow down traffic by method, status code, or URL pattern.
- Click on any row to open the Inspector panel.

### Inspecting Requests

- The Inspector panel shows detailed information about the selected request.
- Use tabs (Summary, Exchange, Security, Details, Diff) to explore different aspects.
- **Summary**: Quick overview of findings and risk score.
- **Exchange**: Full request/response bodies and headers.
- **Security**: Authentication analysis and token details.
- **Diff**: Compare against historical baselines.

## Advanced Features

### Sequence Editor

- Navigate to the Sequence Editor view.
- Create new sequences to chain requests.
- Define variables to capture tokens or data from responses and use them in subsequent steps.

### Diff Analysis

- In the Inspector, switch to the "Diff" tab.
- Select a historical scan from the dropdown to compare against the current response.
- Differences are highlighted to reveal changes in structure or data.

### Shadow API Detection

- Import an OpenAPI specification
- The system compares it against captured traffic
- Undocumented endpoints are flagged as shadow APIs

### Triage Management

- Mark assets as Safe, Suspect, or Ignored
- Add notes to document findings
- Filter by triage status to focus on priority items

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+A | Select all assets |
| Ctrl+C | Copy selected URLs |
| Ctrl+F | Focus search |
| Delete | Delete selected |
| Enter | Open inspector |
| Escape | Close modal/deselect |

## Troubleshooting

### Proxy Issues
- Ensure proxy settings match your browser/system configuration
- Check proxy compatibility in Settings

### AI Errors
- Verify API key and connectivity to the AI provider
- Check rate limits and quotas

### Scan Errors
- Check logs in the Debug Console for detailed error messages
- Verify URL accessibility

### Import Issues
- Ensure URLs are properly formatted
- Check file encoding for CSV/JSON imports
- Verify OpenAPI specs are valid

## Support

For issues or feature requests, please visit our [GitHub Issues](https://github.com/logix727/apex-security-auditor/issues) page.
