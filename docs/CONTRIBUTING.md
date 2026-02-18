# Contributing to Apex Security Auditor

Thank you for your interest in contributing to Apex Security Auditor! This guide will help you get started with development.

## Project Architecture

Apex Security Auditor is built using a modern stack:
- **Backend**: Rust (Tauri v2) for high performance and system integration.
- **Frontend**: React + TypeScript + Vite for a responsive and dynamic UI.
- **Database**: SQLite for local storage of scan results and assets.

### Directory Structure

- `src-tauri/`: Rust backend code.
  - `src/commands/`: Tauri commands exposed to frontend.
  - `src/db/`: Database schema and interactions.
  - `src/analysis/`: Security analysis logic.
- `src/`: React frontend code.
  - `components/`: Reusable UI components.
  - `types/`: TypeScript definitions.
  - `utils/`: Helper functions.
- `tests/`: End-to-end tests (Playwright).

## Development Setup

### Prerequisites

- **Node.js** (v18+)
- **Rust** (latest stable)
- **Tauri CLI**: `cargo install tauri-cli`

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/logix727/apex-security-auditor.git
   cd apex-security-auditor
   ```
2. Install dependencies:
   ```bash
   npm install
   ```

### Running Locally

To start the development server with hot-reload:
```bash
npm run tauri dev
```

## Testing

### Unit Tests
- Frontend: `npm test` (Vitest)
- Backend: `cargo test`

### End-to-End Tests
- Run E2E tests: `npm run test:e2e` (Playwright)

## Code Style

- **Frontend**: We use ESLint and Prettier. Run `npm run lint` to check for issues.
- **Backend**: We use `cargo fmt` and `clippy`. Ensure code is formatted before committing.

## Release Process

1. Bump version: `npm run release:bump`
2. Push changes.
3. GitHub Actions will automatically build and draft a release.
