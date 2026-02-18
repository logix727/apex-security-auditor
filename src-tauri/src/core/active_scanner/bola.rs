use regex::Regex;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BolaFinding {
    pub original_url: String,
    pub tested_url: String,
    pub status: u16,
    pub evidence: String,
}

pub fn generate_bola_variants(url: &str) -> Vec<String> {
    let mut variants = Vec::new();
    // Match numeric segments in path
    let re = Regex::new(r"/(\d+)(/|$)").unwrap();

    // For each match, generate variants replacing that specific segment
    // Note: This simple approach might generate duplicates if multiple segments match, but that's okay for now.
    // A better approach would be to iterate over matches and replace.

    // We'll collect all ranges first to avoid borrowing issues
    let mut ranges = Vec::new();
    for cap in re.captures_iter(url) {
        if let Some(m) = cap.get(1) {
            ranges.push((m.start(), m.end(), m.as_str().to_string()));
        }
    }

    for (start, end, id_str) in ranges {
        if let Ok(id) = id_str.parse::<i64>() {
            let probes = vec![id - 1, id + 1, 0, 1, 999999];
            for probe in probes {
                if probe < 0 {
                    continue;
                }
                let mut new_url = url.to_string();
                new_url.replace_range(start..end, &probe.to_string());
                variants.push(new_url);
            }
        }
    }

    variants.sort();
    variants.dedup();
    variants
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_bola_generation() {
        let url = "http://api.com/users/123/orders";
        let variants = generate_bola_variants(url);
        assert!(variants.contains(&"http://api.com/users/122/orders".to_string()));
        assert!(variants.contains(&"http://api.com/users/124/orders".to_string()));
    }
}
