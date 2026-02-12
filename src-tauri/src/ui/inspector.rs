use base64::{engine::general_purpose, Engine as _};
use hmac::{Hmac, Mac};
use jwt::SignWithKey;
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use std::collections::BTreeMap;

#[derive(Debug, Serialize, Deserialize)]
pub struct JwtClaims {
    pub key: String,
    pub value: String,
    pub is_sensitive: bool,
}

#[tauri::command]
pub async fn decode_jwt(token: String) -> Result<Vec<JwtClaims>, String> {
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 {
        return Err("Invalid JWT format (expected 3 parts)".to_string());
    }

    let payload_b64 = parts[1];
    let decoded = general_purpose::STANDARD_NO_PAD
        .decode(payload_b64)
        .map_err(|e| format!("Base64 decode failed: {}", e))?;

    let json: serde_json::Value =
        serde_json::from_slice(&decoded).map_err(|e| format!("JSON parse failed: {}", e))?;

    let mut claims = Vec::new();
    if let Some(obj) = json.as_object() {
        for (k, v) in obj {
            let k_lower = k.to_lowercase();
            let is_sensitive = ["admin", "role", "su", "permissions", "scope", "email"]
                .iter()
                .any(|&s| k_lower.contains(s));

            claims.push(JwtClaims {
                key: k.clone(),
                value: v.to_string(),
                is_sensitive,
            });
        }
    }

    Ok(claims)
}

#[tauri::command]
pub async fn generate_curl(
    method: String,
    url: String,
    headers: Option<String>,
    body: Option<String>,
) -> Result<String, String> {
    let mut cmd = format!("curl -X {} \"{}\"", method.to_uppercase(), url);

    if let Some(h) = headers {
        for line in h.lines() {
            if !line.trim().is_empty() {
                cmd.push_str(&format!(" -H \"{}\"", line.trim().replace("\"", "\\\"")));
            }
        }
    }

    if let Some(b) = body {
        if !b.trim().is_empty() {
            cmd.push_str(&format!(" -d '{}'", b.replace("'", "'\\''")));
        }
    }

    Ok(cmd)
}
#[tauri::command]
pub async fn sign_jwt(claims: serde_json::Value, secret: String) -> Result<String, String> {
    let key: Hmac<Sha256> =
        Hmac::new_from_slice(secret.as_bytes()).map_err(|e| format!("Invalid secret: {}", e))?;

    let mut btree_claims = BTreeMap::new();
    if let Some(obj) = claims.as_object() {
        for (k, v) in obj {
            btree_claims.insert(k.clone(), v.to_string().replace('"', ""));
        }
    }

    let token = btree_claims
        .sign_with_key(&key)
        .map_err(|e| format!("Signing failed: {}", e))?;

    Ok(token)
}
