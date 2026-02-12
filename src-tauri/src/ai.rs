use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::AppHandle;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ProviderType {
    OpenAI,
    Anthropic,
    Local,
}

impl Default for ProviderType {
    fn default() -> Self {
        ProviderType::Local
    }
}

impl std::fmt::Display for ProviderType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ProviderType::OpenAI => write!(f, "openai"),
            ProviderType::Anthropic => write!(f, "anthropic"),
            ProviderType::Local => write!(f, "local"),
        }
    }
}

impl std::str::FromStr for ProviderType {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "openai" => Ok(ProviderType::OpenAI),
            "anthropic" => Ok(ProviderType::Anthropic),
            "local" | "ollama" | "lmstudio" | "builtin" => Ok(ProviderType::Local),
            _ => Ok(ProviderType::Local),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmConfig {
    pub endpoint: String,
    pub api_key: String,
    pub model: String,
    #[serde(default)]
    pub provider_type: ProviderType,
}

impl Default for LlmConfig {
    fn default() -> Self {
        Self {
            endpoint: "http://localhost:11434/api/chat".to_string(),
            api_key: String::new(),
            model: "phi3.5".to_string(),
            provider_type: ProviderType::Local,
        }
    }
}

fn get_config_path() -> PathBuf {
    let mut path = env::current_exe().unwrap_or_default();
    path.set_file_name("llm_config.json");
    path
}

impl LlmConfig {
    pub fn from_env() -> Self {
        let provider_str = env::var("APEX_LLM_PROVIDER").unwrap_or_else(|_| "local".to_string());

        let provider_type: ProviderType = provider_str.parse().unwrap_or_default();

        let default_endpoint = match provider_type {
            ProviderType::Local => "http://localhost:11434/api/chat".to_string(),
            ProviderType::OpenAI => "https://api.openai.com/v1/chat/completions".to_string(),
            ProviderType::Anthropic => "https://api.anthropic.com/v1/messages".to_string(),
        };

        let default_model = match provider_type {
            ProviderType::Local => "phi3.5".to_string(),
            ProviderType::OpenAI => "gpt-4".to_string(),
            ProviderType::Anthropic => "claude-3-5-sonnet-20240620".to_string(),
        };

        Self {
            endpoint: env::var("APEX_LLM_ENDPOINT").unwrap_or_else(|_| default_endpoint),
            api_key: env::var("APEX_LLM_API_KEY").unwrap_or_default(),
            model: env::var("APEX_LLM_MODEL").unwrap_or_else(|_| default_model),
            provider_type,
        }
    }

    pub fn load() -> Self {
        let path = get_config_path();
        if path.exists() {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(config) = serde_json::from_str::<LlmConfig>(&content) {
                    return Self {
                        endpoint: env::var("APEX_LLM_ENDPOINT").unwrap_or_else(|_| config.endpoint),
                        api_key: env::var("APEX_LLM_API_KEY").unwrap_or_else(|_| config.api_key),
                        model: env::var("APEX_LLM_MODEL").unwrap_or_else(|_| config.model),
                        provider_type: env::var("APEX_LLM_PROVIDER")
                            .ok()
                            .and_then(|p| p.parse().ok())
                            .unwrap_or(config.provider_type),
                    };
                }
            }
        }
        Self::from_env()
    }

    pub fn save(&self) -> Result<(), String> {
        let path = get_config_path();
        let content = serde_json::to_string_pretty(self)
            .map_err(|e| format!("Failed to serialize config: {}", e))?;
        fs::write(&path, content).map_err(|e| format!("Failed to write config file: {}", e))?;
        Ok(())
    }

    pub fn is_local(&self) -> bool {
        self.provider_type == ProviderType::Local
    }

    pub fn is_configured(&self) -> bool {
        !self.api_key.is_empty() || self.is_local()
    }
}

#[derive(Debug, Deserialize)]
pub struct AnalyzeFindingInput {
    pub asset_url: String,
    pub finding_type: String,
    pub response_body_snippet: String,
    #[serde(default)]
    pub context: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct LogicAuditInput {
    pub asset_url: String,
    pub request_headers: String,
    pub response_headers: String,
    pub response_body: String,
}

#[derive(Debug, Deserialize)]
pub struct AssetSummaryInput {
    pub asset_url: String,
    pub findings: Vec<String>,
    #[serde(default)]
    pub context: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct AnalyzeFindingOutput {
    pub analysis: String,
    pub provider: String,
}

#[derive(Debug, Serialize)]
pub struct AnalyzeAssetSummaryOutput {
    pub summary: String,
    pub provider: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LlmConfigPublic {
    pub endpoint: String,
    pub model: String,
    pub provider_type: ProviderType,
    pub is_configured: bool,
}

impl From<&LlmConfig> for LlmConfigPublic {
    fn from(config: &LlmConfig) -> Self {
        Self {
            endpoint: config.endpoint.clone(),
            model: config.model.clone(),
            provider_type: config.provider_type.clone(),
            is_configured: config.is_configured(),
        }
    }
}

fn build_analysis_prompt(input: &AnalyzeFindingInput) -> String {
    let context_section = input
        .context
        .as_ref()
        .map(|c| format!("\n\nPrevious context:\n{}", c))
        .unwrap_or_default();

    format!(
        r#"You are a Senior API Security Engineer and Penetration Tester.
Analyze the following finding with technical precision.

🎯 TARGET: {}
🔍 VULNERABILITY: {}

📦 RESPONSE CONTEXT:
```
{}
```
{}

Provide your analysis in a structured, high-signal format:
1. 📝 TECHNICAL SUMMARY: (Deep dive into the mechanism of the vulnerability)
2. 🚨 RISK VECTORS: (Explain realistic exploit scenarios and blast radius)
3. 🔬 EVIDENCE GAPS: (What else should a researcher check to confirm this?)
4. 🛠️ REMEDIATION: (Specific, code-level fix for the development team)
5. 🛡️ DEFENSIVE DEPTH: (Complementary security controls to prevent this class of issue)
"#,
        input.asset_url, input.finding_type, input.response_body_snippet, context_section
    )
}

fn build_asset_summary_prompt(input: &AssetSummaryInput) -> String {
    let context_section = input
        .context
        .as_ref()
        .map(|c| format!("\n\nContext:\n{}", c))
        .unwrap_or_default();

    let findings_list = input.findings.join("\n- ");

    format!(
        r#"You are an EXPERT API SECURITY ANALYST.
Analyze the security findings for this asset and provide a high-efficiency audit insight.

Asset URL: {}

Findings Detected:
- {}
{}

Instructions:
1. FOCUS on the most critical findings first.
2. ⛓️ Identify ATTACK CHAINS and BLAST RADIUS. How does this impact the API environment?
3. Use EMOJIS (🛑, ⚠️, 🛠️, ⛓️, 🔍) to highlight key sections.
4. Keep it technical and immersive. No "Executive Summary" fluff.

Output Format (Markdown):
# 🔍 RAPID TRIAGE: {}
[Technical overview of the exposure in 2 sentences. Be direct.]

# 🕵️ CRITICAL EXPOSURE
- [Exposure 1]: [Technical detail + Why it matters]
- [Exposure 2]: [Technical detail]

# ⛓️ POSSIBLE ATTACK PATH
[Describe how an attacker would realistically exploit these findings in a chain.]

# 🛠️ REMEDIATION PRIORITY
[Specific technical action to take immediately.]
"#,
        input.asset_url, findings_list, context_section, input.asset_url
    )
}

fn build_logic_audit_prompt(input: &LogicAuditInput) -> String {
    format!(
        r#"You are a SENIOR BUSINESS LOGIC SECURITY EXPERT. 
Analyze the following HTTP interaction for subtle, high-impact business logic vulnerabilities.

🎯 TARGET: {}

📄 REQUEST HEADERS:
```
{}
```

📄 RESPONSE HEADERS:
```
{}
```

📄 RESPONSE BODY:
```
{}
```

Look specifically for:
1. 🔢 NUMERICAL MANIPULATION: Potential for negative amounts, price overrides, or integer overflows.
2. 🔐 AUTHORIZATION BYPASS: Indicators that state-changing operations lack proper session/role guarding.
3. 🏁 RACE CONDITIONS: Multi-step flow indicators that could be subverted by concurrent requests.
4. 🎁 PROMOTIONAL ABUSE: Coupon/discount logic flaws.
5. 👤 PRIVILEGE ESCALATION: IDOR or parameter tampering that could allow access to other users' data.

Output Format (Markdown):
# ⚖️ BUSINESS LOGIC AUDIT
## 🔎 CRITICAL OBSERVATIONS
[Technical deep dive into suspicious parameters or behavior]

## 🚨 POTENTIAL VULNERABILITIES
- [Vulnerability Name]: [Detailed Exploit Scenario]

## 🛠️ VERIFICATION STEPS
[How a human pentester should manually confirm these flaws]

## 🛡️ REMEDIATION
[Technical fix to harden the business logic]
"#,
        input.asset_url, input.request_headers, input.response_headers, input.response_body
    )
}

async fn call_openai_api(config: &LlmConfig, prompt: &str) -> Result<String, String> {
    let client = reqwest::Client::new();

    let request_body = serde_json::json!({
        "model": config.model,
        "messages": [
            {
                "role": "system",
                "content": "You are a helpful security analyst assistant."
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        "max_tokens": 1000,
        "temperature": 0.7
    });

    let response = client
        .post(&config.endpoint)
        .header("Authorization", format!("Bearer {}", config.api_key))
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Failed to send request to LLM: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("LLM API error ({}): {}", status, error_text));
    }

    let response_json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse LLM response: {}", e))?;

    let analysis = response_json["choices"]
        .as_array()
        .and_then(|arr| arr.first())
        .and_then(|choice| choice.get("message"))
        .and_then(|msg| msg.get("content"))
        .and_then(|content| content.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "Failed to extract analysis from LLM response".to_string())?;

    Ok(analysis)
}

async fn call_ollama_api(config: &LlmConfig, prompt: &str) -> Result<String, String> {
    let client = reqwest::Client::new();

    let request_body = serde_json::json!({
        "model": config.model,
        "messages": [
            {
                "role": "system",
                "content": "You are an EXPERT API SECURITY RESEARCHER. Your tone is professional, technical, and direct."
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        "stream": false,
        "options": {
            "num_ctx": 4096,
            "temperature": 0.1
        }
    });

    let response = client
        .post(&config.endpoint)
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Failed to send request to Ollama: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response
            .text()
            .await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("Ollama API error ({}): {}", status, error_text));
    }

    let response_json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;

    let analysis = response_json["message"]
        .as_object()
        .and_then(|msg| msg.get("content"))
        .and_then(|content| content.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "Failed to extract analysis from Ollama response".to_string())?;

    Ok(analysis)
}

async fn call_llm_api(config: &LlmConfig, prompt: &str) -> Result<String, String> {
    if config.is_local() {
        call_ollama_api(config, prompt).await
    } else {
        call_openai_api(config, prompt).await
    }
}

#[tauri::command]
pub async fn analyze_logic_flaws(
    input: LogicAuditInput,
) -> Result<AnalyzeAssetSummaryOutput, String> {
    let config = LlmConfig::load();
    let provider_display = match config.provider_type {
        ProviderType::OpenAI => "OpenAI",
        ProviderType::Anthropic => "Anthropic",
        ProviderType::Local => "Local",
    };

    if !config.is_configured() {
        return Err("LLM not configured for logic audits.".to_string());
    }

    let prompt = build_logic_audit_prompt(&input);
    let analysis = call_llm_api(&config, &prompt)
        .await
        .map_err(|e| format!("{}: {}", provider_display, e))?;

    Ok(AnalyzeAssetSummaryOutput {
        summary: analysis,
        provider: provider_display.to_string(),
    })
}

#[tauri::command]
pub async fn analyze_finding(
    asset_url: String,
    finding_type: String,
    response_body_snippet: String,
    context: Option<String>,
) -> Result<AnalyzeFindingOutput, String> {
    let config = LlmConfig::load();

    let input = AnalyzeFindingInput {
        asset_url,
        finding_type,
        response_body_snippet,
        context,
    };

    let provider_display = match config.provider_type {
        ProviderType::OpenAI => "OpenAI",
        ProviderType::Anthropic => "Anthropic",
        ProviderType::Local => "Local",
    };

    if !config.is_configured() {
        return Err("LLM not configured. Please go to Settings and configure a Built-in Local or External API provider.".to_string());
    }

    let prompt = build_analysis_prompt(&input);
    let analysis = call_llm_api(&config, &prompt)
        .await
        .map_err(|e| format!("{}: {}", provider_display, e))?;

    Ok(AnalyzeFindingOutput {
        analysis,
        provider: provider_display.to_string(),
    })
}

#[tauri::command]
pub async fn analyze_asset_summary(
    asset_url: String,
    findings: Vec<String>,
    context: Option<String>,
) -> Result<AnalyzeAssetSummaryOutput, String> {
    let config = LlmConfig::load();

    let input = AssetSummaryInput {
        asset_url,
        findings,
        context,
    };

    let provider_display = match config.provider_type {
        ProviderType::OpenAI => "OpenAI",
        ProviderType::Anthropic => "Anthropic",
        ProviderType::Local => "Local",
    };

    if !config.is_configured() {
        return Err("LLM not configured for summaries.".to_string());
    }

    let prompt = build_asset_summary_prompt(&input);
    let summary = call_llm_api(&config, &prompt)
        .await
        .map_err(|e| format!("{}: {}", provider_display, e))?;

    Ok(AnalyzeAssetSummaryOutput {
        summary,
        provider: provider_display.to_string(),
    })
}

#[tauri::command]
pub fn get_llm_config() -> LlmConfigPublic {
    let config = LlmConfig::load();
    LlmConfigPublic::from(&config)
}

#[tauri::command]
pub fn update_llm_config(
    endpoint: String,
    api_key: String,
    model: String,
    provider_type: String,
) -> Result<LlmConfigPublic, String> {
    let mut config = LlmConfig::load();

    config.endpoint = endpoint;
    config.model = model;
    config.provider_type = provider_type.parse().unwrap_or(ProviderType::OpenAI);

    if !api_key.is_empty() {
        config.api_key = api_key;
    }

    if config.is_local() && config.endpoint.is_empty() {
        config.endpoint = "http://localhost:11434/api/chat".to_string();
    }

    if config.is_local()
        && (config.model.is_empty()
            || config.model == "llama3"
            || config.model == "llama3.1"
            || config.model == "llama3.2")
    {
        config.model = "phi3.5".to_string();
    }

    config.save()?;

    Ok(LlmConfigPublic::from(&config))
}

pub fn is_model_present(model_name: &str) -> bool {
    let output = std::process::Command::new("ollama")
        .args(&["list"])
        .output();

    if let Ok(output) = output {
        let stdout = String::from_utf8_lossy(&output.stdout);
        stdout.contains(model_name)
    } else {
        false
    }
}

pub async fn ensure_model_present(handle: AppHandle, model_name: &str) -> Result<(), String> {
    if is_model_present(model_name) {
        crate::emit_log(
            &handle,
            crate::LogLevel::Success,
            "AI",
            &format!("Model {} is ready.", model_name),
            None,
        );
        return Ok(());
    }

    crate::emit_log(
        &handle,
        crate::LogLevel::Warn,
        "AI",
        &format!(
            "Model {} not found. Pulling now... (This may take a few minutes)",
            model_name
        ),
        None,
    );

    let status = std::process::Command::new("ollama")
        .args(&["pull", model_name])
        .status()
        .map_err(|e| format!("Failed to initiate ollama pull: {}", e))?;

    if status.success() {
        crate::emit_log(
            &handle,
            crate::LogLevel::Success,
            "AI",
            &format!("Model {} pulled successfully.", model_name),
            None,
        );
        Ok(())
    } else {
        let err = format!("Failed to pull {}. Ensure Ollama is running.", model_name);
        crate::emit_log(&handle, crate::LogLevel::Error, "AI", &err, None);
        Err(err)
    }
}

pub fn auto_initialize_ai(handle: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let config = LlmConfig::load();
        if config.is_local() {
            let _ = ensure_model_present(handle, &config.model).await;
        }
    });
}

#[tauri::command]
pub async fn check_local_model_status() -> Result<bool, String> {
    let config = LlmConfig::load();
    Ok(is_model_present(&config.model))
}

#[tauri::command]
pub async fn pull_local_model(app_handle: AppHandle) -> Result<(), String> {
    let config = LlmConfig::load();
    ensure_model_present(app_handle, &config.model).await
}

#[allow(dead_code)]
pub struct AppConfig {
    pub llm_config: Mutex<LlmConfig>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            llm_config: Mutex::new(LlmConfig::load()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_llm_config_defaults() {
        let config = LlmConfig::default();
        assert!(config.endpoint.contains("localhost"));
        assert!(config.model.contains("phi3.5"));
        assert_eq!(config.provider_type, ProviderType::Local);
    }

    #[test]
    fn test_provider_type_parsing() {
        assert_eq!(
            "openai".parse::<ProviderType>().unwrap(),
            ProviderType::OpenAI
        );
        assert_eq!(
            "anthropic".parse::<ProviderType>().unwrap(),
            ProviderType::Anthropic
        );
        assert_eq!(
            "local".parse::<ProviderType>().unwrap(),
            ProviderType::Local
        );
        assert_eq!(
            "ollama".parse::<ProviderType>().unwrap(),
            ProviderType::Local
        );
    }

    #[test]
    fn test_is_local() {
        let mut config = LlmConfig::default();
        assert!(config.is_local());

        config.provider_type = ProviderType::OpenAI;
        assert!(!config.is_local());
    }

    #[test]
    fn test_is_configured() {
        let mut config = LlmConfig::default();
        // Default is local, so it's already configured
        assert!(config.is_configured());

        config.api_key = "test-key".to_string();
        assert!(config.is_configured());

        config.api_key = String::new();
        config.provider_type = ProviderType::OpenAI;
        assert!(!config.is_configured());
    }

    #[test]
    fn test_build_prompt() {
        let input = AnalyzeFindingInput {
            asset_url: "https://example.com".to_string(),
            finding_type: "SQL_INJECTION".to_string(),
            response_body_snippet: "Error: SQL syntax".to_string(),
            context: None,
        };
        let prompt = build_analysis_prompt(&input);
        assert!(prompt.contains("https://example.com"));
        assert!(prompt.contains("SQL_INJECTION"));
    }
}
