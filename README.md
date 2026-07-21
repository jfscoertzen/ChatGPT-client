# ChatGPT Electron Wrapper (Ubuntu/Linux)

A native Electron desktop wrapper that opens ChatGPT in an app window.

## Developer

- Stephan Coertzen `<coertzen.jfs@gmail.com>`

## Prerequisites (Ubuntu)

```bash
sudo apt update
sudo apt install -y libnss3 libatk-bridge2.0-0 libgtk-3-0 libxss1 libasound2
```

## Install

```bash
npm install
```

## Run the app

```bash
npm start
```

## Build Linux packages

```bash
npm run build:linux
```

Build outputs are generated in `dist/`:

- `.AppImage`
- `.deb`

## Build Flatpak package

Flatpak builds require `flatpak` and `flatpak-builder`, plus the Freedesktop and Electron BaseApp runtimes from Flathub.

```bash
npm run build:flatpak
```

The release workflow installs those build dependencies in CI and attaches the generated `.flatpak` bundle to GitHub releases.

## GitHub Release Flow

Pushing a version tag (for example `v1.0.1`) triggers automated Linux builds and publishes a GitHub Release with attached artifacts. The release page notes are generated from every commit after `releaseNotes.fromHash` in `package.json`.

```bash
git add .
git commit -m "release: v1.0.1"
git tag v1.0.1
git push origin main --tags
```
