# Architecture Guide

## 🏗️ System Overview

Apex Security Auditor is built using a **Tauri framework** with a **React frontend** and **Rust backend**, following a modern desktop application architecture.

```
┌─────────────────────────────────────────┐
│     React/TypeScript UI Layer           │
│  (Components, State Management)         │
└──────────────┬──────────────────────────┘
               │ Tauri IPC Bridge
┌──────────────▼──────────────────────────┐
│     Rust Backend Layer (Tauri)          │
│  (Business Logic, Security Analysis)    │
├──────────────────────────────────────────┤
│  • OpenAPI Parser    • AI Integration    │
│  • Vulnerability Scanner • PII Detector │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│     Data Layer (SQLite Database)        │
│  (Persistent Storage, Audit Results)    │
└──────────────────────────────────────────┘
```

---

## 📋 Component Architecture

### Frontend Layer (`src/`)

#### **React Components**

```
src/
├── App.tsx                    # Root component, main layout
├── main.tsx                   # React entry point
├── components/
│   ├── DebugConsole.tsx      # Displays debug logs & system info
│   ├── Inspector.tsx          # API endpoint analysis interface
│   └── PIIMasker.tsx          # PII detection & masking UI
└── assets/
    └── styles/                # Component-specific styles
```

**Component Hierarchy:**
```
App
├── DebugConsole      # Logging interface
├── Inspector         # Main analysis panel
└── PIIMasker         # PII detection panel
```

#### **State Management**

- Uses **React Hooks** (useState, useContext)
- Communicates with Rust backend via **Tauri IPC**
- No external state library (keep it lightweight)

---

### Backend Layer (`src-tauri/src/`)

#### **Core Modules**

```rust
main.rs              // Tauri app initialization & IPC handlers
lib.rs               // Library exports
data.rs              // Data structures & models
│
├── scanner.rs       // Security vulnerability scanner
├── detectors.rs     // Pattern detection engines
├── openapi_parser.rs// OpenAPI spec parsing & validation
├── ai.rs            // AI integration (analysis, suggestions)
├── db.rs            // Database operations (SQLite)
└── ui/
    ├── mod.rs       // UI module exports
    └── inspector.rs // Inspector-specific backend logic
```

#### **Data Flow in Backend**

```
User Input (IPC)
    ↓
[IPC Handler] (main.rs)
    ↓
[Business Logic] (scanner, detector, parser)
    ↓
[Database] (db.rs)
    ↓
Response (JSON) → Frontend
```

---

## 🔑 Key Modules Explained

### 1. **OpenAPI Parser** (`openapi_parser.rs`)

Parses and validates OpenAPI 3.0+ specifications:

```rust
pub struct ApiSpec {
    pub version: String,
    pub endpoints: Vec<ApiEndpoint>,
    pub schemas: HashMap<String, Schema>,
}

pub fn parse_openapi(spec_json: &str) -> Result<ApiSpec, ParseError> {
    // Parse OpenAPI spec
    // Extract endpoints, methods, parameters, responses
    // Validate schema
}
```

**Responsibilities:**
- Extract endpoint information
- Parse request/response schemas
- Validate against OpenAPI spec
- Identify security schemes

### 2. **Security Scanner** (`scanner.rs`)

Detects vulnerabilities in API endpoints:

```rust
pub struct Vulnerability {
    pub id: String,
    pub severity: Severity,
    pub title: String,
    pub description: String,
    pub endpoint: String,
}

pub fn scan_endpoint(endpoint: &ApiEndpoint) -> Vec<Vulnerability> {
    // Check for common vulnerabilities
    // Validate security configurations
    // Detect missing authentication
}
```

**Detects:**
- Missing authentication/authorization
- Weak HTTP methods
- Unencrypted endpoints
- Exposed sensitive data in URLs
- Missing rate limiting

### 3. **Detectors** (`detectors.rs`)

Pattern-based detection engines:

```rust
pub trait Detector {
    fn detect(&self, content: &str) -> Vec<Finding>;
}

pub struct PiiDetector;
impl Detector for PiiDetector {
    fn detect(&self, content: &str) -> Vec<Finding> {
        // Detect emails, SSNs, credit cards, etc.
    }
}
```

**Types of Detectors:**
- **PII Detector**: Finds sensitive personal information
- **Credential Detector**: Identifies exposed API keys
- **Pattern Detector**: Custom regex-based patterns

### 4. **Data Structures** (`data.rs`)

Type-safe data models:

```rust
#[derive(Serialize, Deserialize, Debug)]
pub struct ApiEndpoint {
    pub path: String,
    pub method: HttpMethod,
    pub security: SecurityRequirements,
    pub parameters: Vec<Parameter>,
    pub responses: HashMap<String, Response>,
}

#[derive(Serialize, Deserialize)]
pub struct AuditResult {
    pub spec: ApiSpec,
    pub vulnerabilities: Vec<Vulnerability>,
    pub pii_findings: Vec<PiiFinding>,
    pub timestamp: DateTime<Utc>,
}
```

### 5. **Database** (`db.rs`)

SQLite operations for persistence:

```rust
pub struct Database {
    conn: Connection,
}

impl Database {
    pub fn new(path: &str) -> Result<Self> {
        // Initialize SQLite database
    }

    pub fn save_audit(&self, result: &AuditResult) -> Result<u32> {
        // Store audit results
    }

    pub fn load_audits(&self) -> Result<Vec<AuditResult>> {
        // Retrieve historical audits
    }
}
```

**Tables:**
- `audits` - Audit results
- `vulnerabilities` - Detected issues
- `pii_findings` - PII detections
- `endpoints` - Analyzed endpoints

### 6. **AI Integration** (`ai.rs`)

External AI model integration:

```rust
pub struct AiAnalyzer {
    api_key: String,
    model: String,
}

impl AiAnalyzer {
    pub async fn analyze(&self, endpoint: &ApiEndpoint) -> Result<Analysis> {
        // Send to AI API
        // Get vulnerability suggestions
        // Return enhanced analysis
    }
}
```

---

## 🔌 IPC Communication (Tauri Bridge)

### Frontend → Backend

```typescript
// React component
import { invoke } from '@tauri-apps/api/tauri';

const handleAnalyze = async (specFile: string) => {
  const result = await invoke('analyze_spec', { spec_file: specFile });
};
```

### Backend → Frontend

```rust
// main.rs Tauri command
#[tauri::command]
pub async fn analyze_spec(spec_file: String) -> Result<AuditResult, String> {
    let spec = parser::parse_openapi(&spec_file)?;
    let vulnerabilities = scanner::scan(&spec)?;
    Ok(AuditResult { spec, vulnerabilities })
}
```

---

## 💾 Database Schema

### `audits` Table

```sql
CREATE TABLE audits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    spec_file TEXT,
    result JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### `vulnerabilities` Table

```sql
CREATE TABLE vulnerabilities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    audit_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    severity TEXT NOT NULL,
    endpoint TEXT,
    FOREIGN KEY(audit_id) REFERENCES audits(id)
);
```

---

## 🔄 Data Flow Example: Analyzing an OpenAPI Spec

```
1. User selects OpenAPI file
   ↓
2. Frontend: invoke('analyze_spec', { spec_file })
   ↓
3. Backend (main.rs): Parse IPC command
   ↓
4. openapi_parser.rs: Parse JSON/YAML spec
   ↓
5. scanner.rs: Scan for vulnerabilities
   ↓
6. detectors.rs: Run pattern detections
   ↓
7. ai.rs: (Optional) Enhance with AI analysis
   ↓
8. db.rs: Save results to SQLite
   ↓
9. Return AuditResult to Frontend
   ↓
10. Frontend: Display results in Inspector component
```

---

## 🔐 Security Considerations

### Frontend Security
- Input validation before sending to backend
- Sanitize displayed content
- Secure IPC communication via Tauri

### Backend Security
- Validate all IPC inputs
- Sanitize file paths (prevent directory traversal)
- Use prepared statements for SQL (prevent injection)
- Limit database file access permissions

### Data Protection
- No sensitive data stored in logs
- Audit results encrypted in database (optional)
- Secure credential storage for AI API keys

---

## 📈 Performance Optimization

### Frontend
- Code splitting with Vite
- Lazy loading components
- Memoization with React.memo
- Virtual scrolling for large lists

### Backend
- Parallel scanning with Rayon
- Streaming for large files
- Cache parsed specs
- Connection pooling for database

---

## 🧪 Testing Architecture

### Frontend Tests
- **Jest** for unit tests
- **React Testing Library** for component tests
- Mock Tauri IPC calls

### Backend Tests
- **Cargo test** for unit tests
- **Integration tests** for module interaction
- Mock database for testing

---

## 🚀 Build & Distribution

### Development Build
```bash
npm run dev          # Frontend dev server
npm run tauri dev    # Tauri dev app
```

### Production Build
```bash
npm run tauri build  # Creates optimized binary
```

### Bundle Output
- Windows: `.msi` installer
- macOS: `.dmg` installer
- Linux: `.AppImage` binary

---

## 📚 Architecture Patterns Used

| Pattern | Usage |
|---------|-------|
| **IPC Pattern** | Frontend-Backend communication |
| **Module Pattern** | Organize Rust code by concern |
| **Factory Pattern** | Create detector instances |
| **Strategy Pattern** | Different detection strategies |
| **Observer Pattern** | React hooks for state updates |

---

## 🔗 External Dependencies

### Frontend
- **React** - UI framework
- **Tauri** - Desktop framework
- **TypeScript** - Type safety

### Backend
- **Tauri** - Desktop framework
- **Serde** - JSON serialization
- **SQLite** - Database
- **Tokio** - Async runtime

---

## 📖 Related Documentation

- [Installation Guide](./INSTALLATION.md)
- [Features Guide](./FEATURES.md)
- [Contributing Guide](../CONTRIBUTING.md)

---

## 🎓 Learning Resources

- [Tauri Architecture](https://tauri.app/docs/architecture/)
- [React Patterns](https://react.dev/learn)
- [Rust Design Patterns](https://rust-lang.github.io/api-guidelines/)
- [SQLite Documentation](https://www.sqlite.org/docs.html)
