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

Status: Complete.

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

Implementation tracking:

- [x] Introduce `src/main/app.js` as the startup coordinator.
- [x] Move BrowserWindow creation to `src/main/window-manager.js`.
- [x] Move new-window handling to `src/main/navigation-policy.js`.
- [x] Move local F5 handling to `src/main/shortcut-manager.js`.
- [x] Move context menu behavior to `src/main/menu-manager.js`.
- [x] Move primary-selection paste handling to `src/main/primary-selection-ipc.js`.
- [x] Move ChatGPT preload implementation to `src/preload/chatgpt.js`.
- [x] Keep root `main.js` and `preload.js` as compatibility entry points.
- [x] Update `electron-builder` file includes for `src/**/*`.
- [x] Add module-focused unit tests for navigation policy and shortcut manager.
- [x] Run and pass `npm run lint`.
- [x] Run and pass `npm run format:check`.
- [x] Run and pass `npm run test`.
- [x] Run and pass `npm run test:integration`.
- [x] Run and pass `npm run test:e2e`.
- [x] Run and pass `npm run build:linux`.

### Phase 3: Settings Management

Status: Complete.

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

Implementation tracking:

- [x] Add unit tests for default settings loading, valid loading, missing-field merges, invalid value rejection, malformed JSON recovery, atomic writes, and unsafe URL rejection.
- [x] Implement `src/main/settings-manager.js` with defaults, validation, malformed JSON backup, atomic writes, reset-to-defaults, and ChatGPT/OpenAI HTTPS URL validation.
- [x] Replace the hardcoded load URL path with the validated configured `chatgptUrl`.
- [x] Apply configured `zoomFactor` when the main window is created.
- [x] Add settings IPC handlers for get, save, and reset operations.
- [x] Add an isolated local settings preload API in `src/preload/settings.js`.
- [x] Add a trusted local settings window using `src/renderer/settings.html`, `settings.css`, and `settings.js`.
- [x] Run and pass `npm run lint`.
- [x] Run and pass `npm run format:check`.
- [x] Run and pass `npm run test`.
- [x] Run and pass `npm run test:integration`.
- [x] Run and pass `npm run test:e2e`.
- [x] Run and pass `npm run build:linux`.

### Phase 4: Navigation Security Policy

Status: Complete.

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

Implementation tracking:

- [x] Add unit tests for trusted ChatGPT navigation.
- [x] Add unit tests for required OpenAI authentication navigation.
- [x] Add unit tests for external HTTPS links opening in the system browser.
- [x] Add unit tests for blocking `javascript:`, `file:`, `data:`, invalid URLs, and unknown schemes.
- [x] Add unit tests for sensitive URL parameter redaction.
- [x] Implement central `decideNavigation` policy.
- [x] Implement sanitized blocked-navigation logging.
- [x] Register policy for `setWindowOpenHandler`.
- [x] Register policy for `will-navigate`.
- [x] Run and pass `npm run lint`.
- [x] Run and pass `npm run format:check`.
- [x] Run and pass `npm run test`.
- [x] Run and pass `npm run test:integration`.
- [x] Run and pass `npm run test:e2e`.
- [x] Run and pass `npm run build:linux`.

### Phase 5: Window State Persistence

Status: Complete.

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

Implementation tracking:

- [x] Add unit tests for valid bounds restore.
- [x] Add unit tests for off-screen bounds correction.
- [x] Add unit tests for disconnected-monitor fallback.
- [x] Add unit tests for invalid dimension defaults.
- [x] Add unit tests for zoom-factor clamping.
- [x] Implement `src/main/window-state-manager.js`.
- [x] Persist width, height, x, y, maximized state, fullscreen state, and zoom factor.
- [x] Debounce frequent window-state writes.
- [x] Validate restored positions against current displays.
- [x] Apply restored bounds during `BrowserWindow` creation.
- [x] Apply restored maximized/fullscreen/zoom state after window creation.
- [x] Run and pass `npm run lint`.
- [x] Run and pass `npm run format:check`.
- [x] Run and pass `npm run test`.
- [x] Run and pass `npm run test:integration`.
- [x] Run and pass `npm run test:e2e`.
- [x] Run and pass `npm run build:linux`.

### Phase 6: System Tray

Status: Complete.

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

Implementation tracking:

- [x] Add unit tests for tray menu actions.
- [x] Add unit tests for focusing hidden or minimized windows.
- [x] Add unit tests for tray initialization without crashing.
- [x] Add unit tests for graceful tray creation failure.
- [x] Add unit tests for close-to-tray behavior.
- [x] Add unit tests for explicit Quit bypassing close-to-tray.
- [x] Implement `src/main/tray-manager.js`.
- [x] Add tray menu entries for Open ChatGPT, New chat, Reload, Settings, and Quit.
- [x] Wire tray initialization into application startup.
- [x] Retain the Electron `Tray` object for the process lifetime so GNOME/AppIndicator environments keep showing the indicator.
- [x] Respect `closeToTray`.
- [x] Respect `startMinimized`.
- [x] Ensure explicit Quit calls `app.quit()`.
- [x] Run and pass `npm run lint`.
- [x] Run and pass `npm run format:check`.
- [x] Run and pass `npm run test`.
- [x] Run and pass `npm run test:integration`.
- [x] Run and pass `npm run test:e2e`.
- [x] Run and pass `npm run build:linux`.

### Phase 7: Shortcuts

Status: Complete.

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

Implementation tracking:

- [x] Add unit tests for global shortcut registration success.
- [x] Add unit tests for global shortcut registration failure logging.
- [x] Add unit tests for unregistering global shortcuts on app exit.
- [x] Add unit tests for global shortcut window toggle behavior.
- [x] Add unit tests for `Ctrl+Shift+N` new chat.
- [x] Add unit tests for `Ctrl+R` and `F5` reload.
- [x] Add unit tests for `Ctrl+Shift+R` force reload.
- [x] Add unit tests for zoom in, zoom out, and reset zoom.
- [x] Implement configurable global shortcut with default `Ctrl+Alt+Space`.
- [x] Wire global shortcut registration into app startup.
- [x] Implement local application shortcuts.
- [x] Preserve unrelated website key events.
- [x] Run and pass `npm run lint`.
- [x] Run and pass `npm run format:check`.
- [x] Run and pass `npm run test`.
- [x] Run and pass `npm run test:integration`.
- [x] Run and pass `npm run test:e2e`.
- [x] Run and pass `npm run build:linux`.

### Phase 8: Native Menus

Status: Complete.

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

Implementation tracking:

- [x] Add unit tests for top-level native menu structure.
- [x] Add unit tests for File, View, Window, and Help menu actions.
- [x] Add unit tests for developer-tools menu gating.
- [x] Add unit tests for application menu registration.
- [x] Implement native application menu wiring in `src/main/menu-manager.js`.
- [x] Add File menu actions for New Chat, Settings, and Quit.
- [x] Add View menu actions for Reload, Force Reload, Zoom In, Zoom Out, Actual Size, and Toggle Fullscreen.
- [x] Add Window menu actions for Minimize and Show/Hide.
- [x] Add Help menu entries for Open Project Repository, Export Diagnostics placeholder, and About.
- [x] Gate developer tools behind development/explicit enablement.
- [x] Register the native menu during application startup.
- [x] Remove the injected refresh button runtime hook and dead module.
- [x] Run and pass `npm run lint`.
- [x] Run and pass `npm run format:check`.
- [x] Run and pass `npm run test`.
- [x] Run and pass `npm run test:integration`.
- [x] Run and pass `npm run test:e2e`.
- [x] Run and pass `npm run build:linux`.

### Phase 9: Offline and Loading Error Page

Status: Complete.

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

Implementation tracking:

- [x] Add unit tests for main-frame network failure detection.
- [x] Add unit tests confirming subresource failures do not replace the page.
- [x] Add unit tests for retry delay growth and cap.
- [x] Add unit tests for retry limit stop behavior.
- [x] Add unit tests for retry reset after successful non-offline load.
- [x] Add unit tests confirming offline page loads do not reset retry state.
- [x] Implement `src/main/offline-manager.js`.
- [x] Add local offline preload API with retry and open-browser actions.
- [x] Add local native-looking offline page, stylesheet, and renderer script.
- [x] Wire main-frame `did-fail-load` handling into main window creation.
- [x] Register offline IPC handlers with local offline-page sender checks.
- [x] Show configured URL with sensitive query parameters redacted.
- [x] Implement bounded exponential backoff and retry cap.
- [x] Run and pass `npm run lint`.
- [x] Run and pass `npm run format:check`.
- [x] Run and pass `npm run test`.
- [x] Run and pass `npm run test:integration`.
- [x] Run and pass `npm run test:e2e`.
- [x] Run and pass `npm run build:linux`.

### Phase 10: Permission Management

Status: Complete.

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

Implementation tracking:

- [x] Add unit tests for trusted-origin microphone requests.
- [x] Add unit tests for trusted-origin camera requests.
- [x] Add unit tests for untrusted-origin denial.
- [x] Add unit tests for unsupported permission denial.
- [x] Add unit tests for notification setting behavior.
- [x] Add unit tests for clearing remembered decisions.
- [x] Implement `src/main/permission-manager.js`.
- [x] Register Electron permission request and permission check handlers on the main session.
- [x] Deny unsupported permissions including geolocation, MIDI, USB, and serial.
- [x] Restrict supported permissions to trusted ChatGPT/OpenAI origins.
- [x] Add settings IPC action to clear remembered permission decisions.
- [x] Add local settings UI action to clear remembered permissions.
- [x] Run and pass `npm run lint`.
- [x] Run and pass `npm run format:check`.
- [x] Run and pass `npm run test`.
- [x] Run and pass `npm run test:integration`.
- [x] Run and pass `npm run test:e2e`.
- [x] Run and pass `npm run build:linux`.

### Phase 11: Download Management

Status: Complete.

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

Implementation tracking:

- [x] Add unit tests for unsafe filename sanitization.
- [x] Add unit tests for download record creation with sanitized URLs.
- [x] Add unit tests for download state transitions.
- [x] Add unit tests for completion notification firing once.
- [x] Add unit tests for cancelled downloads.
- [x] Add unit tests for interrupted downloads.
- [x] Add unit tests for default sanitized save paths.
- [x] Implement `src/main/download-manager.js`.
- [x] Register Electron `will-download` handling on the main session.
- [x] Track active downloads in memory.
- [x] Set sanitized save paths in the user's downloads directory.
- [x] Do not automatically open or execute downloaded files.
- [x] Run and pass `npm run lint`.
- [x] Run and pass `npm run format:check`.
- [x] Run and pass `npm run test`.
- [x] Run and pass `npm run test:integration`.
- [x] Run and pass `npm run test:e2e`.
- [x] Run and pass `npm run build:linux`.

### Phase 12: Notifications

Status: Complete.

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

Implementation tracking:

- [x] Add unit tests for settings-controlled notification enablement.
- [x] Add unit tests for one-shot reconnection notifications.
- [x] Add unit tests for one-shot download completion notifications.
- [x] Add unit tests for notification click restoring/focusing the window.
- [x] Implement `src/main/notification-manager.js`.
- [x] Wire notification manager into download completion handling.
- [x] Wire notification manager into offline/reconnected handling.
- [x] Avoid conversation text in notification bodies.
- [x] Do not implement response-completion notifications because reliable detection would require fragile ChatGPT DOM selectors.
- [x] Run and pass `npm run lint`.
- [x] Run and pass `npm run format:check`.
- [x] Run and pass `npm run test`.
- [x] Run and pass `npm run test:integration`.
- [x] Run and pass `npm run test:e2e`.
- [x] Run and pass `npm run build:linux`.

### Phase 13: Launch at Login

Status: Complete.

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

Implementation tracking:

- [x] Add unit tests for XDG autostart entry creation.
- [x] Add unit tests for XDG autostart entry removal.
- [x] Add unit tests for safe executable path handling.
- [x] Add unit tests for `--start-minimized` in the autostart entry.
- [x] Implement `src/main/launch-at-login-manager.js`.
- [x] Wire launch-at-login sync into app startup.
- [x] Wire launch-at-login sync into settings save/reset.
- [x] Use user-local XDG autostart without requiring root.
- [x] Run and pass `npm run lint`.
- [x] Run and pass `npm run format:check`.
- [x] Run and pass `npm run test`.
- [x] Run and pass `npm run test:integration`.
- [x] Run and pass `npm run test:e2e`.
- [x] Run and pass `npm run build:linux`.

### Phase 14: Isolated Profiles

Status: Complete.

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

Implementation tracking:

- [x] Add a focused profile manager module.
- [x] Validate and normalize profile names.
- [x] Reject path traversal in profile names.
- [x] Generate Electron `persist:` session partitions per profile.
- [x] Support `--profile name` and `--profile=name` command-line profile selection.
- [x] Wire isolated partitions into main `BrowserWindow` creation.
- [x] Preserve secure renderer preferences with profile partitions enabled.
- [x] Add a simple profile selector in the settings window.
- [x] Restart the app after a saved profile change so the next window uses the new partition.
- [x] Run and pass `npm run lint`.
- [x] Run and pass `npm run format:check`.
- [x] Run and pass `npm run test`.
- [x] Run and pass `npm run test:integration`.
- [x] Run and pass `npm run test:e2e`.
- [x] Run and pass `npm run build:linux`.

### Phase 15: Privacy Controls

Status: Complete.

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

Implementation tracking:

- [x] Add a focused privacy manager module.
- [x] Clear cache through the active Electron session.
- [x] Clear cookies through Electron session storage APIs.
- [x] Clear profile storage data through Electron session storage APIs.
- [x] Preserve the existing remembered-permissions clearing action.
- [x] Add sign out and clear local session data.
- [x] Reload ChatGPT after sign-out/session clearing.
- [x] Expose explicit privacy IPC channels to the trusted settings window.
- [x] Add confirmation prompts before destructive settings actions.
- [x] Keep privacy operations scoped to the active profile session without deleting unrelated user-data files.
- [x] Run and pass `npm run lint`.
- [x] Run and pass `npm run format:check`.
- [x] Run and pass `npm run test`.
- [x] Run and pass `npm run test:integration`.
- [x] Run and pass `npm run test:e2e`.
- [x] Run and pass `npm run build:linux`.

### Phase 16: Health Monitoring and Recovery

Status: Complete.

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

Implementation tracking:

- [x] Add a focused health manager module.
- [x] Support `--safe-mode` by disabling GPU acceleration before app readiness.
- [x] Sanitize logged failure details.
- [x] Listen for `did-fail-load`.
- [x] Listen for `render-process-gone`.
- [x] Listen for `unresponsive`.
- [x] Listen for `responsive`.
- [x] Listen for `child-process-gone`.
- [x] Offer recovery actions for Wait, Reload, Restart Window, and Restart in Safe Mode.
- [x] Expose explicit recovery IPC channels.
- [x] Run and pass `npm run lint`.
- [x] Run and pass `npm run format:check`.
- [x] Run and pass `npm run test`.
- [x] Run and pass `npm run test:integration`.
- [x] Run and pass `npm run test:e2e`.
- [x] Run and pass `npm run build:linux`.

### Phase 17: Diagnostics Export

Status: Complete.

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

Implementation tracking:

- [x] Add a focused diagnostics manager module.
- [x] Collect app, Electron, Chromium, Node, Linux, architecture, desktop, session, command-line, GPU, settings, and log metadata.
- [x] Sanitize settings and logs before export.
- [x] Redact sensitive URL query parameters.
- [x] Exclude cookies and authentication-token fields.
- [x] Exclude personally identifying environment variables by allowlisting only desktop/session fields.
- [x] Redact conversation-like log content.
- [x] Wire `Help -> Export Diagnostics` to a save dialog.
- [x] Run and pass `npm run lint`.
- [x] Run and pass `npm run format:check`.
- [x] Run and pass `npm run test`.
- [x] Run and pass `npm run test:integration`.
- [x] Run and pass `npm run test:e2e`.
- [x] Run and pass `npm run build:linux`.
- [x] Install the built application locally.

### Phase 18: Packaging and Release Workflow

Preserve existing AppImage and Debian builds.

Status: Complete.

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
- [x] Add project-owned Flatpak packaging script using Freedesktop Platform, Freedesktop SDK, and Electron BaseApp `24.08`.
- [x] Install Flatpak tooling and runtimes in the GitHub release workflow.
- [x] Attach generated `.flatpak` bundles to GitHub releases.
- [x] Validate Flatpak build locally or in CI.
- [x] Add release artifact checksum generation.
- [x] Add ARM64 build where dependencies support it.
- [x] Add RPM if feasible.
- [x] Add release artifact checksum validation before publishing.
- [x] Attach `.rpm` and `.sha256` files to GitHub releases.
- [x] Document local RPM and Flatpak tooling requirements.

Tests and validation:

```bash
npm run verify
npm run build:rpm:x64
npm run build:rpm:arm64
npm run build:flatpak
npm run checksums
(cd dist && sha256sum --check *.sha256)
```

CI must fail before release publication if tests or packaging fail.

Local validation note: x64 and ARM64 AppImage/Deb builds were validated locally through `npm run verify` and `npm run build:linux:arm64`. x64 and ARM64 RPM builds were validated locally after `rpmbuild` was installed. The x64 Flatpak bundle was validated locally after `flatpak-builder` and the required Flathub runtimes were installed; the Flatpak build must run with host sandbox permissions because restricted Codex execution cannot allocate a Flatpak build instance.

### Phase 19: Documentation

Status: Complete.

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

Implementation tracking:

- [x] Expand `README.md` with project description, unofficial-client disclaimer, screenshots placeholder, feature list, installation instructions, package-specific install instructions, supported architectures, tested Linux notes, Wayland/X11 notes, tray limitations, shortcut configuration, profile usage, proxy/VPN notes, privacy/security model, troubleshooting, safe mode, diagnostics export, development setup, test commands, build commands, release process, and uninstall instructions.
- [x] Add `CONTRIBUTING.md` with development setup, branch and pull-request expectations, test requirements, formatting rules, and security issue reporting guidance.
- [x] Add `SECURITY.md` covering remote content isolation, navigation policy, permission handling, local settings storage, profile isolation, diagnostics handling, and data the application does not collect.
- [x] Run and pass documentation formatting checks.

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
