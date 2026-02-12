# Installation Guide

## 📋 Prerequisites

Before you begin, ensure you have the following installed:

### Required
- **Rust 1.70+** - [Install Rust](https://rustup.rs/)
- **Node.js 18+** - [Download Node.js](https://nodejs.org/)
- **npm** (comes with Node.js) or **pnpm**

### Optional (Recommended)
- **Git** - [Download Git](https://git-scm.com/)
- **VS Code** - [Download VS Code](https://code.visualstudio.com/)
- **Tauri VS Code Extension** - [Install from marketplace](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)

---

## 🚀 Installation Steps

### 1. Clone the Repository

```bash
git clone https://github.com/logix727/apex-security-auditor.git
cd apex-security-auditor
```

### 2. Install Frontend Dependencies

```bash
npm install
```

This installs all Node.js dependencies including:
- React
- TypeScript
- Vite
- Other development tools

### 3. Build Rust Backend

```bash
cd src-tauri
cargo build
cd ..
```

This compiles the Rust backend and installs Rust dependencies including:
- Tauri
- Serde
- SQLite drivers
- Other Rust crates

### 4. Verify Installation

Check that everything is installed correctly:

```bash
# Check Node.js
node --version

# Check npm
npm --version

# Check Rust
rustc --version
cargo --version
```

---

## 🔧 Development Setup

### Start Development Server

```bash
# Terminal 1: Start frontend dev server
npm run dev
```

This starts the Vite development server with Hot Module Reload (HMR).

### In a New Terminal: Start Tauri App

```bash
# Terminal 2: Start Tauri development mode
npm run tauri dev
```

This launches the desktop application in development mode with debugging capabilities.

### Using VS Code (Recommended)

If using VS Code, you can use the configured tasks:

1. Press `Ctrl+Shift+B` to open VS Code tasks
2. Select `tauri:debug-prepare` to run both servers automatically
3. Or run individual tasks:
   - `ui:dev` - Frontend server
   - `rust:build` - Rust compilation
   - `tauri:dev` - Launch app

---

## 🛠️ Build for Production

### Build Release Binary

```bash
npm run tauri build
```

This creates optimized binaries for your platform:
- **Windows**: `.msi` installer in `src-tauri/target/release/bundle/msi/`
- **macOS**: `.dmg` installer in `src-tauri/target/release/bundle/dmg/`
- **Linux**: `.AppImage` in `src-tauri/target/release/bundle/appimage/`

### Configure Build Target

Edit `src-tauri/tauri.conf.json` to customize:
- App name and version
- Icons
- Bundle settings
- Window configuration

---

## 📁 Important Directories

| Directory | Purpose |
|-----------|---------|
| `src/` | React/TypeScript frontend source code |
| `src-tauri/` | Rust backend source code |
| `src-tauri/src/` | Main Rust modules |
| `public/` | Static assets |
| `docs/` | Documentation |

---

## 🆘 Troubleshooting

### Issue: Rust Compilation Errors

**Solution**: Update Rust toolchain
```bash
rustup update
```

### Issue: Node Module Conflicts

**Solution**: Clear cache and reinstall
```bash
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### Issue: Port Already in Use (Dev Server)

**Solution**: Change Vite port in `vite.config.ts`:
```typescript
export default defineConfig({
  server: {
    port: 5174 // Change from 5173
  }
})
```

### Issue: "tauri command not found"

**Solution**: Install Tauri CLI globally
```bash
npm install -g @tauri-apps/cli
```

### Issue: SQLite Database Errors

**Solution**: Ensure write permissions in the project directory. On Linux/macOS:
```bash
chmod -R u+w .
```

---

## 📦 Environment Variables

Create a `.env` file in the root directory for development settings:

```env
# API Configuration
VITE_API_URL=http://localhost
VITE_DEBUG=true

# AI Integration (Optional)
OPENAI_API_KEY=your_key_here
```

For Rust backend, edit `src-tauri/.env`:

```env
DATABASE_PATH=./apex.db
LOG_LEVEL=debug
```

---

## 🔄 Updating Dependencies

### Update Node Dependencies

```bash
npm update
npm audit fix  # Fix security vulnerabilities
```

### Update Rust Dependencies

```bash
cd src-tauri
cargo update
cd ..
```

### Check for Outdated Packages

```bash
npm outdated  # Node packages
cargo outdated  # Rust packages
```

---

## 🧪 Running Tests

### Frontend Tests

```bash
npm run test
```

### Backend Tests

```bash
cd src-tauri
cargo test
cd ..
```

### Linting

```bash
npm run lint
cd src-tauri && cargo clippy && cd ..
```

---

## 📚 Next Steps

1. Read the [Architecture Guide](./ARCHITECTURE.md)
2. Check the [Features Guide](./FEATURES.md)
3. Start with the [Contributing Guide](../CONTRIBUTING.md)
4. Explore the codebase structure

---

## 🆘 Getting Help

- Check existing [GitHub Issues](https://github.com/logix727/apex-security-auditor/issues)
- Review [Tauri Docs](https://tauri.app/docs)
- Visit [React Documentation](https://react.dev)
- Consult [Rust Book](https://doc.rust-lang.org/book/)

---

## ✅ Installation Checklist

- [ ] Rust installed (1.70+)
- [ ] Node.js installed (18+)
- [ ] Repository cloned
- [ ] npm install completed
- [ ] cargo build completed
- [ ] Development servers started successfully
- [ ] Application loads in browser
- [ ] Tauri app window opens

If all items are checked, you're ready to start developing! 🎉
