use serde::{Deserialize, Serialize};
use similar::{ChangeTag, TextDiff};

#[derive(Debug, Serialize, Deserialize)]
pub struct DiffLine {
    pub content: String,
    pub tag: String, // "Equal", "Delete", "Insert"
}

#[tauri::command]
pub fn compare_responses(old: String, new: String) -> Vec<DiffLine> {
    let diff = TextDiff::from_lines(&old, &new);
    let mut changes = Vec::new();

    for change in diff.iter_all_changes() {
        let tag = match change.tag() {
            ChangeTag::Delete => "Delete",
            ChangeTag::Insert => "Insert",
            ChangeTag::Equal => "Equal",
        };
        changes.push(DiffLine {
            content: change.value().to_string(),
            tag: tag.to_string(),
        });
    }

    changes
}
