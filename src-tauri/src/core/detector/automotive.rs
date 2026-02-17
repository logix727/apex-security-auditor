use crate::core::detector::secrets::SecretFinding;
use crate::core::detector::FindingSeverity;
use regex::Regex;

pub fn detect_automotive(content: &str) -> Vec<SecretFinding> {
    let mut findings = Vec::new();

    let auto_patterns = vec![
        (
            "VIN",
            r"\b[A-HJ-NPR-Z0-9]{17}\b",
            FindingSeverity::Critical,
            "Vehicle Identification Number (VIN) detected.",
        ),
        (
            "OBD-II DTC",
            r"\b[P|C|B|U][0-9]{4}\b",
            FindingSeverity::Medium,
            "Diagnostic Trouble Code (DTC) detected.",
        ),
        (
            "GPS NMEA Sentence",
            r"\$(?:GP|GN|GL|GA)[A-Z]{3},.*",
            FindingSeverity::Medium,
            "Raw GPS NMEA sentence detected.",
        ),
    ];

    for (name, pattern, sev, desc) in auto_patterns {
        let re = Regex::new(pattern).unwrap();
        for cap in re.find_iter(content) {
            findings.push(SecretFinding {
                secret_type: name.to_string(),
                severity: sev.clone(),
                matched_value: format!("{}...", &cap.as_str()[..4.min(cap.as_str().len())]),
                start_offset: cap.start(),
                end_offset: cap.end(),
                confidence: 0.9,
                description: desc.to_string(),
            });
        }
    }

    findings
}
