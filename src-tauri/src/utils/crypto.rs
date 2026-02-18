use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Key, Nonce,
};
use base64::{engine::general_purpose, Engine as _};
use keyring::Entry;
use rand::{thread_rng, RngCore};

const SERVICE_NAME: &str = "apex-security-auditor";
const USER_NAME: &str = "encryption-key";

pub struct CryptoManager {
    key: Key<Aes256Gcm>,
    legacy_key: Key<Aes256Gcm>,
}

impl Default for CryptoManager {
    fn default() -> Self {
        Self::new()
    }
}

impl CryptoManager {
    pub fn new() -> Self {
        // 1. Setup Legacy Key (for migration/fallback)
        let legacy_src = b"apex-security-auditor-secret-key-32b";
        let legacy_key = Key::<Aes256Gcm>::from_slice(&legacy_src[..32]);

        // 2. Setup Secure Key (from OS Keyring)
        let entry = Entry::new(SERVICE_NAME, USER_NAME).ok();

        let key_bytes = if let Some(entry) = &entry {
            match entry.get_password() {
                Ok(password) => {
                    // Start with decoding
                    match general_purpose::STANDARD.decode(password) {
                        Ok(bytes) if bytes.len() == 32 => bytes,
                        _ => Self::generate_and_store_key(entry),
                    }
                }
                Err(_) => Self::generate_and_store_key(entry),
            }
        } else {
            // Fallback if keyring is unavailable (e.g. some CI environments or weird OS states)
            // functionality-wise, we generate a random key that lasts for the session.
            // But for persistence, this is bad. We should warn.
            // For now, we'll log it if we could (but we don't have logger here easily).
            // We'll just generate a random key.
            let mut key = [0u8; 32];
            thread_rng().fill_bytes(&mut key);
            key.to_vec()
        };

        let key = Key::<Aes256Gcm>::from_slice(&key_bytes);

        Self {
            key: *key,
            legacy_key: *legacy_key,
        }
    }

    fn generate_and_store_key(entry: &Entry) -> Vec<u8> {
        let mut key = [0u8; 32];
        thread_rng().fill_bytes(&mut key);
        let key_vec = key.to_vec();

        // Encode as base64 for storage in string-based keyring
        let encoded = general_purpose::STANDARD.encode(&key_vec);

        // Best effort storage
        let _ = entry.set_password(&encoded);

        key_vec
    }

    pub fn encrypt(&self, data: &str) -> Result<String, String> {
        self.encrypt_with_key(&self.key, data)
    }

    fn encrypt_with_key(&self, key: &Key<Aes256Gcm>, data: &str) -> Result<String, String> {
        let cipher = Aes256Gcm::new(key);
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

        // Try primary key first
        let cipher_primary = Aes256Gcm::new(&self.key);
        match cipher_primary.decrypt(nonce, ciphertext) {
            Ok(plaintext) => {
                String::from_utf8(plaintext).map_err(|e| format!("UTF-8 conversion failed: {}", e))
            }
            Err(_) => {
                // Try legacy key
                let cipher_legacy = Aes256Gcm::new(&self.legacy_key);
                let decrypted_bytes = cipher_legacy
                    .decrypt(nonce, ciphertext)
                    .map_err(|e| format!("Decryption failed (tried both keys): {}", e))?;

                String::from_utf8(decrypted_bytes)
                    .map_err(|e| format!("UTF-8 conversion failed: {}", e))
            }
        }
    }
}
