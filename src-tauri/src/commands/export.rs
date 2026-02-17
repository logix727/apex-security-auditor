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
pub async fn export_findings_to_csv(
    state: State<'_, SqliteDatabase>,
    scope: Option<String>,
) -> Result<String, String> {
    let all_assets = state.get_assets().map_err(|e| e.to_string())?;

    let scope_val = scope.unwrap_or_else(|| "all".to_string());
    let assets_to_export: Vec<_> = match scope_val.as_str() {
        "suspects" => all_assets
            .into_iter()
            .filter(|a| a.triage_status == "Suspect" || a.risk_score > 50)
            .collect(),
        "critical" => all_assets
            .into_iter()
            .filter(|a| a.risk_score >= 90)
            .collect(),
        _ => all_assets,
    };

    let mut csv =
        String::from("URL,Method,Status,Risk Score,FindingsCount,Triage Status,Notes,Source\n");
    for asset in assets_to_export {
        let findings_count = asset.findings.len();
        let safe_url = asset.url.replace(',', ";");
        let safe_notes = asset.notes.replace(',', ";").replace('\n', " ");
        let safe_source = asset.source.replace(',', ";");

        csv.push_str(&format!(
            "{},{},{},{},{},{},{},{}\n",
            safe_url,
            asset.method,
            asset.status,
            asset.risk_score,
            findings_count,
            asset.triage_status,
            safe_notes,
            safe_source
        ));
    }

    Ok(csv)
}

#[tauri::command]
pub async fn generate_html_report(state: State<'_, SqliteDatabase>) -> Result<String, String> {
    let all_assets = state.get_assets().map_err(|e| e.to_string())?;

    // Filter for assets with items of interest
    let significant_assets: Vec<_> = all_assets
        .into_iter()
        .filter(|a| !a.findings.is_empty() || a.risk_score > 0 || a.triage_status != "Unreviewed")
        .collect();

    if significant_assets.is_empty() {
        return Ok(
            "<html><body><h1>No significant findings to report.</h1></body></html>".to_string(),
        );
    }

    let mut html = String::from(
        r#"<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>APEX Security Audit Report</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 1200px; margin: 0 auto; padding: 20px; }
        h1, h2, h3 { color: #2c3e50; }
        .header { border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 30px; }
        .asset { border: 1px solid #ddd; border-radius: 8px; margin-bottom: 20px; padding: 20px; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
        .asset-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding-bottom: 10px; margin-bottom: 10px; }
        .method { font-weight: bold; padding: 4px 8px; border-radius: 4px; color: white; background: #3498db; }
        .risk-high { color: #e74c3c; font-weight: bold; }
        .risk-medium { color: #e67e22; font-weight: bold; }
        .finding { background: #f9f9f9; padding: 10px; margin-top: 10px; border-left: 4px solid #3498db; }
        .finding.High { border-left-color: #e74c3c; }
        .finding.Medium { border-left-color: #e67e22; }
        code { background: #f4f4f4; padding: 2px 5px; border-radius: 3px; font-family: monospace; }
        pre { background: #f4f4f4; padding: 10px; border-radius: 5px; overflow-x: auto; }
    </style>
</head>
<body>
    <div class="header">
        <h1>APEX Security Audit Report</h1>
        <p>Generated: "#,
    );

    html.push_str(&chrono::Local::now().format("%Y-%m-%d %H:%M:%S").to_string());
    html.push_str("</p></div>");

    for asset in significant_assets {
        let risk_class = if asset.risk_score >= 50 {
            "risk-high"
        } else if asset.risk_score >= 20 {
            "risk-medium"
        } else {
            ""
        };

        html.push_str(&format!(
            r#"<div class="asset">
                <div class="asset-header">
                    <h3><span class="method">{}</span> {}</h3>
                    <span class="{}">Risk Score: {}</span>
                </div>
                <p><strong>Triage Status:</strong> {}</p>
            "#,
            asset.method, asset.url, risk_class, asset.risk_score, asset.triage_status
        ));

        if !asset.notes.is_empty() {
            html.push_str(&format!("<p><strong>Notes:</strong> {}</p>", asset.notes));
        }

        if !asset.findings.is_empty() {
            html.push_str("<h4>Findings:</h4>");
            for finding in asset.findings {
                let severity_str = format!("{:?}", finding.severity);
                html.push_str(&format!(
                    r#"<div class="finding {}">
                        <strong>[{}] {}</strong>
                        <p>{}</p>
                    </div>"#,
                    severity_str, severity_str, finding.short, finding.description
                ));
            }
        }

        html.push_str("</div>");
    }

    html.push_str("</body></html>");
    Ok(html)
}
