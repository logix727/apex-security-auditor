use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Key, Nonce,
};
use base64::{engine::general_purpose, Engine as _};
use rand::{thread_rng, RngCore};

pub struct CryptoManager {
    key: Key<Aes256Gcm>,
}

impl CryptoManager {
    pub fn new() -> Self {
        // In a real app, this should be derived from a machine-specific secret or user passphrase
        // For this implementation, we'll use a hardcoded key for demonstration,
        // but it should be moved to a secure vault or derived.
        let key_bytes = b"apex-security-auditor-secret-key-32b"; // 32 bytes
        let key = Key::<Aes256Gcm>::from_slice(&key_bytes[..32]);
        Self { key: *key }
    }

    pub fn encrypt(&self, data: &str) -> Result<String, String> {
        let cipher = Aes256Gcm::new(&self.key);
        let mut nonce_bytes = [0u8; 12];
        thread_rng().fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        let ciphertext = cipher
            .encrypt(nonce, data.as_bytes())
            .map_err(|e| format!("Encryption failed: {}", e))?;

        // Combine nonce and ciphertext for storage
        let mut combined = nonce_bytes.to_vec();
        combined.extend(ciphertext);

        Ok(general_purpose::STANDARD.encode(combined))
    }

    pub fn decrypt(&self, encoded_data: &str) -> Result<String, String> {
        let combined = general_purpose::STANDARD
            .decode(encoded_data)
            .map_err(|e| format!("Base64 decode failed: {}", e))?;

        if combined.len() < 12 {
            return Err("Invalid encrypted data length".to_string());
        }

        let (nonce_bytes, ciphertext) = combined.split_at(12);
        let nonce = Nonce::from_slice(nonce_bytes);

        let cipher = Aes256Gcm::new(&self.key);
        let decrypted_bytes = cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| format!("Decryption failed: {}", e))?;

        String::from_utf8(decrypted_bytes).map_err(|e| format!("UTF-8 conversion failed: {}", e))
    }
}
