# Detector & Inspector Audit: Gap Analysis and Improvement Plan

## Executive Summary
The current ApexAPI detection engine is a robust **Passive Scanner** utilizing high-fidelity regex patterns and status code analysis. It excels at identifying **Injection (SQLi, RCE, SSRF)**, **Data Exposure (PII, Secrets)**, and **Configuration Issues**.

 However, to fully align with the **OWASP API Security Top 10 (2023)**, the system needs to evolve from finding *syntax errors* to finding *logic and authorization flaws*. This plan outlines the gap analysis and a roadmap to bridge these gaps.

---

## 1. Gap Analysis: OWASP API Security Top 10 (2023)

| OWASP Category | Current Status | Detection Maturity | Gap / Missing |
| :--- | :--- | :--- | :--- |
| **API1:2023 Broken Object Level Authorization (BOLA)** | ⚠️ Weak | Low | Detects exposed IDs (`user_id`). **Missing**: Analysis of whether User A can access User B's ID. Requires state/flow awareness. |
| **API2:2023 Broken Authentication** | ⚠️ Partial | Medium | Detects 401/403, standard Auth headers, JWTs. **Missing**: Detection of weak password policies, unauthenticated endpoints that *should* be protected. |
| **API3:2023 Broken Object Property Level Authorization** | ✅ Good | High | Detects Mass Assignment keywords (`is_admin`, `role`) in JSON. |
| **API4:2023 Unrestricted Resource Consumption** | ⚠️ Partial | Medium | Detects HTTP 429. **Missing**: Detection of *missing* rate limits on heavy endpoints (requires active probing). |
| **API5:2023 Broken Function Level Authorization (BFLA)** | ❌ Missing | Low | Difficult to detect passively. Needs role correlation (e.g., User accessing `/admin/*`). |
| **API6:2023 Unrestricted Access to Sensitive Business Flows** | ⚠️ Partial | Medium | "AI Logic Audit" feature addresses this, but deterministic detection is low. |
| **API7:2023 Server Side Request Forgery (SSRF)** | ✅ Good | High | Strong detection for Cloud Metadata signatures (AWS/GCP/Azure) in responses. |
| **API8:2023 Security Misconfiguration** | ✅ Good | High | robust analysis of Security Headers, CORS, Verbose Errors, and Stack Traces. |
| **API9:2023 Improper Inventory Management** | ✅ Good | High | The Workbench itself *is* the inventory solution. Flags unversioned APIs and zombie endpoints. |
| **API10:2023 Unsafe Consumption of APIs** | ❌ Missing | Low | Hard to detect unless scanning the upstream API responses specifically for malicious payloads. |

---

## 2. Improvement Plan

### Phase 1: Backend Detection Engine (Rust)
**Objective**: Enhance `detectors.rs` to support OWASP categorization and smarter logic.

1.  **Add OWASP Tagging to Findings**:
    *   Update `Badge` struct to include `owasp_category` (e.g., "API1:2023").
    *   Update `detectors.rs` to map existing checks to these categories.
    *   *Benefit*: Users can filter findings by OWASP category in the Inspector.

2.  **Refine BOLA/IDOR Detection**:
    *   **ID Pattern Analysis**: Instead of just matching `"user_id"`, track the *values*. If multiple unique user IDs appear in responses for the SAME endpoint pattern, flag as "High Risk for BOLA".
    *   **Guid Format Check**: Add detection for UUID/GUID patterns not just numeric IDs.

3.  **Enhance Authentication Checks**:
    *   **Basic Auth Warning**: Flag `Authorization: Basic` (Base64 creds) over non-HTTPS (already covered by lack of encryption checks, but make it explicit).
    *   **JWT Algorithm None**: Ensure the specific "alg:none" check is robust.

4.  **Zombie API Detection (Inventory)**:
    *   Add a detector for "Old Versions": logic that flags `/v1/` endpoints when `/v2/` is also seen in the same scan.

### Phase 2: Inspector Panel UX (Frontend)
**Objective**: "Call out" vulnerabilities more effectively to the analyst.

1.  **OWASP Remediation Cards**:
    *   When an OWASP-related finding is selected, show a "Remediation" card in the Details tab with standard guidance (e.g., "How to fix SQLi").

2.  **Visualization of Flow (BFLA Support)**:
    *   Add a "Role Analysis" view. Group assets by "Likely Admin" vs "Likely User" based on URL patterns (`/admin`, `/users`) and token claims.

3.  **Improve "Evidence" Highlighting**:
    *   For **Mass Assignment**, highlight the specific *key* (`is_admin`) in the JSON JSONTree, not just the text body.

### Phase 3: Active Verification (Future)
**Objective**: Move from "Suspected" to "Confirmed".
*   **Active Probe Button**: Add a "Verify BOLA" button on findings.
    *   *Action*: Replay the request but swap the `id` param with a previously seen ID from another session.
    *   *Result*: If 200 OK -> Confirmed BOLA.

---

## 3. Immediate Action Items (Next Session)
1.  **Tagging**: Add `owasp_category` field to `Badge` strings/structs in `detectors.rs`.
2.  **Descriptions**: Update finding descriptions to explicitly mention "OWASP API1:2023", etc.
    *   *Example*: Change "Potential SQL Injection..." to "OWASP API8: Injection - Potential SQL Injection...".
3.  **UI Update**: Update `getDetectionBadges` to group signatures by OWASP category if active.

