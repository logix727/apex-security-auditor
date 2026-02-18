use serde::Serialize;

#[derive(Debug, Serialize, Clone)]
pub struct RiskAssessment {
    pub risk_score: i64,    // 0-100
    pub risk_level: String, // Low, Medium, High, Critical
    pub risk_factors: Vec<String>,
}

pub fn calculate_risk_for_asset(url: &str, method: &str) -> RiskAssessment {
    let mut score = 0;
    let mut factors = Vec::new();

    let url_lower = url.to_lowercase();
    let method_upper = method.to_uppercase();

    // 1. Method Based Risk
    match method_upper.as_str() {
        "POST" | "PUT" | "PATCH" | "DELETE" => {
            score += 20;
            factors.push(format!("State-changing method: {}", method_upper));
        }
        _ => {}
    }

    // 2. Keyword Based Risk (High Value Targets)
    let high_value_keywords = [
        "admin", "user", "account", "login", "auth", "token", "key", "secret", "payment",
        "billing", "credit", "card", "bank", "transfer", "config", "settings", "password", "reset",
        "2fa", "mfa",
    ];

    for kw in high_value_keywords {
        if url_lower.contains(kw) {
            score += 15;
            factors.push(format!("High-value keyword: {}", kw));
            // Cap keyword accumulation to avoid inflation? No, multiple keywords imply higher complexity/sensitivity.
        }
    }

    // 3. Infrastructure/Environment Risk
    if url_lower.contains("dev") || url_lower.contains("test") || url_lower.contains("staging") {
        score += 10;
        factors.push("Non-production environment (potential reduced security)".to_string());
    }

    if url_lower.contains("internal")
        || url_lower.contains("private")
        || url_lower.contains("vpn")
        || url_lower.contains("corp")
    {
        score += 25;
        factors.push("Internal/Private infrastructure detected".to_string());
    }

    // 4. Tech Stack Indicators
    if url_lower.contains(".git")
        || url_lower.contains(".env")
        || url_lower.contains("config.json")
        || url_lower.contains("actuator")
    {
        score += 50;
        factors.push("Sensitive configuration or SCM file".to_string());
    }

    // Normalize Score
    if score > 100 {
        score = 100;
    }

    let risk_level = if score >= 80 {
        "Critical".to_string()
    } else if score >= 50 {
        "High".to_string()
    } else if score >= 30 {
        "Medium".to_string()
    } else if score > 0 {
        "Low".to_string()
    } else {
        "Info".to_string()
    };

    RiskAssessment {
        risk_score: score,
        risk_level,
        risk_factors: factors,
    }
}
