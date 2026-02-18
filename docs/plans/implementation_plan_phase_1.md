# Implementation Plan: Phase 1 - Core Hardening & Advanced Intelligence

**Version:** 1.0.0
**Targeted Gaps:** Frontend Monoliths, Performance Scaling, CI/CD, Advanced Discovery.

---

## 1. Frontend Architecture: ImportManager Decomposition

The `ImportManager.tsx` is currently ~1100 lines and handles too many concerns. We will decompose it into a modular structure under `src/components/import/`.

### 1.1 New Component Structure
- `ImportManagerContainer.tsx`: The main wrapper and state coordinator.
- `FileDropZone.tsx`: Handles drag-and-drop and file input UI.
- `StagedAssetsTable.tsx`: Displays and manages the list of assets ready for import (using `SmartTable`).
- `ImportOptionsPanel.tsx`: Configuration for import destination, recursion, and validation.
- `ImportProgressOverlay.tsx`: Displays progress and completion state.
- `ImportHistoryPanel.tsx`: Displays past import activity.

### 1.2 Custom Hooks
- `useImportProcessor.ts`: Logic for parsing CSV/JSON/YAML/OpenAPI content and staging assets.
- `useImportHistory.ts`: Abstraction for fetching and managing import history records.

---

## 2. Performance: Virtual Scrolling & IndexedDB Optimization

As the asset list grows, rendering large tables becomes a bottleneck.

### 2.1 Virtualized Asset Table
- Integrate `react-window` or `tanstack-virtual` into `AssetTable.tsx`.
- Implement dynamic row height support for expanded rows (findings).

### 2.2 Backend Rate Limiting
- Implement actual rate limiting in the Rust backend `services/discovery.rs` to prevent overwhelming target APIs during scans, even if the frontend passes a `rateLimitMs` value.

---

## 3. Intelligence: Advanced Shadow API Discovery (V2)

Moving beyond simple endpoint extraction.

### 3.1 Parameter Pattern Analysis
- Detect common parameter patterns (IDs, UUIDs, Slugs) and flag potential BOLA (Broken Object Level Authorization) entry points.
- Enhance `detectors.rs` to track parameter diversity across similar endpoints.

### 3.2 Sensitive Data Expansion
- Add more robust PII detection (e.g., Brazilian CPF, European ID numbers, etc.) using the logic established in Phase 0.

---

## 4. Quality & DevOps: CI/CD Pipeline

Establish reliability for future contributions.

### 4.1 GitHub Actions Workflow
- **Linting**: Run `eslint` and `cargo fmt`.
- **Testing**: Run `npm test` (Frontend) and `cargo test` (Backend).
- **Build Validation**: Ensure the app builds on Windows, Mac, and Linux runners.

---

## 5. Security & Compliance

### 5.1 Keychain Integration
- Move API keys from simple DB storage to OS-level keychain using the `keyring` crate for Windows/Mac/Linux.

---

## Roadmap & Milestones

| Milestone | Task | Priority |
| :--- | :--- | :--- |
| **M1: Import Split** | Migrate `ImportManager` logic to sub-components | Critical |
| **M2: Virtual Table** | Implement virtualized rendering for main Asset Table | High |
| **M3: CI/CD** | Configure GitHub Actions for automated quality gates | High |
| **M4: Shadow V2** | Implement backend parameter pattern detection | Medium |
