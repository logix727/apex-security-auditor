use crate::utils::crypto::CryptoManager;
use tauri::command;

#[command]
pub fn encrypt_api_key(key: String) -> Result<String, String> {
    let crypto = CryptoManager::new();
    crypto.encrypt(&key)
}

#[command]
pub fn decrypt_api_key(encrypted_key: String) -> Result<String, String> {
    let crypto = CryptoManager::new();
    crypto.decrypt(&encrypted_key)
}
