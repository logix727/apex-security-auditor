use crate::core::detector::{self, Finding};
use crate::db::{Badge, Severity};

/// Analyze content and return standard findings for UI display
pub fn analyze(url: &str, body: &str, status: u16, method: &str, headers: &str) -> Vec<Badge> {
    let findings = analyze_with_offsets(url, body, status, method, headers);
    findings
        .into_iter()
        .map(|f| {
            let mut b = f.badge;
            // Only take evidence if we have body and valid offsets
            if f.end_offset > f.start_offset && f.end_offset <= body.len() {
                b.evidence = Some(body[f.start_offset..f.end_offset].to_string());
            }
            b.start = Some(f.start_offset);
            b.end = Some(f.end_offset);
            b
        })
        .collect()
}

/// Analyze content and return findings with offset information for precise masking
pub fn analyze_with_offsets(
    url: &str,
    body: &str,
    status: u16,
    method: &str,
    headers: &str,
) -> Vec<Finding> {
    let mut findings = Vec::new();

    // 0. RUN ENHANCED DETECTORS (Delegated to core/detector)
    findings.extend(detector::run_enhanced_detectors(url, body, headers));

    // 1. BUSINESS LOGIC / MISC
    let lower_body = body.to_lowercase();

    // Potential race condition detection
    if (method == "POST" || method == "PUT" || method == "DELETE") && status == 200 {
        if lower_body.contains("status")
            || lower_body.contains("state")
            || lower_body.contains("updated")
            || lower_body.contains("success")
        {
            if let Some((start, end)) = find_case_insensitive(body, "status") {
                findings.push(Finding::from_parts(
                    "🏁",
                    "Race",
                    Severity::Info,
                    "This endpoint returns state/status. If it's part of a multi-step flow, check for race conditions.",
                    start,
                    end,
                ).with_owasp("API6:2023 Unrestricted Access to Sensitive Business Flows"));
            }
        }
    }

    // Open Access
    if findings.is_empty() && status == 200 {
        findings.push(Finding::new(
            Badge::new(
                "🌍",
                "Public",
                Severity::Info,
                "Public Endpoint: No specific vulnerabilities detected, but accessible without auth errors (if any auth was required).",
            ).with_owasp("API2:2023 Broken Authentication (Review)"),
            0,
            0,
        ));
    }

    findings
}

/// Legacy function to maintain compatibility during migration
pub fn classify_vulnerability(finding: &str) -> Option<Badge> {
    let badges = analyze("", finding, 0, "GET", "");
    badges.into_iter().next()
}

/// Helper function to find case-insensitive substring and return its position
fn find_case_insensitive(haystack: &str, needle: &str) -> Option<(usize, usize)> {
    let lower_haystack = haystack.to_lowercase();
    if let Some(pos) = lower_haystack.find(&needle.to_lowercase()) {
        Some((pos, pos + needle.len()))
    } else {
        None
    }
}
