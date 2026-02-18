use crate::utils::crypto::CryptoManager;
use tauri::{command, State};

#[command]
pub fn encrypt_api_key(key: String, crypto: State<'_, CryptoManager>) -> Result<String, String> {
    crypto.encrypt(&key)
}

#[command]
pub fn decrypt_api_key(
    encrypted_key: String,
    crypto: State<'_, CryptoManager>,
) -> Result<String, String> {
    crypto.decrypt(&encrypted_key)
}
