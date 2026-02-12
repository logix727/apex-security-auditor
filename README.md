# 🛡️ Apex Security Auditor

[![GitHub License](https://img.shields.io/github/license/logix727/apex-security-auditor?style=flat-square)](LICENSE)
[![GitHub Release](https://img.shields.io/github/v/release/logix727/apex-security-auditor?style=flat-square&logo=github)](https://github.com/logix727/apex-security-auditor/releases)
[![Build Status](https://img.shields.io/github/actions/workflow/status/logix727/apex-security-auditor/ci.yml?style=flat-square&logo=github)](https://github.com/logix727/apex-security-auditor/actions)
[![Tauri](https://img.shields.io/badge/Built%20with-Tauri-24C8DB?style=flat-square&logo=tauri)](https://tauri.app)
[![Rust](https://img.shields.io/badge/Backend-Rust-CE422B?style=flat-square&logo=rust)](https://www.rust-lang.org/)
[![React](https://img.shields.io/badge/Frontend-React-61DAFB?style=flat-square&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)

> **Advanced API Security Analysis and Vulnerability Detection Desktop Application**

Apex Security Auditor is a comprehensive desktop application for analyzing API security configurations, detecting PII (Personally Identifiable Information), and auditing OpenAPI/REST endpoints for potential vulnerabilities and compliance issues.

---

## ✨ Key Features

- 🔍 **OpenAPI Parser** - Comprehensive analysis of OpenAPI 3.0+ specifications
- 🎯 **PII Detection** - Advanced detection of sensitive data patterns (emails, SSNs, credit cards, etc.)
- 🔐 **Security Scanning** - Identify common security misconfigurations and vulnerabilities
- 📊 **Interactive Inspector** - Visual analysis of API endpoints and security properties
- 🗄️ **Local Database** - SQLite backend for storing audit results
- 🤖 **AI-Powered Analysis** - Integration with AI models for intelligent vulnerability detection
- 💻 **Cross-Platform** - Works on Windows, macOS, and Linux

---

## 🚀 Quick Start

### Prerequisites

- **Rust** 1.70+ ([Install](https://rustup.rs/))
- **Node.js** 18+ ([Install](https://nodejs.org/))
- **npm** or **pnpm** for package management

### Installation

```bash
# Clone the repository
git clone https://github.com/logix727/apex-security-auditor.git
cd apex-security-auditor

# Install dependencies
npm install

# Install Rust dependencies (from src-tauri directory)
cd src-tauri
cargo build
cd ..
```

### Development

```bash
# Start development server
npm run dev

# In another terminal, run Tauri dev
npm run tauri dev
```

### Build

```bash
# Build for production
npm run tauri build
```

For detailed setup instructions, see [INSTALLATION.md](./docs/INSTALLATION.md)

---

## 📁 Project Structure

```
apex-security-auditor/
├── src/                          # React/TypeScript frontend
│   ├── components/               # React components
│   │   ├── DebugConsole.tsx     # Debug output interface
│   │   ├── Inspector.tsx         # API endpoint inspector
│   │   └── PIIMasker.tsx         # PII detection and masking
│   ├── App.tsx                   # Main application component
│   ├── main.tsx                  # React entry point
│   └── vite-env.d.ts             # Vite environment variables
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── main.rs               # Tauri app entry point
│   │   ├── ai.rs                 # AI integration module
│   │   ├── data.rs               # Data structures
│   │   ├── db.rs                 # Database operations
│   │   ├── detectors.rs          # Vulnerability detectors
│   │   ├── openapi_parser.rs     # OpenAPI parsing logic
│   │   ├── scanner.rs            # Security scanning engine
│   │   └── ui/                   # UI integration modules
│   ├── Cargo.toml                # Rust dependencies
│   └── tauri.conf.json           # Tauri configuration
├── docs/                         # Documentation
├── package.json                  # Frontend dependencies
├── vite.config.ts                # Vite configuration
└── README.md                     # This file
```

---

## 🔧 Technologies Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **CSS3** - Styling

### Backend
- **Rust** - Performance and safety
- **Tauri** - Desktop application framework
- **SQLite** - Local database
- **serde** - Serialization

### Development Tools
- **HMR (Hot Module Reload)** - Fast development experience
- **Cargo** - Rust package manager
- **npm** - Node package manager

---

## 📖 Documentation

- **[Installation Guide](./docs/INSTALLATION.md)** - Detailed setup and deployment instructions
- **[Architecture Guide](./docs/ARCHITECTURE.md)** - System design and component overview
- **[Features Guide](./docs/FEATURES.md)** - Detailed feature documentation
- **[Contributing Guide](./CONTRIBUTING.md)** - How to contribute to the project

---

## 🔍 Usage Examples

### Analyzing an OpenAPI Specification

1. Open Apex Security Auditor
2. Load an OpenAPI JSON/YAML file
3. Review detected vulnerabilities in the Inspector panel
4. Export results for compliance reporting

### Detecting PII in API Responses

1. Configure sensitive data patterns
2. Run PII detection scanner
3. View masked results in PIIMasker component
4. Generate audit reports

---

## 🐛 Known Issues & Limitations

- Large OpenAPI specs (>50MB) may take longer to parse
- Some database operations require write permissions
- AI analysis requires API credentials

See [Issues](https://github.com/logix727/apex-security-auditor/issues) for reported bugs and feature requests.

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for:
- Code of conduct
- Development setup
- Commit message guidelines
- Pull request process

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

---

## 🎓 Resources

- [Tauri Documentation](https://tauri.app/docs)
- [React Documentation](https://react.dev)
- [Rust Book](https://doc.rust-lang.org/book/)
- [OpenAPI 3.0 Specification](https://spec.openapis.org/oas/v3.0.3)

---

## 📞 Support & Contact

- 📧 Email: [your-email@example.com]
- 💬 GitHub Discussions: [Link to discussions]
- 🐛 Bug Reports: [GitHub Issues](https://github.com/logix727/apex-security-auditor/issues)

---

## 🔄 Latest Updates

**v0.1.0** - Initial release with core features:
- OpenAPI parsing and analysis
- PII detection engine
- Security scanning
- Database integration
- Interactive UI components

---

<div align="center">

**[⬆ back to top](#-apex-security-auditor)**

Made with ❤️ by the Apex Security team

</div>
