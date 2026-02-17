use base64::{engine::general_purpose, Engine as _};
use hmac::{Hmac, Mac};
use jwt::SignWithKey;
use serde_json;
use sha2::Sha256;
use std::collections::BTreeMap;

#[tauri::command]
pub async fn decode_jwt(token: String) -> Result<serde_json::Value, String> {
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() < 2 {
        return Err("Invalid JWT format (expected at least 2 parts)".to_string());
    }

    // Decode Header
    let header_b64 = parts[0];
    let header_decoded = general_purpose::URL_SAFE_NO_PAD
        .decode(header_b64)
        .map_err(|e| format!("Header Base64 decode failed: {}", e))?;
    let header_json: serde_json::Value =
        serde_json::from_slice(&header_decoded).unwrap_or(serde_json::Value::Null);

    // Decode Payload
    let payload_b64 = parts[1];
    let payload_decoded = general_purpose::URL_SAFE_NO_PAD
        .decode(payload_b64)
        .map_err(|e| format!("Payload Base64 decode failed: {}", e))?;

    let payload_json: serde_json::Value = serde_json::from_slice(&payload_decoded)
        .map_err(|e| format!("JSON parse failed: {}", e))?;

    // Try to identify owner/type
    let mut metadata = serde_json::Map::new();
    if let Some(obj) = payload_json.as_object() {
        if let Some(sub) = obj.get("sub") {
            metadata.insert("owner".to_string(), sub.clone());
        } else if let Some(email) = obj.get("email") {
            metadata.insert("owner".to_string(), email.clone());
        } else if let Some(upn) = obj.get("upn") {
            metadata.insert("owner".to_string(), upn.clone());
        }

        if obj.contains_key("nonce") && obj.contains_key("at_hash") {
            metadata.insert(
                "type".to_string(),
                serde_json::Value::String("OIDC ID Token".to_string()),
            );
        } else if obj.contains_key("scope") || obj.contains_key("scp") {
            metadata.insert(
                "type".to_string(),
                serde_json::Value::String("Access Token".to_string()),
            );
        }
    }

    let mut result = serde_json::Map::new();
    result.insert("header".to_string(), header_json);
    result.insert("payload".to_string(), payload_json);
    result.insert("metadata".to_string(), serde_json::Value::Object(metadata));

    Ok(serde_json::Value::Object(result))
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
