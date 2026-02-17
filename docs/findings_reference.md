# APEX API Security Detection Reference

This document lists all the security findings that APEX can detect, along with their associated icons and OWASP API Security Top 10 (2023) categorization.

## 🛑 Critical Risk Findings

| Icon | ID | Name | OWASP Category | Description |
| :---: | :--- | :--- | :--- | :--- |
| 🚗 | `Auto` | Automotive Telemetry | Sensitive Data Exposure | VIN, GNSS, CAN bus data leaks. |
| 💉 | `SQLi` | SQL Injection | API8:2023 Injection | SQL error messages or syntax in responses. |
| 💣 | `RCE` | Remote Code Execution | API8:2023 Injection | Evidence of command execution (e.g., `root:`, `/bin/sh`). |
| 🐚 | `CmdInj` | Command Injection | API8:2023 Injection | OS command fragments like `| whoami` or `; ls`. |
| 🌩️ | `SSRF` | Cloud Metadata Leak | API7:2023 SSRF | Exposure of cloud metadata services (AWS, GCP, Azure). |
| 📑 | `XXE` | XML External Entity | API8:2023 Injection | XML parsing vulnerabilities or file inclusions. |
| 🚨 | `PII-Crit` | Critical PII | Sensitive Data Exposure | SSN, Credit Card numbers, Passport IDs. |
| 🔐 | `Secret-Crit` | Critical Secrets | API2:2023 Broken Authentication | AWS Keys, GitHub Tokens, Database Credentials. |

## ⚠️ High Risk Findings

| Icon | ID | Name | OWASP Category | Description |
| :---: | :--- | :--- | :--- | :--- |
| 💳 | `PCI` | PCI-DSS Data | Sensitive Data Exposure | Credit Card PAN, CVV, Track data. |
| 🏥 | `HIPAA` | Healthcare Data | Sensitive Data Exposure | Medical records, PHI, ICD-10 codes. |
| 🎟️ | `JWT` | Weak JWT | API2:2023 Broken Authentication | `alg:none` or exposed tokens in body. |
| 🆔 | `BOLA` | Broken Object Level Auth | API1:2023 BOLA | Exposure of internal IDs (User ID, Account ID) in API responses. |
| 👤 | `PII-High` | High Risk PII | Sensitive Data Exposure | IBAN, Driver's License, Medical IDs. |
| 🔑 | `Secret-High` | High Risk Secrets | API2:2023 Broken Authentication | API Keys, OAuth Tokens. |

## 🔶 Medium Risk Findings

| Icon | ID | Name | OWASP Category | Description |
| :---: | :--- | :--- | :--- | :--- |
| 👤 | `PII` | General PII | Sensitive Data Exposure | Emails, Phone Numbers. |
| 🔑 | `Secret` | General Secrets | API2:2023 Broken Authentication | Generic secret patterns. |
| 📦 | `MassAssign` | Mass Assignment | API3:2023 Broken Object Property Level Authorization | Admin flags (`is_admin`, `role`) in JSON. |
| ⚖️ | `Legal` | Legal compliance | Legal & Compliance | GDPR, Terms of Service, Privacy Policies. |
| 💾 | `Dump` | Database Dump | API8:2023 Security Misconfiguration | SQL dump files or backups. |
| 🗣️ | `Verbose` | Verbose Errors | API8:2023 Security Misconfiguration | Stack traces, debug info exposure. |

## ℹ️ Low/Info Findings

| Icon | ID | Name | OWASP Category | Description |
| :---: | :--- | :--- | :--- | :--- |
| 📂 | `Dir` | Directory Listing | API8:2023 Security Misconfiguration | Exposed index/directory listing. |
| ℹ️ | `Infra` | Infrastructure Info | API8:2023 Security Misconfiguration | Server headers (Apache, Nginx versions). |
| 🛡️ | `HSTS` | Missing HSTS | API8:2023 Security Misconfiguration | Missing Strict-Transport-Security header. |
| 🛡️ | `CSP` | Missing CSP | API8:2023 Security Misconfiguration | Missing Content-Security-Policy header. |
| 🛡️ | `TypeConf` | MIME Sniffing | API8:2023 Security Misconfiguration | Missing X-Content-Type-Options. |
| ⚠️ | `Method` | Unsafe Method | API8:2023 Security Misconfiguration | PUT/DELETE methods on public endpoints. |
| ⏱️ | `Rate` | Rate Limiting | API4:2023 Unrestricted Resource Consumption | 429 Too Many Requests response. |
| 🔒 | `Auth` | Auth Required | Info | 401 Unauthorized response (Expected behavior). |
| 🚫 | `403` | Access Denied | Info | 403 Forbidden response (Expected behavior). |
