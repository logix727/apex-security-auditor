use crate::commands::debug::{emit_log, LogLevel};
use crate::utils::crypto::CryptoManager;
use serde::{Deserialize, Serialize};
use std::env;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager, State};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "lowercase")]
pub enum ProviderType {
    #[default]
    Local,
    // Deprecated but kept for config compat
    OpenAI,
    Anthropic,
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
        let provider_str = env::var("APEX_LLM_PROVIDER").unwrap_or("local".to_string());

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
            endpoint: env::var("APEX_LLM_ENDPOINT").unwrap_or(default_endpoint),
            api_key: env::var("APEX_LLM_API_KEY").unwrap_or_default(),
            model: env::var("APEX_LLM_MODEL").unwrap_or(default_model),
            provider_type,
        }
    }

    pub fn load(crypto: &CryptoManager) -> Self {
        let path = get_config_path();
        if path.exists() {
            if let Ok(content) = fs::read_to_string(&path) {
                if let Ok(mut config) = serde_json::from_str::<LlmConfig>(&content) {
                    // Decrypt API Key if it looks encrypted (starts with 'enc:' or just try decrypt)
                    // For backward compatibility, check if decryption works.
                    // Since we didn't use a prefix, we try to decrypt. If fail, assume plaintext.
                    // For backward compatibility, check if decryption works.
                    // Since we didn't use a prefix, we try to decrypt. If fail, assume plaintext.
                    if let Ok(decrypted) = crypto.decrypt(&config.api_key) {
                        config.api_key = decrypted;
                    }
                    // If decryption fails, use as is (plaintext migration)

                    return Self {
                        endpoint: env::var("APEX_LLM_ENDPOINT").unwrap_or(config.endpoint),
                        api_key: env::var("APEX_LLM_API_KEY").unwrap_or(config.api_key),
                        model: env::var("APEX_LLM_MODEL").unwrap_or(config.model),
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

    pub fn save(&self, crypto: &CryptoManager) -> Result<(), String> {
        let path = get_config_path();
        let mut config_to_save = self.clone();

        // Encrypt API Key
        if !config_to_save.api_key.is_empty() {
            match crypto.encrypt(&config_to_save.api_key) {
                Ok(encrypted) => config_to_save.api_key = encrypted,
                Err(e) => return Err(format!("Failed to encrypt API key: {}", e)),
            }
        }

        let content = serde_json::to_string_pretty(&config_to_save)
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
    pub request_headers: String,
    pub response_body_snippet: String,
    pub headers_snippet: String,
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
3. 🔢 CVSS v3.1 EVALUATION: (Provide estimated Score and Vector, e.g. 7.5 High - CVSS:3.1/AV:N/AC:L/PR:N/UI:N/I:H/A:N)
4. 🕵️ FALSE POSITIVE CHECK: (Critically evaluate if this could be a false positive based on the evidence)
5. 🔬 EVIDENCE GAPS: (What else should a researcher check to confirm this?)
6. 🛠️ REMEDIATION: (Specific, code-level fix for the development team)
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
        r#"You are a SENIOR API SECURITY ANALYST conducting a professional penetration test.
Your goal is to provide a REALITY-CHECKED, EVIDENCE-BASED security assessment.

Asset URL: {}

Detected Findings (Automated Scans):
- {}

Request Headers:
```
{}
```

Response Preview:
```
{}
```

Response Headers:
```
{}
```
{}

Instructions:
1. 🕵️ REALITY CHECK: Compare the "Detected Findings" against the actual Response Body/Headers.
   - Example: If "Missing Auth" is detected but the response is 404 Not Found, it's likely a False Positive or Low Risk.
   - Example: If "PII" is detected but the data is just public IDs, mark it as Low/Info.
2. 🛡️ IMPACT ANALYSIS: Focus on what can actually be exploited. Theoretical risks should be downplayed.
3. 🔢 INDUSTRY STANDARDS: Assign estimated CVSS v3.1 scores based on the *actual* evidence presence.
4. 📝 SUMMARY: Provide 3-4 concise, professional bullet points. Use "Analyst Note:" for manual observations.

Output Format (Markdown):
# 🛡️ ANALYST ASSESSMENT
- [EMOJI] [CATEGORY]: [Assessment based on evidence. Include CVSS if high risk.]
"#,
        input.asset_url,
        findings_list,
        input.request_headers,
        input.response_body_snippet,
        input.headers_snippet,
        context_section
    )
}

fn build_remediation_guide_prompt(input: &AssetSummaryInput) -> String {
    let findings_list = input.findings.join("\n- ");

    format!(
        r#"You are a LEAD APPSEC ENGINEER writing a remediation guide for a developer.
The goal is to fix the following findings on: {}

Findings:
{}

Context (Response Snippet):
```
{}
```

Instructions:
1. 🎯 GROUPING: Group related findings (e.g. all Header issues together).
2. 🛠️ TECHNICAL FIX: Provide concrete, copy-pasteable code snippets (assuming standard tech stacks like Node/Express, Python/Flask, or Go unless evident otherwise).
3. 📉 IMPACT: Briefly explain WHY this needs fixing (Business/Security impact).
4. ✅ VERIFICATION: Provide a `curl` command or specific steps to verify the fix.

Output Format (Markdown):
# 🛠️ REMEDIATION GUIDE

## 🚨 [Vulnerability Group Name]
**Impact**: [One sentence on why this matters]

### 💻 Code Fix (Example)
```javascript
// Example implementation
app.use(helmet()); // ...
```

### ✅ Verification
```bash
curl -I {}
# Expect: ...
```
"#,
        input.asset_url, findings_list, input.response_body_snippet, input.asset_url
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

## 🕵️ FALSE POSITIVE CHECK
[Critically evaluate if the observed behavior is actually standard for this API type (e.g. 404 on missing ID is normal)]

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

// Removed OpenAI/Anthropic specific implementations to enforce Local-Only policy per user request.

async fn call_ollama_api(config: &LlmConfig, prompt: &str) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60)) // Add timeout
        .build()
        .map_err(|e| format!("Failed to build HTTP client: {}", e))?;

    let request_body = serde_json::json!({
        "model": config.model,
        "messages": [
            {
                "role": "system",
                "content": "You are APEX SECURITY ANALYST, an uncompromising, high-signal security research agent. You prioritize raw technical evidence, impact, and realistic exploitability over theoretical risks. Your tone is direct, expert, and occasionally snarky about common dev mistakes."
            },
            {
                "role": "user",
                "content": prompt
            }
        ],
        "stream": false,
        "options": {
            "num_ctx": 8192, // Increased context window
            "temperature": 0.1
        }
    });

    let response = client
        .post(&config.endpoint)
        .header("Content-Type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| {
            format!(
                "Failed to connect to Ollama at {}. Is it running? Error: {}",
                config.endpoint, e
            )
        })?;

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
    // Strictly enforce local provider usage
    if !config.is_local() {
        return Err("Only Local AI (Ollama) is supported in this restricted mode.".to_string());
    }
    call_ollama_api(config, prompt).await
}

#[tauri::command]
pub async fn analyze_logic_flaws(
    input: LogicAuditInput,
    crypto: State<'_, CryptoManager>,
) -> Result<AnalyzeAssetSummaryOutput, String> {
    let config = LlmConfig::load(&crypto);
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
    crypto: State<'_, CryptoManager>,
) -> Result<AnalyzeFindingOutput, String> {
    let config = LlmConfig::load(&crypto);

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
    request_headers: String,
    response_body_snippet: String,
    headers_snippet: String,
    context: Option<String>,
    crypto: State<'_, CryptoManager>,
) -> Result<AnalyzeAssetSummaryOutput, String> {
    let config = LlmConfig::load(&crypto);

    let input = AssetSummaryInput {
        asset_url,
        findings,
        request_headers,
        response_body_snippet,
        headers_snippet,
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
pub async fn generate_remediation_guide(
    asset_url: String,
    findings: Vec<String>,
    request_headers: String,
    response_body_snippet: String,
    headers_snippet: String,
    context: Option<String>,
    crypto: State<'_, CryptoManager>,
) -> Result<AnalyzeAssetSummaryOutput, String> {
    let config = LlmConfig::load(&crypto);

    let input = AssetSummaryInput {
        asset_url,
        findings,
        request_headers,
        response_body_snippet,
        headers_snippet,
        context,
    };

    let provider_display = match config.provider_type {
        ProviderType::OpenAI => "OpenAI",
        ProviderType::Anthropic => "Anthropic",
        ProviderType::Local => "Local",
    };

    if !config.is_configured() {
        return Err("LLM not configured for remediation guides.".to_string());
    }

    let prompt = build_remediation_guide_prompt(&input);
    let summary = call_llm_api(&config, &prompt)
        .await
        .map_err(|e| format!("{}: {}", provider_display, e))?;

    Ok(AnalyzeAssetSummaryOutput {
        summary,
        provider: provider_display.to_string(),
    })
}

#[derive(Debug, Deserialize)]
pub struct SequenceAnalysisInput {
    pub sequence: crate::core::data::RequestSequence,
    #[serde(default)]
    pub context: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SequenceAnalysisOutput {
    pub analysis: String,
    pub provider: String,
}

fn build_sequence_analysis_prompt(input: &SequenceAnalysisInput) -> String {
    let steps_text = input.sequence.steps.iter().enumerate().map(|(i, step)| {
        format!(
            "STEP {}: {} {}\nStatus: {}\nRequest Headers: {:?}\nRequest Body: {:?}\nResponse Body Snippet: {:?}\n",
            i + 1,
            step.method,
            step.url,
            step.status_code,
            step.request_headers,
            step.request_body,
            step.response_body.as_ref().map(|b| b.chars().take(200).collect::<String>()).unwrap_or_default()
        )
    }).collect::<Vec<_>>().join("\n---\n");

    format!(
        r#"You are a LOGIC FLAW EXPERT.
Analyze the following HTTP request sequence for authorization bypasses, IDOR, and logic flaws.

FLOW NAME: {}
CONTEXT: {}

SEQUENCE:
{}

INSTRUCTIONS:
1. Identify if the sequence enforces proper state transitions.
2. Check if resources created in previous steps are accessed securely in later steps.
3. Look for IDOR (e.g., using an ID from step 1 in step 2 without auth).

OUTPUT FORMAT:
# ⛓️ SEQUENCE ANALYSIS
## 🚨 DETECTED FLAWS
- [FLAW_NAME]: [Description]

## ✅ GOOD PRACTICES
- [Description]

## 🛠️ RECOMMENDATIONS
- [Actionable Fix]
"#,
        input
            .sequence
            .flow_name
            .as_deref()
            .unwrap_or("Unnamed Flow"),
        input.context.as_deref().unwrap_or("None"),
        steps_text
    )
}

#[tauri::command]
pub async fn analyze_sequence(
    sequence: crate::core::data::RequestSequence,
    context: Option<String>,
    crypto: State<'_, CryptoManager>,
) -> Result<SequenceAnalysisOutput, String> {
    let config = LlmConfig::load(&crypto);
    let provider_display = match config.provider_type {
        ProviderType::OpenAI => "OpenAI",
        ProviderType::Anthropic => "Anthropic",
        ProviderType::Local => "Local",
    };

    if !config.is_configured() {
        return Err("LLM not configured.".to_string());
    }

    let input = SequenceAnalysisInput { sequence, context };
    let prompt = build_sequence_analysis_prompt(&input);
    let analysis = call_llm_api(&config, &prompt)
        .await
        .map_err(|e| format!("{}: {}", provider_display, e))?;

    Ok(SequenceAnalysisOutput {
        analysis,
        provider: provider_display.to_string(),
    })
}

fn build_exploit_narrative_prompt(sequence: &crate::core::data::RequestSequence) -> String {
    let steps_text = sequence
        .steps
        .iter()
        .enumerate()
        .map(|(i, step)| {
            format!(
                "STEP {}: {} {}\nResponse Snippet: {:?}\n",
                i + 1,
                step.method,
                step.url,
                step.response_body
                    .as_ref()
                    .map(|b| b.chars().take(200).collect::<String>())
                    .unwrap_or_default()
            )
        })
        .collect::<Vec<_>>()
        .join("\n---\n");

    format!(
        r#"You are a RED TEAM OPERATOR.
Construct a technical exploit narrative for this attack sequence.
Focus on explaining exactly how the security controls were bypassed or how the logic flaw was chain.

FLOW: {}

SEQUENCE:
{}

OUTPUT FORMAT:
# 🚩 EXPLOIT NARRATIVE
## 🎯 OBJECTIVE
[What the attacker is trying to achieve]

## 🛠️ ATTACK VECTOR
[Specific vulnerability type, e.g., BOLA to Account Takeover]

## ⛓️ STEP-BY-STEP FLOW
1. [Explanation of Step 1]
2. [Explanation of Step 2 and how it uses data from Step 1]
...

## 💥 IMPACT
[Business impact of this exploit]
"#,
        sequence.flow_name.as_deref().unwrap_or("Unnamed Flow"),
        steps_text
    )
}

#[tauri::command]
pub async fn generate_exploit_narrative(
    sequence: crate::core::data::RequestSequence,
    crypto: State<'_, CryptoManager>,
) -> Result<SequenceAnalysisOutput, String> {
    let config = LlmConfig::load(&crypto);
    let provider_display = match config.provider_type {
        ProviderType::OpenAI => "OpenAI",
        ProviderType::Anthropic => "Anthropic",
        ProviderType::Local => "Local",
    };

    if !config.is_configured() {
        return Err("LLM not configured.".to_string());
    }

    let prompt = build_exploit_narrative_prompt(&sequence);
    let analysis = call_llm_api(&config, &prompt)
        .await
        .map_err(|e| format!("{}: {}", provider_display, e))?;

    Ok(SequenceAnalysisOutput {
        analysis,
        provider: provider_display.to_string(),
    })
}

fn build_remediation_diff_prompt(sequence: &crate::core::data::RequestSequence) -> String {
    format!(
        r#"You are a SECURE CODING EXPERT.
Provide a technical remediation guide and code-level diff for the vulnerabilities detected in this sequence.

FLOW: {}

INSTRUCTIONS:
1. Explain the root cause.
2. Provide a generic code-level fix (use common languages like Python/Go/Node if specific language is unknown).
3. Suggest architectural improvements.

OUTPUT FORMAT:
# 🛠️ REMEDIATION GUIDE
## 🔍 ROOT CAUSE
[Description]

## 💻 SUGGESTED FIX
```diff
- [Vulnerable Code]
+ [Secure Code]
```

## 🛡️ DEFENSIVE STRATEGY
[Architectural advice]
"#,
        sequence.flow_name.as_deref().unwrap_or("Unnamed Flow")
    )
}

#[tauri::command]
pub async fn generate_remediation_diff(
    sequence: crate::core::data::RequestSequence,
    crypto: State<'_, CryptoManager>,
) -> Result<SequenceAnalysisOutput, String> {
    let config = LlmConfig::load(&crypto);
    let provider_display = match config.provider_type {
        ProviderType::OpenAI => "OpenAI",
        ProviderType::Anthropic => "Anthropic",
        ProviderType::Local => "Local",
    };

    if !config.is_configured() {
        return Err("LLM not configured.".to_string());
    }

    let prompt = build_remediation_diff_prompt(&sequence);
    let analysis = call_llm_api(&config, &prompt)
        .await
        .map_err(|e| format!("{}: {}", provider_display, e))?;

    Ok(SequenceAnalysisOutput {
        analysis,
        provider: provider_display.to_string(),
    })
}

#[tauri::command]
pub fn get_llm_config(crypto: State<'_, CryptoManager>) -> LlmConfigPublic {
    let config = LlmConfig::load(&crypto);
    LlmConfigPublic::from(&config)
}

#[tauri::command]
pub fn update_llm_config(
    endpoint: String,
    api_key: String,
    model: String,
    provider_type: String,
    crypto: State<'_, CryptoManager>,
) -> Result<LlmConfigPublic, String> {
    let mut config = LlmConfig::load(&crypto);

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

    config.save(&crypto)?;

    Ok(LlmConfigPublic::from(&config))
}

pub fn is_model_present(model_name: &str) -> bool {
    let output = std::process::Command::new("ollama").args(["list"]).output();

    if let Ok(output) = output {
        let stdout = String::from_utf8_lossy(&output.stdout);
        stdout.contains(model_name)
    } else {
        false
    }
}

pub async fn ensure_model_present(handle: AppHandle, model_name: &str) -> Result<(), String> {
    if is_model_present(model_name) {
        emit_log(
            &handle,
            LogLevel::Success,
            "AI",
            &format!("Model {} is ready.", model_name),
            None,
        );
        return Ok(());
    }

    emit_log(
        &handle,
        LogLevel::Warn,
        "AI",
        &format!(
            "Model {} not found. Pulling now... (This may take a few minutes)",
            model_name
        ),
        None,
    );

    let status = std::process::Command::new("ollama")
        .args(["pull", model_name])
        .status()
        .map_err(|e| format!("Failed to initiate ollama pull: {}", e))?;

    if status.success() {
        emit_log(
            &handle,
            LogLevel::Success,
            "AI",
            &format!("Model {} pulled successfully.", model_name),
            None,
        );
        Ok(())
    } else {
        let err = format!("Failed to pull {}. Ensure Ollama is running.", model_name);
        emit_log(&handle, LogLevel::Error, "AI", &err, None);
        Err(err)
    }
}

pub fn auto_initialize_ai(handle: AppHandle) {
    tauri::async_runtime::spawn(async move {
        // AppHandle implements Manager, allowing state access
        if let Some(crypto) = handle.try_state::<CryptoManager>() {
            let config = LlmConfig::load(&crypto);
            if config.is_local() {
                let _ = ensure_model_present(handle, &config.model).await;
            }
        }
    });
}

#[tauri::command]
pub async fn check_local_model_status(crypto: State<'_, CryptoManager>) -> Result<bool, String> {
    let config = LlmConfig::load(&crypto);
    Ok(is_model_present(&config.model))
}

#[tauri::command]
pub async fn pull_local_model(
    app_handle: AppHandle,
    crypto: State<'_, CryptoManager>,
) -> Result<(), String> {
    let config = LlmConfig::load(&crypto);
    ensure_model_present(app_handle, &config.model).await
}

// Removed dead AppConfig code

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
