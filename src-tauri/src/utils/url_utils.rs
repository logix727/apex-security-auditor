use url::Url;

pub fn normalize_url(raw_url: &str) -> Option<String> {
    let mut parsed = Url::parse(raw_url).ok()?;

    // 0. Ensure strictly http or https
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return None;
    }

    // 1. Lowercase host
    if let Some(host) = parsed.host_str() {
        if host.trim().is_empty() {
            return None;
        }
    } else {
        return None;
    }

    // 2. Normalize path (remove trailing slash if not root)
    let path = parsed.path().to_string();
    if path.len() > 1 && path.ends_with('/') {
        let new_path = &path[..path.len() - 1];
        parsed.set_path(new_path);
    }

    // 3. Normalize query parameters (sort them)
    // ... existing logic is fine, let's keep it but ensure we return early if host is missing

    // Return early above handled host check.

    // 3. Normalize query parameters (sort them)
    let mut query_pairs: Vec<(String, String)> = parsed
        .query_pairs()
        .map(|(k, v)| (k.to_string(), v.to_string()))
        .collect();
    if !query_pairs.is_empty() {
        query_pairs.sort_by(|a, b| a.0.cmp(&b.0));
        parsed.query_pairs_mut().clear();
        for (k, v) in query_pairs {
            parsed.query_pairs_mut().append_pair(&k, &v);
        }
    } else {
        parsed.set_query(None);
    }

    // 4. Remove fragment
    parsed.set_fragment(None);

    Some(parsed.to_string())
}
