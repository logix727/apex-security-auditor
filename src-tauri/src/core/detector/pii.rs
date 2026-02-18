use crate::core::detector::FindingSeverity;
use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecretFinding {
    pub secret_type: String,
    pub severity: FindingSeverity,
    pub matched_value: String,
    pub start_offset: usize,
    pub end_offset: usize,
    pub confidence: f64,
    pub description: String,
}

struct SecretPattern {
    name: &'static str,
    pattern: &'static str,
    severity: FindingSeverity,
    confidence: f64,
    description: &'static str,
}

fn luhn_check(card_number: &str) -> bool {
    let digits: Vec<u32> = card_number
        .chars()
        .filter(|c| c.is_ascii_digit())
        .map(|c| c.to_digit(10).unwrap())
        .collect();

    if digits.len() < 13 || digits.len() > 19 {
        return false;
    }

    let mut sum = 0;
    let mut alternate = false;

    for &digit in digits.iter().rev() {
        let mut n = digit;
        if alternate {
            n *= 2;
            if n > 9 {
                n = (n % 10) + 1;
            }
        }
        sum += n;
        alternate = !alternate;
    }

    sum % 10 == 0
}

fn mask_pii(value: &str, pii_type: &str) -> String {
    if pii_type.contains("Email") {
        if let Some(at_pos) = value.find('@') {
            if at_pos > 2 {
                return format!("{}***{}", &value[..2], &value[at_pos..]);
            }
        }
    } else if pii_type.contains("Phone") {
        if value.len() > 4 {
            return format!("***-***-{}", &value[value.len() - 4..]);
        }
    } else if value.len() > 4 {
        return format!("{}***", &value[..2]);
    }
    "***".to_string()
}

fn get_pii_patterns() -> Vec<SecretPattern> {
    vec![
        SecretPattern {
            name: "US SSN",
            pattern: r"\b[0-9]{3}-[0-9]{2}-[0-9]{4}\b",
            severity: FindingSeverity::Critical,
            confidence: 0.90,
            description: "US Social Security Number detected. Critical PII.",
        },
        SecretPattern {
            name: "US SSN (no dashes)",
            pattern: r"\b[0-9]{9}\b",
            severity: FindingSeverity::Medium,
            confidence: 0.30,
            description: "Potential US SSN (no dashes). Requires context verification.",
        },
        SecretPattern {
            name: "UK NINO",
            pattern: r"\b[A-CEGHJ-PR-TW-Z]{1}[A-CEGHJ-NPR-TW-Z]{1}[0-9]{6}[ABCD\s]{1}\b",
            severity: FindingSeverity::Critical,
            confidence: 0.85,
            description: "UK National Insurance Number detected.",
        },
        SecretPattern {
            name: "Canada SIN",
            pattern: r"\b[0-9]{3}-[0-9]{3}-[0-9]{3}\b",
            severity: FindingSeverity::Critical,
            confidence: 0.90,
            description: "Canada Social Insurance Number detected.",
        },
        SecretPattern {
            name: "IBAN",
            pattern: r"\b[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}\b",
            severity: FindingSeverity::High,
            confidence: 0.85,
            description: "International Bank Account Number (IBAN) detected.",
        },
        SecretPattern {
            name: "Email Address",
            pattern: r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",
            severity: FindingSeverity::Medium,
            confidence: 0.95,
            description: "Email address detected.",
        },
        SecretPattern {
            name: "General Phone",
            pattern: r"\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b",
            severity: FindingSeverity::Medium,
            confidence: 0.80,
            description: "Phone number detected.",
        },
        SecretPattern {
            name: "Credit Card Number",
            pattern: r"\b(?:[0-9]{4}[- ]?){3}[0-9]{4}\b",
            severity: FindingSeverity::Critical,
            confidence: 0.85,
            description: "Credit Card Number pattern detected. Verify with Luhn check.",
        },
        SecretPattern {
            name: "Credit Card (Amex)",
            pattern: r"\b3[47][0-9]{13}\b",
            severity: FindingSeverity::Critical,
            confidence: 0.90,
            description: "American Express Card Number detected.",
        },
        SecretPattern {
            name: "Credit Card (Visa)",
            pattern: r"\b4[0-9]{12}(?:[0-9]{3})?\b",
            severity: FindingSeverity::Critical,
            confidence: 0.85,
            description: "Visa Card Number detected.",
        },
        SecretPattern {
            name: "Credit Card (MasterCard)",
            pattern: r"\b5[1-5][0-9]{14}\b",
            severity: FindingSeverity::Critical,
            confidence: 0.85,
            description: "MasterCard Number detected.",
        },
        SecretPattern {
            name: "Passport Number",
            pattern: r"\b[A-Z0-9]{6,9}\b",
            severity: FindingSeverity::High,
            confidence: 0.40,
            description:
                "Potential Passport Number. High false positive rate without surrounding keywords.",
        },
    ]
}

pub fn detect_pii(content: &str) -> Vec<SecretFinding> {
    let mut findings = Vec::new();

    for pattern in get_pii_patterns() {
        if let Ok(re) = Regex::new(pattern.pattern) {
            for cap in re.find_iter(content) {
                let matched = cap.as_str();

                if pattern.name.contains("Credit Card") && !luhn_check(matched) {
                    continue;
                }

                // Context-aware checks
                if pattern.name == "US SSN (no dashes)" {
                    let context_start = cap.start().saturating_sub(50);
                    let context_end = (cap.end() + 50).min(content.len());
                    let context = &content[context_start..context_end].to_lowercase();
                    if !context.contains("ssn") && !context.contains("social security") {
                        continue;
                    }
                } else if pattern.name == "UK NINO" {
                    let context_start = cap.start().saturating_sub(50);
                    let context_end = (cap.end() + 50).min(content.len());
                    let context = &content[context_start..context_end].to_lowercase();
                    if !context.contains("nino")
                        && !context.contains("national insurance")
                        && !context.contains("ni number")
                    {
                        continue;
                    }
                } else if pattern.name == "Canada SIN" {
                    let context_start = cap.start().saturating_sub(50);
                    let context_end = (cap.end() + 50).min(content.len());
                    let context = &content[context_start..context_end].to_lowercase();
                    if !context.contains("sin") && !context.contains("social insurance") {
                        continue;
                    }
                } else if pattern.name == "Passport Number" {
                    let context_start = cap.start().saturating_sub(50);
                    let context_end = (cap.end() + 50).min(content.len());
                    let context = &content[context_start..context_end].to_lowercase();
                    if !context.contains("passport")
                        && !context.contains("pass no")
                        && !context.contains("document id")
                    {
                        continue;
                    }
                } else if pattern.name == "General Phone" {
                    // Reduce false positives for timestamps (e.g. 16xxxxxxxx)
                    // If it's a 10-digit number starting with 15, 16, or 17, it's likely a timestamp
                    let digits: String = matched.chars().filter(|c| c.is_ascii_digit()).collect();
                    if digits.len() == 10
                        && (digits.starts_with("15")
                            || digits.starts_with("16")
                            || digits.starts_with("17"))
                    {
                        let context_start = cap.start().saturating_sub(50);
                        let context_end = (cap.end() + 50).min(content.len());
                        let context = &content[context_start..context_end].to_lowercase();

                        // Only allow if we see phone-related keywords
                        if !context.contains("phone")
                            && !context.contains("tel")
                            && !context.contains("contact")
                            && !context.contains("mobile")
                            && !context.contains("cell")
                        {
                            continue;
                        }
                    }
                }

                findings.push(SecretFinding {
                    secret_type: pattern.name.to_string(),
                    severity: pattern.severity.clone(),
                    matched_value: mask_pii(matched, pattern.name),
                    start_offset: cap.start(),
                    end_offset: cap.end(),
                    confidence: pattern.confidence,
                    description: pattern.description.to_string(),
                });
            }
        }
    }

    findings
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_email() {
        let content = "Contact us at support@example.com for help.";
        let findings = detect_pii(content);
        assert!(!findings.is_empty());
        assert_eq!(findings[0].secret_type, "Email Address");
        assert_eq!(findings[0].matched_value, "su***@example.com");
    }

    #[test]
    fn test_detect_ssn() {
        let content = "My SSN is 123-45-6789";
        let findings = detect_pii(content);
        assert!(!findings.is_empty());
        assert_eq!(findings[0].secret_type, "US SSN");
    }

    #[test]
    fn test_detect_credit_card() {
        // Using a valid test card number (Luhn compliant)
        let content = "Pay with 4242 4242 4242 4242";
        let findings = detect_pii(content);
        assert!(!findings.is_empty());
        assert!(findings
            .iter()
            .any(|f| f.secret_type.contains("Credit Card")));
    }

    #[test]
    fn test_context_awareness_ssn() {
        let no_context = "Those numbers are 123456789";
        assert!(detect_pii(no_context).is_empty());

        let with_context = "The user ssn is 123456789";
        assert!(!detect_pii(with_context).is_empty());
    }

    #[test]
    fn test_luhn_check() {
        assert!(luhn_check("4242424242424242"));
        assert!(!luhn_check("4242424242424243"));
    }
}
