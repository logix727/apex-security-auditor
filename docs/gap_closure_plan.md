# Gap Closure Implementation Plan

This plan details the specific technical steps to address the remaining gaps identified in `gap_analysis.md` (Version 0.3.0), specifically focusing on **Release Automation (Phase 5)**, **Testing Excellence (Phase 6)**, and **Documentation (Phase 7)**.

---

## 🏗️ Phase 5: Release Automation (Status: 0%)

**Goal:** Enable one-click or automated releases with attached binaries for Windows and macOS.

### 1. Configure GitHub Actions for Release
**File:** `.github/workflows/release.yml`
- [ ] Create a new workflow triggered on `push` to tags (`v*`).
- [ ] Use `tauri-apps/tauri-action@v0`.
- [ ] **Matrix Strategy**:
    - `platform: windows-latest` (builds `.msi`, `.exe`)
    - `platform: ubuntu-latest` (builds `.AppImage`, `.deb`)
    - `platform: macos-latest` (builds `.app`, `.dmg`)
- [ ] **Signing**:
    - Windows: Generate a self-signed certificate for now (or use proper codesign if cert available).
    - macOS: Skip signing/notarization for now (requires Apple Developer ID), or configure ad-hoc signing.

### 2. Automated Versioning
**Strategy:** Use `changesets` or `release-plz`.
- [ ] Initialize `release-plz` (Rust-focused) or standard `npm version` scripts.
- [ ] Add a `release:bump` script to `package.json` that updates version in `tauri.conf.json` and `Cargo.toml`.

---

## 🧪 Phase 6: Testing Excellence (Status: 10%)

**Goal:** Increase confidence in core logic and UI flows.

### 1. Frontend Unit Tests (Vitest)
**Target:** `src/components/sequence/SequenceEditor.tsx` & Logic
- [ ] **Variable Extraction**: Test regex parsing for `{{var}}` syntax.
- [ ] **State Management**: Test adding/removing steps in the sequence.
- [ ] **Mocking**: Mock Tauri invoke calls to ensure the UI handles backend success/failure correctly.

**Target:** `src/components/Inspector.tsx`
- [ ] **Diff View**: Ensure the diff component renders correct additions/deletions.
- [ ] **Large Bodies**: Test rendering performance with 1MB+ response bodies (mocked).

### 2. End-to-End (E2E) Testing (Playwright)
**Setup:**
- [ ] Install Playwright: `npm init playwright@latest`.
- [ ] Configure `playwright.config.ts` for a local web server (using `vite preview`).
- [ ] **Note**: Testing the full Tauri app context in E2E is hard; we will test the *web frontend* logic primarily.

**Critical Flows to Test:**
- [ ] **Import**: Upload a mock OpenAPI JSON -> Verify assets appear in list.
- [ ] **Navigation**: Switch between Dashboard, Assets, and Workbench views.
- [ ] **Data Entry**: Type in the Sequence Editor inputs -> Verify state updates.

### 3. Backend Integration Tests (Rust)
**Target:** `src-tauri/src/export.rs`
- [ ] **Export Logic**: Create a test that inserts mock assets into the in-memory DB and calls `export_findings_to_csv`, verifying the string output contains expected CSV headers and data.

---

## 📚 Phase 7: Documentation (Status: 20%)

**Goal:** Make the tool usable by others without direct guidance.

### 1. User Guide (`docs/USER_GUIDE.md`)
Create a comprehensive guide including:
- [ ] **Installation**: How to run the binaries.
- [ ] **Workflow**: Import -> Scan -> Analyze -> Export.
- [ ] **Features**:
    - **Proxy**: How to configure browser/Postman to send traffic to Apex.
    - **Sequence Editor**: Syntax guide for variables (`{{capture}}`).
    - **Triage**: Explanation of Risk Scores and finding badges.

### 2. Developer Guide (`docs/CONTRIBUTING.md`)
- [ ] **Architecture Overview**: Diagram of Tauri (Rust) <-> Webview (React) IPC.
- [ ] **Adding Detectors**: Step-by-step on adding a new `Detector` struct in Rust.
- [ ] **Build Instructions**: Prerequisites (Rust, Node, VS Build Tools).

---

## 📅 Execution Order

1.  **Immediate**: Create `release.yml` to ensure we can build artifacts. (High Value, Low Effort)
2.  **Next**: Write `USER_GUIDE.md` so the current feature set is documented.
3.  **Then**: Backend Export tests (since we just touched that code).
4.  **Finally**: Frontend Unit Tests & E2E (harder setup, longer effort).
