# Implementation Plan: Detector & Inspector OWASP Upgrade [COMPLETED]

## 1. Backend (Rust)

**Goal**: Native OWASP tagging and enhanced detection logic.

- **Mapping Plan**:
    - **API1:2023 BOLA**: Exposed IDs (`user_id`, `account_id`).
    - **API2:2023 Auth**: 401/403, standard Auth headers.
    - **API3:2023 Broken Object Property**: Mass Assignment (`is_admin`).
    - **API7:2023 SSRF**: Cloud metadata.
    - **API8:2023 Injection**: SQLi, RCE, XXE.
    - **API8:2023 Misconfig**: Missing Headers, Stack Traces.
- **New Detectors**:
    - **Basic Auth Warning**: Check `Authorization: Basic` + `http://` (API2).
    - **JWT alg:none**: Regex check for header `alg:none` (API2).

## 2. Frontend (React)
**Goal**: Visualize OWASP categories and remedial advice.

### 2.1 Type Definitions
**File**: `src/types.ts`
- Update `Badge` interface:
    ```typescript
    export interface Badge {
        // ...
        owasp_category?: string;
    }
    ```

### 2.2 Inspector UI
**File**: `src/components/Inspector.tsx`
- **Findings Grouping**:
    - In `SeverityChart` or `AssetTable`, allow filtering/viewing by OWASP tag.
- **Finding Detail View**:
    - When a finding is clicked (`activeInspectorTab === 'Exchange'`):
        - Show a new "Security Context" card above the response body.
        - Display:
            - **OWASP Category**: (e.g., "API8:2023 Security Misconfiguration")
            - **Remediation**: Static text mapping based on category.

### 2.3 Asset Utils
**File**: `src/utils/assetUtils.tsx`
- Update `getDetectionBadges` to handle (and maybe group) new OWASP info if needed.

## 3. Execution Steps
1.  **Backend**: Update `Badge` struct with `#[serde(default)]` and `Option<String>`.
2.  **Backend**: Refactor `detectors.rs` to populate these tags.
3.  **Frontend**: Update `types.ts`.
4.  **Frontend**: Update `Inspector.tsx` to display the new field.
5.  **Verify**: Run `cargo build` and `npm run dev`.
