use crate::data::VariableCapture;
use regex::Regex;
use std::collections::HashMap;

pub fn substitute_variables(template: &str, context: &HashMap<String, String>) -> String {
    let mut result = template.to_string();
    for (name, value) in context {
        let pattern = format!("{{{{{}}}}}", name);
        result = result.replace(&pattern, value);
    }
    result
}

pub fn extract_variables(
    captures: &[VariableCapture],
    response_body: &str,
    response_headers: &str,
) -> HashMap<String, String> {
    let mut new_vars = HashMap::new();

    for cap in captures {
        if let Some(value) = extract_single_variable(cap, response_body, response_headers) {
            new_vars.insert(cap.name.clone(), value);
        }
    }

    new_vars
}

fn extract_single_variable(
    cap: &VariableCapture,
    response_body: &str,
    response_headers: &str,
) -> Option<String> {
    let source_parts: Vec<&str> = cap.source.splitn(2, ':').collect();
    if source_parts.len() < 2 {
        return None;
    }

    let source_type = source_parts[0];
    let source_path = source_parts[1];

    match source_type {
        "json" => {
            let json: serde_json::Value = serde_json::from_str(response_body).ok()?;
            extract_json_value(&json, source_path)
        }
        "header" => {
            for line in response_headers.lines() {
                if let Some((key, val)) = line.split_once(':') {
                    if key.trim().to_lowercase() == source_path.to_lowercase() {
                        return Some(val.trim().to_string());
                    }
                }
            }
            None
        }
        "regex" => {
            let re = Regex::new(source_path).ok()?;
            re.captures(response_body)
                .and_then(|caps| caps.get(1).or_else(|| caps.get(0)))
                .map(|m| m.as_str().to_string())
        }
        _ => None,
    }
}

fn extract_json_value(json: &serde_json::Value, path: &str) -> Option<String> {
    let mut current = json;
    for part in path.split('.') {
        if part.is_empty() {
            continue;
        }
        current = current.get(part)?;
    }

    match current {
        serde_json::Value::String(s) => Some(s.clone()),
        serde_json::Value::Number(n) => Some(n.to_string()),
        serde_json::Value::Bool(b) => Some(b.to_string()),
        _ => Some(current.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_substitution() {
        let mut context = HashMap::new();
        context.insert("id".to_string(), "123".to_string());
        let result = substitute_variables("https://api.com/users/{{id}}", &context);
        assert_eq!(result, "https://api.com/users/123");
    }

    #[test]
    fn test_json_extraction() {
        let body = r#"{"user": {"id": 123, "name": "test"}}"#;
        let cap = VariableCapture {
            name: "uid".to_string(),
            source: "json:user.id".to_string(),
            regex: None,
        };
        let val = extract_single_variable(&cap, body, "");
        assert_eq!(val, Some("123".to_string()));
    }
}
