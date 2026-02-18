# Task: Decompose ImportManager Component

## Objective
Split the monolithic `ImportManager.tsx` (~1100 lines) into smaller, testable sub-components and custom hooks to improve maintainability and performance.

## Sub-tasks
1. [ ] **Setup Directory Structure**:
   - Create `src/components/import/`
2. [ ] **Extract Custom Hooks**:
   - `useImportProcessor.ts`: Extract parsing logic (JSON, CSV, YAML, OpenAPI).
   - `useImportHistory.ts`: Extract backend history fetching logic.
3. [ ] **Extract Sub-components**:
   - `FileDropZone.tsx`: The drag-and-drop region.
   - `StagedAssetsTable.tsx`: The table showing items before they are imported.
   - `ImportHistoryList.tsx`: The list of previous imports.
   - `ImportSettings.tsx`: The options and destination selection.
4. [ ] **Reassemble ImportManager**:
   - Refactor `ImportManager.tsx` to use these new components and hooks.
5. [ ] **Verify Functionality**:
   - Test CSV import.
   - Test OpenAPI/Swagger import.
   - Test History clearing.

## Success Criteria
- `ImportManager.tsx` reduced to <300 lines of glue code.
- Functional parity maintained for all import types.
- No regression in URL validation or duplication checking.
