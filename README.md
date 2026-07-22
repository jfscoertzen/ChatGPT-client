# ChatGPT Linux Desktop Client

An unofficial Linux Electron desktop client for ChatGPT. The app loads the official ChatGPT website in Electron and adds native desktop integration such as menus, tray support, shortcuts, settings, profiles, downloads, notifications, diagnostics, and Linux package builds.

This project does not rebuild or replace the ChatGPT web interface. ChatGPT account access, authentication, billing, and conversation handling remain provided by OpenAI through the official website.

## Disclaimer

This is an unofficial client and is not affiliated with, endorsed by, or supported by OpenAI. Use it with the same account and data-care expectations you would apply when opening ChatGPT in a browser.

## Screenshots

Screenshots will be added after the native settings, tray, and diagnostics views settle.

## Features

- Loads `https://chatgpt.com` by default.
- Secure Electron defaults: `nodeIntegration` disabled, `contextIsolation` enabled, and sandboxing enabled where used.
- Native Linux application menu.
- System tray menu with Open ChatGPT, New Chat, Reload, Settings, and Quit.
- Configurable close-to-tray and start-minimized behavior.
- Configurable global shortcut, default `Ctrl+Alt+Space`.
- Local shortcuts for reload, force reload, new chat, zoom, and actual size.
- Persistent window size, position, fullscreen/maximized state, and zoom.
- Local settings window served from bundled app files.
- Navigation policy that keeps trusted ChatGPT/OpenAI auth pages in-app and opens ordinary external links in the browser.
- Explicit permission handling for camera, microphone, notifications, clipboard, screen capture, geolocation, MIDI, USB, and serial.
- Offline/error page with retry controls and bounded retry backoff.
- Native notifications for reconnection and download completion.
- Download tracking with sanitized filenames.
- Launch-at-login support through XDG autostart.
- Isolated profiles through Electron persistent session partitions.
- Privacy actions to clear cache, cookies, storage, remembered permissions, session data, and settings.
- Health recovery actions and `--safe-mode`.
- Sanitized diagnostics export.
- AppImage, Debian, RPM, and Flatpak release packaging with SHA-256 checksums.

## Installation

Download the latest release artifact for your distribution from GitHub Releases.

Supported package formats:

- AppImage for portable Linux use.
- Debian package for Debian/Ubuntu based distributions.
- RPM package for RPM based distributions.
- Flatpak bundle for x64 Flatpak environments.

## AppImage

Make the AppImage executable and run it:

```bash
chmod +x ChatGPT-*-x86_64.AppImage
./ChatGPT-*-x86_64.AppImage
```

On some distributions, AppImage support may require FUSE. If FUSE is unavailable, use the Debian, RPM, or Flatpak package instead.

## Debian Package

Install the `.deb` package:

```bash
sudo apt install ./ChatGPT-*-amd64.deb
```

Remove it:

```bash
sudo apt remove chatgpt
```

## RPM Package

Install the `.rpm` package:

```bash
sudo dnf install ./ChatGPT-*-x86_64.rpm
```

or:

```bash
sudo rpm -i ./ChatGPT-*-x86_64.rpm
```

Remove it:

```bash
sudo dnf remove chatgpt
```

## Flatpak

Install a release bundle:

```bash
flatpak install --user ./ChatGPT-*-x86_64.flatpak
flatpak run com.local.chatgpt
```

Remove it:

```bash
flatpak uninstall --user com.local.chatgpt
```

Flatpak builds use Freedesktop Platform, Freedesktop SDK, and Electron BaseApp `24.08` from Flathub.

## Supported Architectures

- x64: AppImage, Debian, RPM, Flatpak.
- ARM64: AppImage, Debian, RPM.

Flatpak ARM64 is not currently produced by the release workflow.

## Tested Linux Distributions

Development and local validation have been performed on Ubuntu/Linux desktop environments. The release workflow validates package creation on GitHub Actions Ubuntu runners.

Expected compatible families:

- Ubuntu and Debian based distributions through `.deb` or AppImage.
- Fedora, openSUSE, and other RPM based distributions through `.rpm` or AppImage.
- Flatpak capable distributions with Flathub configured.

## Wayland and X11

The app supports both Wayland and X11 sessions. Electron and desktop-environment behavior can vary:

- Tray indicators may require GNOME extensions or AppIndicator support.
- Global shortcuts can be limited by Wayland compositor policy.
- Screen capture permissions depend on the desktop portal implementation.
- Safe mode is available if GPU or compositor issues prevent normal startup.

## System Tray

The tray menu includes:

- Open ChatGPT
- New Chat
- Reload
- Settings
- Quit

Close-to-tray is enabled by default. Use Settings to disable it if closing the window should quit the application. Explicit Quit from the tray or menu always terminates the app.

Tray support degrades gracefully where the desktop environment does not expose a compatible tray/status notifier.

## Shortcuts

Default global shortcut:

```text
Ctrl+Alt+Space
```

Local application shortcuts:

| Shortcut         | Action           |
| ---------------- | ---------------- |
| `Ctrl+Shift+N`   | New ChatGPT chat |
| `Ctrl+R` or `F5` | Reload           |
| `Ctrl+Shift+R`   | Force reload     |
| `Ctrl++`         | Zoom in          |
| `Ctrl+-`         | Zoom out         |
| `Ctrl+0`         | Reset zoom       |

The global shortcut can be changed in Settings. If registration fails, the app logs a warning and continues running.

## Profiles

Profiles isolate cookies, cache, local storage, authentication state, and permission decisions through separate Electron session partitions.

Start a profile from the command line:

```bash
chatgpt --profile personal
chatgpt --profile work
```

Profile names must be safe names using letters, numbers, `.`, `_`, or `-`. The default profile is `default`.

The Settings window also includes a profile selector. Switching profile may restart the app so the next window uses the selected isolated session.

## Settings

Settings are stored as JSON in Electron's user-data directory. Defaults:

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

The configured ChatGPT URL must use HTTPS and must be a trusted ChatGPT/OpenAI host. Unsafe or invalid values fall back to defaults.

## Proxy And VPN Notes

The app uses Electron/Chromium networking. It normally follows the system proxy and VPN configuration available to Chromium. If sign-in or ChatGPT loading fails:

- Confirm the same URL works in a browser on the same network.
- Check VPN DNS and split-tunnel rules.
- Check corporate TLS inspection or proxy authentication requirements.
- Use the diagnostics export for environment details without cookies or tokens.

## Privacy And Security

The app does not intentionally store ChatGPT credentials, cookies, conversation content, uploaded files, authentication tokens, or browser local storage outside Electron's isolated session storage.

Security model:

- Remote ChatGPT content does not receive unrestricted Node.js APIs.
- Settings and offline pages are local bundled files with narrow preload APIs.
- Navigation is centrally controlled.
- Ordinary external links open in the default browser.
- Unsafe protocols such as `javascript:`, `file:`, and unknown schemes are blocked.
- Permissions are granted only to trusted origins and only for supported features.
- Profiles use separate persistent Electron sessions.
- Diagnostics are sanitized before export.

See [SECURITY.md](SECURITY.md) for more detail.

## Privacy Controls

Settings includes actions for:

- Clear cache
- Clear cookies
- Clear storage data
- Clear remembered permissions
- Sign out and clear local session data
- Reset application settings

Destructive actions require confirmation.

## Troubleshooting

Use Reload or Force Reload from the View menu if the page stops responding.

If the app opens but ChatGPT cannot load:

- Check network connectivity.
- Use the local offline page Retry button.
- Open ChatGPT in the browser to compare behavior.
- Check proxy, VPN, or DNS configuration.
- Export diagnostics from Help.

If the tray icon is missing:

- Confirm your desktop supports status notifier/AppIndicator icons.
- GNOME may require an extension for tray icons.
- Use the native application menu as a fallback.

If global shortcuts do not work:

- Check whether the shortcut is already used by the desktop environment.
- On Wayland, compositor policy may block global shortcut registration.
- Configure a different shortcut in Settings.

## Safe Mode

Safe mode disables GPU acceleration before Electron starts:

```bash
chatgpt --safe-mode
```

Use it when the app starts to a blank window, crashes during rendering, or has GPU/compositor issues.

## Diagnostics Export

Use:

```text
Help -> Export Diagnostics
```

The diagnostics file includes sanitized application, Electron, Chromium, Node.js, Linux, architecture, desktop session, command-line, GPU, settings, and log information.

Diagnostics exclude cookies, authentication tokens, chat content, browser storage, uploaded documents, downloaded files, and sensitive URL query parameters.

## Development Setup

Install Node.js and npm, then install dependencies:

```bash
npm install
```

Run the development app:

```bash
npm start
```

Development mode:

```bash
npm run dev
```

## Test Commands

```bash
npm run lint
npm run format:check
npm run test
npm run test:integration
npm run test:e2e
npm run test:all
```

The E2E smoke test does not require a real ChatGPT login or live ChatGPT account credentials.

## Build Commands

```bash
npm run build:linux
npm run build:linux:x64
npm run build:linux:arm64
npm run build:rpm:x64
npm run build:rpm:arm64
npm run build:flatpak
npm run checksums
npm run release:linux
npm run verify
```

Build outputs are written to `dist/`.

Local RPM builds require `rpmbuild` from the system `rpm` package. Local Flatpak builds require `flatpak`, `flatpak-builder`, a configured Flathub remote, and these refs:

```bash
flatpak install --user -y flathub org.freedesktop.Platform//24.08 org.freedesktop.Sdk//24.08 org.electronjs.Electron2.BaseApp//24.08
```

Flatpak builds may need host sandbox permissions. Restricted execution environments that cannot allocate Flatpak build instances may fail even when the manifest is valid.

## Release Process

The GitHub release workflow runs when a version tag is pushed. It installs dependencies, runs `npm run test:all`, builds release packages, generates checksums, validates checksums, generates release notes, and publishes the release artifacts.

Release notes are generated from commits after `releaseNotes.fromHash` in `package.json`.

Typical flow:

```bash
npm version patch
git push origin main
git push origin v1.0.6
```

Release artifacts:

- x64 and ARM64 AppImage bundles
- x64 and ARM64 Debian packages
- x64 and ARM64 RPM packages
- x64 Flatpak bundle
- SHA-256 checksum files

## Uninstall

Debian:

```bash
sudo apt remove chatgpt
```

RPM:

```bash
sudo dnf remove chatgpt
```

Flatpak:

```bash
flatpak uninstall --user com.local.chatgpt
```

AppImage:

Delete the AppImage file. If you created desktop entries manually, remove those entries separately.

User data is stored in Electron's user-data directory. Use the app privacy controls before uninstalling if you want to clear local cache, cookies, storage data, and settings.
