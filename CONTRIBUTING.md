# Contributing to Apex Security Auditor

Thank you for your interest in contributing to Apex Security Auditor! We welcome contributions from the community and appreciate your help in making this project better.

## 📋 Code of Conduct

This project adheres to a code of conduct. By participating, you are expected to uphold this code. Please report unacceptable behavior to the project maintainers.

## 🔍 How to Contribute

### Reporting Bugs

Before creating a bug report, please check the [issue list](https://github.com/logix727/apex-security-auditor/issues) to see if the problem has already been reported.

When reporting a bug, include:
- **Title**: Clear, descriptive title
- **Description**: What you expected vs. what happened
- **Steps to reproduce**: Detailed steps to reproduce the issue
- **Environment**: OS, Rust version, Node version
- **Screenshots**: If applicable
- **Error logs**: Any relevant error messages

### Suggesting Enhancements

Feature requests are welcome! When suggesting an enhancement:
- Use a clear, descriptive title
- Provide a detailed description of the suggested feature
- List examples of how the feature would be used
- Explain why this enhancement would be useful

### Pull Requests

1. **Fork the repository** and create a new branch
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make your changes** following the style guidelines

3. **Test your changes**
   ```bash
   # Run frontend tests
   npm run test
   
   # Run backend tests
   cd src-tauri && cargo test && cd ..
   ```

4. **Commit with clear messages**
   ```bash
   git commit -m "feat: add my new feature"
   ```
   Use [Conventional Commits](https://www.conventionalcommits.org/)

5. **Push to your fork**
   ```bash
   git push origin feature/my-feature
   ```

6. **Open a Pull Request** with a clear description

---

## 📋 Commit Message Guidelines

Follow [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types:
- **feat**: A new feature
- **fix**: A bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, semicolons, etc.)
- **refactor**: Code refactoring
- **perf**: Performance improvements
- **test**: Adding or updating tests

### Example:
```
feat(scanner): add support for GraphQL API analysis

- Implement GraphQL schema parser
- Add vulnerability detection for GraphQL endpoints
- Update docs with GraphQL usage examples

Closes #123
```

---

## 🎯 Development Guidelines

### Frontend (React/TypeScript)

- Use **functional components** with hooks
- Follow **ESLint** rules configured in the project
- Keep components **small and focused**
- Use **TypeScript** for type safety
- Write **meaningful component names**

Example component structure:
```typescript
interface MyComponentProps {
  title: string;
  onAction?: () => void;
}

export const MyComponent: React.FC<MyComponentProps> = ({ title, onAction }) => {
  const [state, setState] = React.useState(false);

  return (
    <div>
      <h1>{title}</h1>
      {/* Component JSX */}
    </div>
  );
};
```

### Backend (Rust)

- Follow **Rust naming conventions**
- Use **cargo fmt** for formatting
- Run **cargo clippy** for linting
- Write **unit tests** for new functions
- Add **documentation comments** to public items

Example function:
```rust
/// Analyzes a vulnerability in an API endpoint
/// 
/// # Arguments
/// * `endpoint` - The API endpoint to analyze
/// 
/// # Returns
/// A vector of detected vulnerabilities
pub fn analyze_endpoint(endpoint: &ApiEndpoint) -> Vec<Vulnerability> {
    // Implementation
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_analyze_endpoint() {
        // Test implementation
    }
}
```

---

## 🧪 Testing

We use:
- **Jest** for frontend tests
- **Cargo Test** for Rust backend tests

Run tests:
```bash
# Frontend
npm run test

# Backend
cd src-tauri
cargo test
```

Always write tests for:
- New features
- Bug fixes
- Critical functionality

---

## 📚 Documentation

- Keep README.md up to date
- Add documentation for new features
- Update CHANGELOG.md with significant changes
- Include code examples where applicable

---

## 🚀 Development Setup

1. **Clone and install**
   ```bash
   git clone https://github.com/logix727/apex-security-auditor.git
   cd apex-security-auditor
   npm install
   cd src-tauri && cargo build && cd ..
   ```

2. **Start development servers**
   ```bash
   # Terminal 1
   npm run dev
   
   # Terminal 2
   npm run tauri dev
   ```

3. **For debugging**
   - Use VS Code debugger
   - Use browser DevTools (F12 in dev app)
   - Use `console.log()` and Rust `println!()` for logging

---

## 📦 Project Structure for Contributors

```
src/                    # React frontend
├── components/         # Reusable components
├── App.tsx            # Main app component
└── main.tsx           # Entry point

src-tauri/            # Rust backend
├── src/               # Rust source code
│   ├── main.rs        # App entry
│   ├── ai.rs          # AI features
│   ├── scanner.rs     # Scanning logic
│   └── db.rs          # Database
└── Cargo.toml         # Dependencies

docs/                 # Documentation files
```

---

## ✅ Checklist for Pull Requests

- [ ] Code follows style guidelines
- [ ] Changes have been tested
- [ ] New features have tests
- [ ] Documentation has been updated
- [ ] Commit messages follow conventions
- [ ] No breaking changes (document if any)
- [ ] Resolves one or more open issues

---

## 🎓 Additional Resources

- [Tauri Docs](https://tauri.app/docs)
- [React Docs](https://react.dev)
- [Rust Book](https://doc.rust-lang.org/book/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

## 📞 Questions?

Feel free to:
- Open a discussion on GitHub
- Ask in pull request comments
- Check existing issues for similar questions

Thank you for contributing! 🎉
