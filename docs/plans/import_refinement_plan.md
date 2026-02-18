# Implementation Plan: Import Refinement

## Phase 1: Native File Picker Integration
**Objective**: Replace/Enhance the HTML file input with Tauri's native dialog to satisfy the "Downloads folder" and "CSV/Excel filter" requirement.

- [ ] **Modify `FileDropZone.tsx`**:
    - [ ] Import `open` from `@tauri-apps/plugin-dialog`.
    - [ ] Import `BaseDirectory` from `@tauri-apps/plugin-fs`.
    - [ ] Replace the hidden `<input type="file">` click handler with a handler calling `dialog.open`.
    - [ ] Configure `dialog.open` with:
        - `defaultPath`: `BaseDirectory.Download`
        - `filters`: `['csv', 'xlsx', 'xls', 'json', 'txt']`
        - `multiple`: `true`
    - [ ] Handle the returned paths:
        - The new native dialog returns *paths*, not *File objects*.
        - We need to read these files using `readTextFile` (or `readFile` for binary) from `@tauri-apps/plugin-fs`.
        - **Impact**: `useImportProcessor.ts` currently expects `File[]`. We need to adapt it to accept `string[]` (file paths) or read the content immediately in the component and pass objects `{ name: string, content: string }`.

## Phase 2: UI Layout Compression
**Objective**: Fit everything on one screen.

- [ ] **Redesign `ImportManager.tsx`**:
    - [ ] Remove the fixed `width: '960px'`/`height: '80vh'` if it's too large, or optimize the internal use of space.
    - [ ] Change from "Left/Right" split to "Top/Bottom" or "Compact Grid".
    - [ ] **Top Row**: Input Controls.
        - Left: "Upload Files" button (Large, clear).
        - Right: "Paste Text" area (Small, auto-expanding or fixed height).
    - [ ] **Bottom Row**: Staged Assets Table.
        - Maximize height for the table.
    - [ ] Remove `ImportSettings` and `ImportHistoryPanel` from the main view (maybe move to a "Settings" tab or collapsible section within the modal to save space).

## Phase 3: Logic Adaptation (`useImportProcessor`)
**Objective**: Handle file paths from Tauri dialog.

- [ ] **Update `processFiles`**:
    - [ ] Add support for processing file paths (reading content via Tauri FS).
    - [ ] Maintain support for Drag & Drop (`File` objects) if we still want that (Hybrid approach is best).

## Phase 4: Verification
- [ ] Run Manual Test: Click Upload -> Verify Downloads folder opens -> Verify Filters.
- [ ] Run Manual Test: Paste Text -> Verify Staging.
- [ ] Run E2E Tests.
