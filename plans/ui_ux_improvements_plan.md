# UX/UI Improvement & Bug Fix Plan

## Objective
Address user feedback regarding table usability, visual clutter in detections, button state bugs, and inspector functionality.

## 1. SmartTable Improvements
**Goal**: Enhanced text fitting and user-controlled resizing.
- [ ] **Column Resizing**: Verify and refine existing column resize logic in `SmartTable`. Ensure it is smooth and persists if needed.
- [ ] **Row Resizing**: Add support for user-resizable row heights (or a "Density" toggle: Compact/Normal/Comfortable) to allow text to fit better.
- [ ] **Auto-Fit Text**: Implement "Double-click to resize" on column headers to fit content, or ensure default widths are intelligent.

## 2. Detection Badges Cleanup
**Goal**: Reduce visual noise by grouping identical findings.
- [ ] **Refactor `getDetectionBadges`**:
  - Group findings by type/severity.
  - Render a single icon per type.
  - Add a counter badge (e.g., `x3`) if multiple findings of the same type exist.
  - Tooltip should list all individual findings of that type.

## 3. "Send to Asset Manager" Button Bug
**Goal**: Fix incorrect count display.
- [ ] **Investigate State**: The button shows a count (e.g., "4") when it should likely be 0 or hidden.
- [ ] **Fix**: Ensure `selectedIds` are cleared or scoped correctly when switching views (e.g., from Assets to Workbench), or ensure the button references the correct selection set for the active context.

## 4. Inspector: Finding Navigation & Highlighting
**Goal**: "Click finding -> Jump to code".
- [ ] **Deep Linking**:
  - When a finding is clicked, determine its location (line number or offset) in the response body.
  - If distinct line numbers aren't available, implement smart text search/matching for the finding evidence.
- [ ] **Scrolling**: Implement programmatic scrolling to the highlighted element within the `Inspector` body view.
- [ ] **Highlighting**: Ensure the matched text is visually distinct (background color/border).

## 5. Inspector: Pretty Print Response Body
**Goal**: Format raw text/JSON for readability.
- [ ] **JSON**: Ensure `JSONTree` or formatted JSON string is default for `application/json`.
- [ ] **HTML/XML/Text**: Add a "Prettify" or "Format" toggle that uses a formatter (e.g., standard indentation) to making minified/raw bodies readable.
- [ ] **Refinement**: Improve current `JSONTree` styling if it "looks bad" (e.g., font size, colors).

## Execution Order
1. **Detections (Easy/High Value)**: Fix the badge grouping.
2. **Button Bug (Bug Fix)**: Fix the selection count display.
3. **Inspector Features**: Implement "Pretty Print" and "Jump to Finding".
4. **Table Resize**: Implement row resizing/advanced column fitting.
