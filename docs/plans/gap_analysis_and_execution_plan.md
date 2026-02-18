# Gap Analysis & Execution Plan: Detector Modernization

## 1. Gap Analysis

### 1.1. OWASP Integration
*   **Status**: Partial / Disconnected.
*   **Gap**: The `Badge` struct and Frontend `types` support `owasp_category`, but the detection engine (`detectors.rs`) does not populate this field. All findings currently have `owasp_category: None`.
*   **Impact**: Users cannot filter by OWASP category, and the "Compliance" view will be empty.

### 1.2. Enhanced Detection Logic (Dead Code)
*   **Status**: Implemented but Unused.
*   **Gap**: The `detectors.rs` file contains advanced logic for:
    *   `detect_high_entropy_secrets` (Entropy based)
    *   `get_secret_patterns` (Comprehensive regex library)
    *   `get_pii_patterns` (SSN, Phone, Email)
    *   `get_automotive_patterns` (VINs)
    *   **Crucially**, none of these are called in the main `analyze_with_offsets` function. They are effectively dead code.
*   **Impact**:The scanner is missing critical secret and PII detection capabilities that are already written.

### 1.3. BOLA & Logic Flaws
*   **Status**: Structs defined, Logic missing.
*   **Gap**: `BolaFinding` and `HeaderFinding` structs exist, but there is no logic to instantiate them or analyze traffic for these patterns.
*   **Impact**: No detection for BOLA (API1:2023) or sophisticated Auth issues (API2:2023).

### 1.4. Architecture
*   **Status**: Legacy.
*   **Gap**: The `analyze_with_offsets` function is a monolithic block of `if let` statements. It needs to be refactored to use a plugin/modular approach where "Enhanced Detectors" are sub-routines.

---

## 2. Execution Plan

### Phase 1: OWASP Tagging & Refactoring
**Goal**: Enable OWASP categories and clean up the `Finding` builder.
- [x] Update `Finding::from_parts` with `owasp_category`
- [x] Update existing calls in `analyze_with_offsets`
- [x] Categorization Mapping (API8:2023, etc.)

### Phase 2: Activate Enhanced Detectors
**Goal**: Connect the "Dead Code" to the live analysis engine.
- [x] Implement `run_enhanced_detectors`
- [x] Convert `SecretFinding` results into `Finding`
- [x] Integrate into `analyze_with_offsets` (Now the primary logic)

### Phase 3: Implement BOLA & Auth Logic
**Goal**: Add logic for currently missing detectors.
- [x] Implement `detect_auth_issues` (Basic Auth, JWT none)
- [x] Implement `detect_bola_patterns` (Regex for sequential IDs)
- [x] Integrated into `run_enhanced_detectors`

### Phase 4: Verification
*   [ ] Run the scanner against `vulnerable-app` endpoints.
*   [ ] Verify findings show OWASP tags in the Inspector.
*   [ ] Verify "High Entropy" secrets are detected.
