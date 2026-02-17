use crate::db::SqliteDatabase;
use tauri::State;

#[tauri::command]
pub async fn generate_audit_report(state: State<'_, SqliteDatabase>) -> Result<String, String> {
    let all_assets = state.get_assets().map_err(|e| e.to_string())?;

    // Filter for suspect assets (those with triage_status containing "Suspect" or high risk)
    let suspects: Vec<_> = all_assets
        .into_iter()
        .filter(|a| a.triage_status == "Suspect" || a.risk_score > 50)
        .collect();

    if suspects.is_empty() {
        return Ok("# No Findings to Report\n\nMark assets as 'Suspect' or run full scans to generate a report.".to_string());
    }

    let mut report = String::from("# APEX API Security Audit Report\n\n");
    report.push_str(&format!(
        "*Generated on: {}*\n\n",
        chrono::Local::now().format("%Y-%m-%d %H:%M:%S")
    ));

    for asset in suspects {
        report.push_str(&format!("## 🔍 Asset: {}\n", asset.url));
        report.push_str(&format!("**Method:** {}\n", asset.method));
        report.push_str(&format!("**Risk Score:** {}\n", asset.risk_score));
        report.push_str(&format!("**Triage Status:** {}\n\n", asset.triage_status));

        if !asset.findings.is_empty() {
            report.push_str("### 🚨 Findings\n");
            for finding in asset.findings {
                report.push_str(&format!(
                    "- **{}**: {}\n",
                    finding.short, finding.description
                ));
            }
            report.push_str("\n");
        }

        if !asset.notes.is_empty() {
            report.push_str("### 📝 Auditor Notes\n");
            report.push_str(&format!("{}\n\n", asset.notes));
        }

        report.push_str("### 🔗 Request Details\n");
        report.push_str("```http\n");
        report.push_str(&asset.request_headers);
        report.push_str("\n\n");
        report.push_str(&asset.request_body);
        report.push_str("\n```\n\n");

        report.push_str("---\n\n");
    }

    Ok(report)
}

#[tauri::command]
pub async fn export_to_csv_final_v5(state: State<'_, SqliteDatabase>) -> Result<String, String> {
    let all_assets = state.get_assets().map_err(|e| e.to_string())?;

    // Filter for suspect assets (those with triage_status containing "Suspect" or high risk)
    let suspects: Vec<_> = all_assets
        .into_iter()
        .filter(|a| a.triage_status == "Suspect" || a.risk_score > 50)
        .collect();

    let mut csv = String::from("URL,Method,Status,Risk Score,FindingsCount,Triage Status,Notes\n");
    for asset in suspects {
        let findings_count = asset.findings.len();
        let safe_url = asset.url.replace(',', ";");
        let safe_notes = asset.notes.replace(',', ";").replace('\n', " ");

        csv.push_str(&format!(
            "{},{},{},{},{},{},{}\n",
            safe_url,
            asset.method,
            asset.status,
            asset.risk_score,
            findings_count,
            asset.triage_status,
            safe_notes
        ));
    }

    Ok(csv)
}
