# Contributing

Thanks for helping improve the ChatGPT Linux desktop client. Keep changes focused on native Electron integration while continuing to load the official ChatGPT website.

## Development Setup

Install Node.js and npm, then install dependencies:

```bash
npm install
```

Run the app:

```bash
npm start
```

Run development mode:

```bash
npm run dev
```

## Branch And Pull Requests

- Use feature branches off `development`.
- Keep pull requests focused on one feature or fix.
- Include tests for behavior changes where practical.
- Do not include generated `dist/`, `.flatpak-builder`, coverage, or test-output files.
- Do not commit credentials, cookies, exported diagnostics containing private data, or local user-data directories.
- Describe user-visible changes and any Linux desktop limitations in the pull request.

## Test Requirements

Run the relevant checks before opening a pull request:

```bash
npm run lint
npm run format:check
npm run test
npm run test:integration
npm run test:e2e
```

For broader changes, run:

```bash
npm run test:all
npm run build:linux
```

Packaging changes should also run the affected package builds:

```bash
npm run build:linux:x64
npm run build:linux:arm64
npm run build:rpm:x64
npm run build:rpm:arm64
npm run build:flatpak
npm run checksums
```

Do not claim a test passed unless it was executed successfully. Document any command that cannot run in the available environment.

## Formatting Rules

- Use the existing JavaScript style.
- Run `npm run format` or `npm run format:check`.
- Keep comments short and useful.
- Avoid broad catch blocks that silently ignore errors.
- Log actionable errors without logging secrets.
- Keep Electron preload APIs narrow and explicit.
- Keep `nodeIntegration` disabled for remote content.
- Keep `contextIsolation` enabled.
- Keep renderer sandboxing enabled where technically possible.

## Security Issue Reporting

Do not open a public issue with secrets, cookies, tokens, private diagnostics, or account data.

For security-sensitive reports, contact the maintainer privately first. Include:

- A concise description of the issue.
- Steps to reproduce without real credentials.
- Affected version or commit.
- Whether the issue can expose cookies, tokens, conversation content, local files, or unrestricted Node.js access.

Security fixes should include tests where practical and should avoid logging sensitive values.
