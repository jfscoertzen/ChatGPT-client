# Native Linux Feature Plan for the ChatGPT Electron Client

## Objective

Enhance this Electron wrapper into a polished native Linux desktop application while continuing to load the official ChatGPT website inside Electron.

The implementation must preserve current functionality, keep secure Electron defaults, maintain AppImage and Debian builds, avoid storing ChatGPT credentials or conversation data outside Electron's isolated session storage, and use test-driven development wherever practical.

## Current Repository Baseline

The repository currently contains a compact Electron application:

- `main.js` creates the main `BrowserWindow`, loads `https://chatgpt.com`, handles external windows, refresh shortcuts, context menu paste, and Linux primary-selection paste.
- `preload.js` contains limited middle-click paste support through a narrow IPC call.
- `package.json` defines Linux AppImage and Debian packaging through `electron-builder`.
- `scripts/generate-release-notes.js` generates release notes from a configured git hash.
- `scripts/before-build.js` lets `electron-builder` skip runtime dependency collection for this wrapper.

Existing behavior must be protected with baseline tests before refactoring.

## Guiding Constraints

- Do not rebuild or clone the ChatGPT website UI.
- Prefer native Electron APIs over DOM manipulation.
- Remove permanent injected UI controls when native menu and shortcuts cover the use case.
- Keep `nodeIntegration: false`.
- Keep `contextIsolation: true`.
- Keep renderer sandboxing enabled where technically possible.
- Expose only narrow, explicit preload APIs to trusted local pages.
- Never expose unrestricted Node.js APIs to remote ChatGPT content.
- Do not log or export credentials, cookies, tokens, conversation content, uploaded files, downloaded files, or sensitive URLs.
- Do not make CI depend on a real ChatGPT account or the live ChatGPT website.

## Target Structure

Use this structure unless implementation details justify small deviations:

```text
src/
  main/
    app.js
    window-manager.js
    tray-manager.js
    shortcut-manager.js
    settings-manager.js
    navigation-policy.js
    permission-manager.js
    notification-manager.js
    download-manager.js
    diagnostics-manager.js
    menu-manager.js
    profile-manager.js
    window-state-manager.js
    offline-manager.js
    health-manager.js
    launch-at-login-manager.js
    logger.js
  preload/
    chatgpt.js
    settings.js
    offline.js
  renderer/
    offline.html
    offline.js
    settings.html
    settings.js
tests/
  unit/
  integration/
  e2e/
```

`main.js` should become a thin entry point that delegates to `src/main/app.js`.

## Implementation Phases

### Phase 1: Tooling and Baseline Tests

Status: Complete.

Add the test and quality stack before broad refactoring.

Tasks:

- Add Vitest for unit and integration tests.
- Add Playwright for Electron smoke tests if supported in the environment.
- Add ESLint and Prettier.
- Add package scripts:
  - `lint`
  - `format`
  - `format:check`
  - `test`
  - `test:watch`
  - `test:integration`
  - `test:e2e`
  - `test:all`
  - `build`
  - `verify`
- Add baseline tests that assert:
  - The window is created with secure web preferences.
  - The default URL is ChatGPT.
  - External windows are opened in the system browser.
  - F5 and reload behavior are preserved.
  - The narrow preload paste IPC remains bounded.

Validation:

```bash
npm run lint
npm run format:check
npm run test
npm run build:linux
```

Implementation tracking:

- [x] Add Vitest.
- [x] Add Playwright test runner.
- [x] Add ESLint.
- [x] Add Prettier.
- [x] Add package scripts for linting, formatting, unit tests, integration tests, E2E smoke tests, and verification.
- [x] Add baseline unit tests for secure window preferences, default ChatGPT URL, external popup handling, F5 reload, context menu paste roles, and primary-selection paste IPC bounds.
- [x] Add baseline preload tests for editable-target detection and middle-click paste IPC gating.
- [x] Add mocked integration startup test for secure main-window creation.
- [x] Add skipped Playwright smoke test placeholder for desktop-capable environments.
- [x] Run and pass `npm run lint`.
- [x] Run and pass `npm run format:check`.
- [x] Run and pass `npm run test`.
- [x] Run and pass `npm run test:integration`.
- [x] Run and pass `npm run test:e2e` with GUI smoke test skipped unless `RUN_E2E=1`.
- [x] Run and pass `npm run build:linux`.

### Phase 2: Refactor Into Modules

Move behavior out of `main.js` while keeping behavior unchanged.

Tasks:

- Introduce `src/main/app.js` as the startup coordinator.
- Move BrowserWindow creation to `window-manager.js`.
- Move URL/opening rules to `navigation-policy.js`.
- Move local shortcuts to `shortcut-manager.js`.
- Move context menu behavior to `menu-manager.js` or a dedicated context menu helper.
- Move primary-selection paste handling to a small IPC module.
- Move preload files under `src/preload/`.
- Update `electron-builder` file includes.
- Keep compatibility entry files only where needed.

Tests:

- Unit tests for pure modules.
- Integration tests with mocked Electron APIs for manager wiring.
- A startup smoke test that does not require ChatGPT login.

### Phase 3: Settings Management

Implement a safe JSON settings manager in Electron's user-data directory.

Default settings:

```json
{
  "chatgptUrl": "https://chatgpt.com",
  "closeToTray": true,
  "startMinimized": false,
  "launchAtLogin": false,
  "enableNotifications": true,
  "globalShortcut": "Ctrl+Alt+Space",
  "zoomFactor": 1,
  "profile": "default"
}
```

Tasks:

- Validate loaded values.
- Merge missing values with defaults.
- Recover from malformed JSON by preserving a backup and loading defaults.
- Write atomically using temp-file plus rename where possible.
- Reject unsafe URLs.
- Allow only HTTPS URLs by default.
- Provide reset-to-defaults.
- Add a local settings window from trusted files only.
- Expose a narrow preload API for settings operations.

Tests:

- Defaults load when no file exists.
- Valid settings load.
- Missing fields receive defaults.
- Invalid values are rejected.
- Malformed JSON recovers safely.
- Settings are written correctly.
- Unsafe URLs are rejected.

### Phase 4: Navigation Security Policy

Create a central policy used by both `setWindowOpenHandler` and `will-navigate`.

Tasks:

- Keep trusted ChatGPT and required OpenAI authentication pages in-app.
- Open normal external HTTPS links in the system browser.
- Block `javascript:`, `file:`, unsafe `data:`, and unknown schemes.
- Sanitize logged URLs by removing sensitive query parameters.
- Validate redirect destinations.
- Prevent arbitrary in-window navigation to untrusted sites.

Tests:

- Trusted ChatGPT URLs are allowed.
- OpenAI authentication URLs are allowed.
- External HTTPS links open externally.
- Unsafe schemes are blocked.
- Sensitive parameters are redacted.

### Phase 5: Window State Persistence

Remember and restore window bounds and visual state.

Tasks:

- Persist width, height, x, y, maximized, fullscreen, and zoom factor.
- Debounce write operations.
- Validate against available displays.
- Fall back to primary display when a monitor disappeared.
- Prevent fully off-screen restores.
- Clamp zoom factor to a safe range.
- Define sensible minimum dimensions.

Tests:

- Valid bounds restore.
- Off-screen bounds are corrected.
- Disconnected monitor falls back to primary display.
- Invalid dimensions use defaults.
- Zoom factor is clamped.

### Phase 6: System Tray

Add Linux system tray support with graceful degradation.

Tray menu:

- Open ChatGPT
- New chat
- Reload
- Settings
- Quit

Tasks:

- Clicking the tray icon opens or focuses the main window.
- Closing the window hides to tray when `closeToTray` is enabled.
- Explicit Quit fully terminates the app.
- Respect `startMinimized`.
- Degrade gracefully when tray is unavailable.

Tests:

- Tray initializes without crashing.
- Close-to-tray hides the window.
- Explicit Quit exits.

### Phase 7: Shortcuts

Add configurable global and local application shortcuts.

Default global shortcut:

```text
Ctrl+Alt+Space
```

Local shortcuts:

| Shortcut         | Action                  |
| ---------------- | ----------------------- |
| `Ctrl+Shift+N`   | Open a new ChatGPT chat |
| `Ctrl+R` or `F5` | Reload                  |
| `Ctrl+Shift+R`   | Force reload            |
| `Ctrl++`         | Zoom in                 |
| `Ctrl+-`         | Zoom out                |
| `Ctrl+0`         | Reset zoom              |

Tasks:

- Toggle window visibility/focus from the global shortcut.
- Warn without crashing when shortcut registration fails.
- Unregister shortcuts on exit.
- Avoid overriding normal website shortcuts unnecessarily.

Tests:

- Registration success.
- Registration failure logs a warning and does not crash.
- Shortcuts unregister on exit.
- Local shortcut actions call the expected window methods.

### Phase 8: Native Menus

Add an Electron application menu.

Menus:

- File: New Chat, Settings, Quit
- View: Reload, Force Reload, Zoom In, Zoom Out, Actual Size, Toggle Fullscreen
- Window: Minimize, Show/Hide
- Help: Open Project Repository, Export Diagnostics, About

Tasks:

- Add menu wiring through a `menu-manager`.
- Developer tools are only available in development builds or with an explicit development flag.
- Remove the injected refresh button after native reload controls are available.

Tests:

- Menu template contains expected actions.
- DevTools menu is gated.
- Menu actions call the expected handlers.

### Phase 9: Offline and Loading Error Page

Add a local native-looking offline page for main-frame network failures.

Tasks:

- Detect main-frame failures only.
- Show local `offline.html`.
- Include error message, retry, open in browser, configured URL without sensitive query parameters, technical details, and reconnecting indicator.
- Implement bounded exponential backoff.
- Stop retrying after a reasonable limit.
- Reset retry state after successful load.
- Avoid reload loops.

Tests:

- Main-frame failures show offline page.
- Subresource failures do not replace the page.
- Retry delays increase and cap.
- Retry state resets after success.
- Retry loop stops at limit.

### Phase 10: Permission Management

Add explicit permission handling.

Permissions:

- Microphone
- Camera
- Notifications
- Clipboard access
- Screen capture or display media
- Geolocation
- MIDI
- USB
- Serial

Tasks:

- Deny unsupported permissions.
- Allow or prompt only supported ChatGPT features on trusted origins.
- Never grant sensitive permissions to arbitrary external domains.
- Store remembered decisions only when appropriate.
- Add settings action to clear remembered permissions.

Tests:

- Trusted microphone requests follow policy.
- Untrusted origins are denied.
- Unsupported permissions are denied.
- Stored decisions can be cleared.

### Phase 11: Download Management

Use Electron session download APIs.

Tasks:

- Track active downloads.
- Show progress in a local UI or notification-safe surface.
- Ask where to save or use a configurable download directory.
- Notify on completion.
- Allow opening the file or containing folder.
- Handle interrupted and cancelled downloads.
- Sanitize filenames.
- Prevent overwrite unless approved.
- Never automatically execute downloads.

Tests:

- Download state transitions.
- Completion notification fires once.
- Cancelled downloads are handled.
- Interrupted downloads are reported.
- Unsafe filenames are sanitized.

### Phase 12: Notifications

Add optional Linux notifications.

Tasks:

- Notify when ChatGPT becomes ready after reconnecting.
- Notify when a download completes.
- Notify when a long-running response completes only if reliable detection is possible.
- Do not include conversation text.
- Restore and focus app on notification click.
- Prevent duplicate notifications.
- If response-completion detection requires fragile DOM selectors, do not implement it; document the limitation.

Tests:

- Notifications respect settings.
- Reconnection notification sends once.
- Download notification sends once.
- Notification click focuses the window.

### Phase 13: Launch at Login

Add optional launch-at-login support.

Tasks:

- Prefer Electron login-item APIs where reliable.
- Use XDG autostart on Linux if required.
- Remove autostart entry when disabled.
- Support `startMinimized`.
- Do not require root.
- Document desktop-environment limitations.

Tests:

- Autostart entry is written and removed.
- Entry uses safe paths.
- Start-minimized flag is included when configured.

### Phase 14: Isolated Profiles

Support isolated profiles through persistent session partitions.

Examples:

```bash
chatgpt-linux --profile personal
chatgpt-linux --profile work
```

Tasks:

- Sanitize and validate profile names.
- Prevent path traversal.
- Use `persist:` session partitions.
- Default to `default`.
- Store profile-specific settings where appropriate.
- Add profile selector in tray or settings.
- Recreate or restart window when switching profiles.
- Never share authentication cookies between profiles.

Tests:

- Default profile generation.
- Valid names are accepted.
- Path traversal is rejected.
- Invalid characters are sanitized or rejected.
- Different profiles produce different partitions.

### Phase 15: Privacy Controls

Add destructive settings actions with confirmation.

Actions:

- Clear cache.
- Clear cookies.
- Clear storage data.
- Clear remembered permissions.
- Sign out and clear local session data.
- Reset application settings.

Tasks:

- Limit deletion to relevant Electron session data.
- Do not delete unrelated user-data files.
- Confirm before destructive operations.

Tests:

- Each action calls only the expected Electron APIs.
- Confirmation is required.
- Unrelated user-data paths are not removed.

### Phase 16: Health Monitoring and Recovery

Handle process and page failures.

Events:

- `did-fail-load`
- `render-process-gone`
- `unresponsive`
- `responsive`
- `child-process-gone`

Tasks:

- Offer Wait, Reload, Restart Window, Restart in Safe Mode.
- Support `--safe-mode` to disable GPU acceleration at startup.
- Sanitize logged failure details.

Tests:

- Failure events are logged safely.
- Recovery actions call the right handlers.
- Safe mode disables GPU acceleration before app ready.

### Phase 17: Diagnostics Export

Add `Help -> Export Diagnostics`.

Include:

- App version.
- Electron, Chromium, and Node versions.
- Linux distribution where available.
- Architecture.
- Desktop environment.
- X11 or Wayland session.
- Relevant command-line flags.
- GPU acceleration status.
- Sanitized logs.
- Sanitized settings.

Exclude:

- Cookies.
- Authentication tokens.
- Chat content.
- Uploaded documents.
- Downloaded files.
- Full sensitive URLs.
- Browser local storage.
- Personally identifying environment variables.

Tests:

- Tokens are redacted.
- Cookies are excluded.
- Sensitive query parameters are removed.
- Allowed environment information remains.
- Conversation-like content is not exported.

### Phase 18: Packaging and Release Workflow

Preserve existing AppImage and Debian builds.

Status: Partially complete. Flatpak release packaging has been added ahead of this phase because it was requested separately.

Tasks:

- Add SHA-256 checksum files for artifacts.
- Run tests before publishing release artifacts.
- Add build validation before publishing.
- Add ARM64 build when dependencies support it.
- Add RPM package if feasible without destabilizing current builds.
- Add Flatpak build and release upload.
- Report package formats that cannot be added.
- Keep release notes generation.

Implementation tracking:

- [x] Preserve AppImage build.
- [x] Preserve Debian build.
- [x] Add `npm run build:flatpak`.
- [x] Configure `electron-builder` Flatpak output with Freedesktop Platform, Freedesktop SDK, and Electron BaseApp `24.08`.
- [x] Install Flatpak tooling and runtimes in the GitHub release workflow.
- [x] Attach generated `.flatpak` bundles to GitHub releases.
- [ ] Validate Flatpak build locally or in CI.
- [ ] Add release artifact checksum generation.
- [ ] Add ARM64 build where dependencies support it.
- [ ] Add RPM if feasible.

Tests and validation:

```bash
npm run verify
sha256sum dist/*
```

CI must fail before release publication if tests or packaging fail.

### Phase 19: Documentation

Update `README.md` with:

- Project description.
- Unofficial-client disclaimer.
- Screenshots placeholder.
- Feature list.
- Installation instructions.
- AppImage instructions.
- Debian package instructions.
- RPM instructions if added.
- Supported CPU architectures.
- Tested Linux distributions.
- Wayland and X11 notes.
- Tray limitations.
- Global shortcut configuration.
- Profile usage.
- Proxy and VPN notes.
- Privacy and security model.
- Troubleshooting.
- Safe-mode instructions.
- Diagnostics export instructions.
- Development setup.
- Test commands.
- Build commands.
- Release process.
- Uninstall instructions.

Add `CONTRIBUTING.md` with:

- Development setup.
- Branch and pull-request expectations.
- Test requirements.
- Formatting rules.
- Security issue reporting guidance.

Add `SECURITY.md` covering:

- Remote content isolation.
- Navigation policy.
- Permission handling.
- Local settings storage.
- Profile isolation.
- Data the application does not collect.

## Required Test Matrix

### Unit Tests

- Settings defaults, validation, malformed JSON recovery, atomic writes, and unsafe URL rejection.
- Navigation policy allowed, external, blocked, and redacted URL cases.
- Window state validation, off-screen correction, monitor fallback, dimensions, and zoom clamping.
- Profile validation and partition generation.
- Permission decisions for trusted, untrusted, and unsupported cases.
- Offline retry and backoff behavior.
- Diagnostics redaction.
- Download state handling and filename sanitization.

### Integration Tests

- App starts successfully.
- Main window is created.
- Secure web preferences are used.
- Tray manager initializes without crashing.
- Global shortcut registration failure does not crash.
- Settings window uses local content only.
- External navigation opens in the system browser.
- Simulated load failure displays local offline page.
- Closing window hides it when close-to-tray is enabled.
- Explicit Quit terminates the app.

### End-to-End Smoke Tests

- Start packaged or development Electron app.
- Verify the main window appears.
- Verify offline page can be loaded without internet.
- Verify settings can be opened and saved.
- Verify clean shutdown.
- Verify no uncaught exceptions are written to test output.

E2E tests must not require ChatGPT login, real credentials, or live ChatGPT availability.

## Proposed Scripts

Adjust exact commands as tooling is installed:

```json
{
  "scripts": {
    "start": "electron .",
    "dev": "electron . --dev",
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:integration": "vitest run tests/integration",
    "test:e2e": "playwright test",
    "test:all": "npm run lint && npm run format:check && npm run test && npm run test:integration && npm run test:e2e",
    "build": "electron-builder",
    "build:linux": "electron-builder --linux --publish never",
    "verify": "npm run test:all && npm run build:linux"
  }
}
```

## Final Validation Checklist

Before considering the implementation complete:

- Application starts successfully.
- Existing ChatGPT loading behavior remains operational.
- Native Linux features are implemented.
- Navigation and permissions are explicitly controlled.
- Unit tests pass.
- Integration tests pass.
- Supported E2E smoke tests pass.
- AppImage build succeeds.
- Debian build succeeds.
- Release artifacts include checksums.
- Documentation is updated.
- No real credentials are used in tests.
- CI does not require ChatGPT login.
- Incomplete or environment-dependent behavior is documented.

## Final Report Template

After implementation, report with these sections:

```text
## Summary
## Architecture
## Security
## Tests Added
## Test Results
## Build Artifacts
## Files Changed
## Known Limitations
## Recommended Next Steps
```

Test results must include exact executed commands and real outcomes. Do not claim a command passed unless it was executed successfully.
