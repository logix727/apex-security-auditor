# Features Guide

## 📋 Overview

Apex Security Auditor provides comprehensive API security analysis through multiple integrated features. This guide explains each feature in detail.

---

## 🔍 1. OpenAPI Parser

### What It Does

Parses and analyzes OpenAPI 3.0+ specifications to extract API structure and security information.

### Key Capabilities

- ✓ Supports OpenAPI 3.0, 3.1 formats
- ✓ Handles JSON and YAML specs
- ✓ Validates spec compliance
- ✓ Extracts endpoints, methods, parameters
- ✓ Identifies security schemes
- ✓ Parses request/response schemas

### How to Use

1. Launch Apex Security Auditor
2. Open the **Inspector** tab
3. Click **Load OpenAPI Spec**
4. Select your OpenAPI JSON/YAML file
5. Parser automatically validates and extracts data
6. Review extracted endpoints in the list

### Example OpenAPI Spec

```yaml
openapi: 3.0.0
info:
  title: Pet Store API
  version: 1.0.0
paths:
  /pets:
    get:
      summary: List all pets
      parameters:
        - name: limit
          in: query
          schema:
            type: integer
      security:
        - bearerAuth: []
      responses:
        '200':
          description: A list of pets
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
```

### Output Information

- **Endpoints**: HTTP method, path, description
- **Parameters**: Query, path, header, body parameters
- **Security**: Required auth schemes
- **Responses**: HTTP status codes and schemas

---

## 🎯 2. Security Scanner

### What It Does

Scans API specifications for common security vulnerabilities and misconfigurations.

### Vulnerability Categories

#### **Authentication Issues**
- Missing authentication on sensitive endpoints
- Weak authentication schemes
- Unencrypted credential transmission

#### **Authorization Issues**
- Missing role-based access control
- Overly permissive endpoints
- Scope validation problems

#### **Data Protection**
- Sensitive data in URLs/logs
- Missing encryption (HTTP vs HTTPS)
- Exposed API keys or secrets

#### **Input Validation**
- Missing schema validation
- No rate limiting
- Weak parameter validation

#### **Server Configuration**
- Debug mode enabled
- CORS misconfiguration
- Missing security headers

### How to Use

1. Load a spec with the **OpenAPI Parser**
2. **Security Scanner** runs automatically
3. View vulnerabilities in the **Inspector** panel
4. Click each vulnerability for details
5. Review **Severity** levels:
   - 🔴 **Critical** - Immediate fix required
   - 🟠 **High** - Should fix soon
   - 🟡 **Medium** - Address in next cycle
   - 🔵 **Low** - Nice to have fix

### Example Detection

For endpoint with no authentication:
```
Title: Missing Authentication
Severity: Critical
Path: POST /api/users
Description: Endpoint modifies user data but has no security requirement
Recommendation: Add authentication (OAuth 2.0, API Key, etc.)
```

---

## 🔐 3. PII (Personally Identifiable Information) Detector

### What It Does

Detects and masks sensitive personal information in API specs and responses.

### Detectable PII Types

| Type | Pattern | Example |
|------|---------|---------|
| Email | RFC 5322 format | john.doe@example.com |
| U.S. Social Security Number | XXX-XX-XXXX | 123-45-6789 |
| Credit Card | Luhn algorithm | 4532-1234-5678-9010 |
| Phone Number | US format | (555) 123-4567 |
| IP Address | IPv4/IPv6 | 192.168.1.1 |
| Zip Code | US format | 12345-6789 |
| Date of Birth | Multiple formats | 1990-01-15 |
| Bank Account | Common patterns | 0123456789 |

### How to Use

1. Open **PIIMasker** component
2. Upload or paste API specification/response
3. Click **Run PII Detection**
4. Review detected PII items
5. Generate **Masked Report** for sharing
6. Export compliance documentation

### Example Output

**Original:**
```json
{
  "name": "John Doe",
  "email": "john.doe@example.com",
  "ssn": "123-45-6789",
  "phone": "(555) 123-4567"
}
```

**Masked:**
```json
{
  "name": "John Doe",
  "email": "[EMAIL_REDACTED]",
  "ssn": "[SSN_REDACTED]",
  "phone": "[PHONE_REDACTED]"
}
```

### Configuration

Customize detection in settings:
- Enable/disable specific PII types
- Adjust sensitivity levels
- Add custom patterns
- Set masking format

---

## 📊 4. Interactive Inspector

### What It Does

Provides visual analysis interface for API specifications with detailed endpoint information.

### Components

#### **Endpoint Browser**
- Lists all discovered endpoints
- Filter by method (GET, POST, etc.)
- Search by path
- Sort by various criteria

#### **Endpoint Details Panel**
- Full endpoint specification
- Request parameters and schema
- Response schemas
- Security requirements
- Example requests/responses

#### **Vulnerability Summary**
- Count by severity
- Quick fix recommendations
- Compliance status

### How to Use

1. Load OpenAPI spec
2. Browse endpoints in left panel
3. Click endpoint to view details
4. Review security settings
5. Check vulnerability warnings
6. Export analysis report

### Features

- 🔍 Full-text search across specifications
- 📋 Inline request/response previews
- 🔗 Navigate related schemas
- 💾 Bookmark important endpoints
- 📤 Export detailed reports

---

## 🤖 5. AI-Powered Analysis

### What It Does

Enhances vulnerability analysis using AI models for intelligent suggestions and contextual insights.

### Capabilities

- **Smart Detection**: Identify subtle security issues humans might miss
- **Contextual Analysis**: Understand business logic implications
- **Fix Suggestions**: Get remediation recommendations
- **Risk Assessment**: Evaluate real-world impact
- **Best Practices**: Alignment with security standards

### Configuration

1. Go to **Settings** → **AI Integration**
2. Configure API provider (OpenAI, Claude, etc.)
3. Enter API key
4. Select model version
5. Adjust analysis depth

### Example AI-Enhanced Analysis

**Human Detection:**
```
Missing HTTPS on endpoint
```

**AI Analysis:**
```
The GET /api/users endpoint accepts unencrypted connections.
Impact: User credentials transmitted in plain text
Risk: Medium-High (depends on data sensitivity)
Fix: Enforce HTTPS only, add HSTS headers
Compliance: Violates PCI-DSS, GDPR requirements
```

### Privacy Note

- No spec data stored on AI provider servers
- Only sends necessary context
- Configurable data retention
- Can run offline (basic analysis)

---

## 💾 6. Database & Audit History

### What It Does

Stores and manages audit results, supporting compliance tracking and historical analysis.

### Features

- **Audit History** - Track all scans performed
- **Trend Analysis** - Monitor improvement over time
- **Compliance Reports** - Generate PDF reports
- **Export** - Backup and share results
- **Filtering** - Search historical audits

### Data Stored

- Specification metadata
- Detected vulnerabilities
- PII findings
- Scan timestamps
- Analysis results
- Remediation status

### How to Use

1. Run analysis on API spec
2. Results automatically saved
3. View **Audit History** tab
4. Click audit to review details
5. Generate compliance reports
6. Export for stakeholders

### Reports Available

- **Executive Summary** - High-level overview
- **Detailed Report** - Full vulnerability list
- **Remediation Plan** - Fix recommendations
- **Compliance Checklist** - Standards alignment
- **Trend Report** - Historical comparison

---

## 🖨️ 7. Report Generation

### Report Types

#### **Executive Report**
Best for: Management, stakeholders
- Overview of findings
- Risk summary by severity
- Key recommendations
- Timeline for remediation

#### **Technical Report**
Best for: Development teams
- Detailed vulnerability listings
- Code examples
- Implementation guides
- Tool-specific recommendations

#### **Compliance Report**
Best for: Auditors, compliance teams
- Regulatory alignment (GDPR, PCI-DSS, SOC 2)
- Requirement mappings
- Findings crosswalk
- Certification eligibility

### Export Formats

- **PDF** - Professional reports
- **JSON** - Data interchange
- **CSV** - Spreadsheet import
- **XLSX** - Excel workbooks
- **HTML** - Web viewing

### Customization

- Add company logo/branding
- Include custom footer text
- Select metrics to include
- Configure severity thresholds
- Add remediation timelines

---

## 🔄 8. Continuous Integration Integration

### Supported Platforms

- GitHub Actions
- GitLab CI
- Jenkins
- Azure DevOps
- BitBucket Pipelines

### Configuration Example (GitHub Actions)

```yaml
name: API Security Scan
on: [push, pull_request]

jobs:
  security-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Run Apex Security Auditor
        run: |
          apex-auditor analyze ./api/openapi.yaml \
            --output ./reports/audit.json
      - name: Upload Report
        uses: actions/upload-artifact@v2
        with:
          name: security-report
          path: ./reports/audit.json
```

---

## ⚙️ Settings & Configuration

### General Settings
- **App Language** - UI language selection
- **Theme** - Light/Dark mode
- **Auto-save** - Enable/disable autosave
- **Notifications** - Alert preferences

### Analysis Settings
- **Severity Threshold** - Minimum severity to report
- **Custom Rules** - Define additional checks
- **Exclusions** - Ignore specific endpoints
- **Report Format** - Default export format

### AI Settings
- **Provider** - AI service selection
- **Model** - Model version
- **API Key** - Authentication token
- **Request Timeout** - Analysis duration limit

### Database Settings
- **Auto-backup** - Scheduled backups
- **Retention** - Historical data retention
- **Export Path** - Default export location

---

## 🚀 Advanced Features

### Custom Detection Rules

Create rules to detect organization-specific issues:

```json
{
  "id": "custom-rule-1",
  "name": "Deprecated API Version",
  "description": "Detects use of deprecated API versions",
  "pattern": "/v1/",
  "severity": "high",
  "recommendation": "Migrate to v2 API"
}
```

### Batch Analysis

Analyze multiple specifications:

1. Create analysis configuration
2. Add multiple OpenAPI specs
3. Run batch scan
4. Generate consolidated report
5. Track remediation across APIs

### Integration APIs

Programmatically access auditor functionality:

```typescript
import { invoke } from '@tauri-apps/api/tauri';

// Run analysis programmatically
const results = await invoke('scan_spec', {
  spec_path: './openapi.json',
  rules: ['security', 'compliance']
});
```

---

## 📊 Performance Tips

- **Large Specs** (>10MB): Use batch processing
- **Complex Analysis** - Enable multi-threading
- **Database Optimization** - Periodic cleanup
- **Network** - Cache parsed specs locally

---

## 🔗 Integration Examples

### JIRA Integration
Automatically create tickets for vulnerabilities:
```
Summary: [CRITICAL] Missing authentication on /api/users
Description: [Vulnerability details]
Assignee: Security Team
Priority: Highest
```

### Slack Integration
Alert team of critical issues:
```
⚠️ Critical vulnerability found in Pet Store API
  • Missing HTTPS enforcement
  • Exposed API keys in spec
  • Review: [link to report]
```

---

## 📚 More Information

- [Installation Guide](./INSTALLATION.md)
- [Architecture Guide](./ARCHITECTURE.md)
- [Contributing Guide](../CONTRIBUTING.md)
