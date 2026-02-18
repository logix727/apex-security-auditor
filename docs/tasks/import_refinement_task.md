---
title: Import UI/UX Refinement & Functional Fixes
description: Refine the Import Manager UI to fit on a single screen and implement specific file open behaviors for CSV/Excel files in the Downloads folder.
status: proposed
---

# Import UI/UX Refinement & Functional Fixes

## Context
The user has reported that the current import functionality is problematic ("don't work") and requested specific UI/UX improvements.

## Requirements
1.  **Single Screen Layout**: The Import UI must allow "ghost paste text" (text input) and file upload without needing to scroll or navigate complex menus. It should "fit all in one screen".
2.  **Specific File Upload Behavior**:
    *   Single button for file upload.
    *   Must default to opening the **Downloads** folder.
    *   Must filter to show only **CSV** and **Excel** files (and likely text/JSON as fallback, but emphasize spreadsheets).
3.  **Reliability**: Ensure the import process actually works (fixing the "functions dotn work" comment).

## Implementation Plan

### 1. UI Redesign (`ImportManager.tsx`, `FileDropZone.tsx`)
*   **Compact Layout**: Refactor the split-pane design into a more cohesive "Single View".
    *   Top Section: "Input Area" (Drop zone + Paste Text combined or side-by-side compact).
    *   Bottom Section: "Staged Assets" (Compact table).
*   **Ghost Text Input**: Ensure the text paste area is intuitive (placeholder "Paste content here...").

### 2. Native File Dialog Implementation
*   Instead of relying solely on `<input type="file">`, use Tauri's `@tauri-apps/plugin-dialog` to launch a native file picker.
*   **Configuration**:
    *   `defaultPath`: Set to `BaseDirectory.Download`.
    *   `filters`: Set to `[{ name: 'Import Files', extensions: ['csv', 'xlsx', 'xls', 'json', 'txt'] }]`.
    *   `multiple`: `true`.

### 3. Functional Fixes
*   Review `useImportProcessor` logic to ensure parsed files are correctly converted to staged assets.
*   Verify the "Import" button action (`handleImportConfirm`) correctly sends data to the backend.

### 4. Testing
*   Update E2E tests (`tests/e2e/import.spec.ts`) to verify the new UI elements.
*   Note: We cannot fully E2E test the native Tauri dialog opening the Downloads folder easily in Playwright without mocking, but we can verify the trigger works.
