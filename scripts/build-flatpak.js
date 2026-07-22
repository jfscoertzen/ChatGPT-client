/*
 * ChatGPT Desktop Wrapper
 * Developer: Stephan Coertzen <coertzen.jfs@gmail.com>
 * License: MIT
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const packageJson = require(path.join(rootDir, 'package.json'));

const buildConfig = packageJson.build || {};
const linuxConfig = buildConfig.linux || {};
const flatpakConfig = buildConfig.flatpak || {};

const appId = buildConfig.appId || 'com.local.chatgpt';
const productName = buildConfig.productName || packageJson.name;
const executableName = linuxConfig.executableName || packageJson.name;
const version = packageJson.version;
const arch = 'x86_64';

const appOutDir = path.join(distDir, 'linux-unpacked');
const sourceDir = path.join(distDir, 'flatpak-source');
const buildDir = path.join(distDir, 'flatpak-build');
const repoDir = path.join(distDir, 'flatpak-repo');
const manifestPath = path.join(distDir, 'flatpak-manifest.json');
const artifactPath = path.join(
  distDir,
  `${productName}-${version}-${arch}.flatpak`
);

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: rootDir,
    stdio: 'inherit',
    ...options
  });

  if (result.status !== 0) {
    const status = result.status ?? result.signal ?? 'unknown';
    throw new Error(
      `${command} ${args.join(' ')} failed with status ${status}`
    );
  }
}

function copyIconExports() {
  const iconRoot = path.join(rootDir, linuxConfig.icon || 'build/icons');
  const iconDestRoot = path.join(sourceDir, 'share', 'icons', 'hicolor');

  if (!fs.existsSync(iconRoot)) {
    return;
  }

  for (const entry of fs.readdirSync(iconRoot, { withFileTypes: true })) {
    if (!entry.isFile() || path.extname(entry.name) !== '.png') {
      continue;
    }

    const size = Number.parseInt(
      path.basename(entry.name, '.png').split('x')[0],
      10
    );
    if (!Number.isFinite(size) || size > 512) {
      continue;
    }

    const sizeDir = `${size}x${size}`;
    const dest = path.join(iconDestRoot, sizeDir, 'apps', `${appId}.png`);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.join(iconRoot, entry.name), dest);
  }
}

function writeFlatpakSourceFiles() {
  fs.rmSync(sourceDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(sourceDir, 'bin'), { recursive: true });
  fs.mkdirSync(path.join(sourceDir, 'share', 'applications'), {
    recursive: true
  });

  const wrapper = `#!/bin/sh
export TMPDIR="$XDG_RUNTIME_DIR/app/$FLATPAK_ID"
exec zypak-wrapper "${executableName}" "$@"
`;
  const wrapperPath = path.join(sourceDir, 'bin', 'electron-wrapper');
  fs.writeFileSync(wrapperPath, wrapper, { mode: 0o755 });
  fs.chmodSync(wrapperPath, 0o755);

  const desktopEntry = `[Desktop Entry]
Name=${productName}
Comment=${packageJson.description || productName}
Exec=electron-wrapper %U
Icon=${appId}
Terminal=false
Type=Application
Categories=${linuxConfig.category || 'Utility'};
`;
  fs.writeFileSync(
    path.join(sourceDir, 'share', 'applications', `${appId}.desktop`),
    desktopEntry
  );

  copyIconExports();
}

function writeManifest() {
  const finishArgs = flatpakConfig.finishArgs || [
    '--socket=wayland',
    '--socket=x11',
    '--share=ipc',
    '--device=dri',
    '--socket=pulseaudio',
    '--share=network',
    '--talk-name=org.freedesktop.Notifications'
  ];

  const manifest = {
    id: appId,
    command: 'electron-wrapper',
    runtime: flatpakConfig.runtime || 'org.freedesktop.Platform',
    'runtime-version': flatpakConfig.runtimeVersion || '24.08',
    sdk: flatpakConfig.sdk || 'org.freedesktop.Sdk',
    base: flatpakConfig.base || 'org.electronjs.Electron2.BaseApp',
    'base-version': flatpakConfig.baseVersion || '24.08',
    'finish-args': finishArgs,
    modules: [
      {
        name: packageJson.name,
        buildsystem: 'simple',
        sources: [
          {
            type: 'dir',
            path: appOutDir,
            dest: 'linux-unpacked'
          },
          {
            type: 'dir',
            path: sourceDir,
            dest: 'flatpak-files'
          }
        ],
        'build-commands': [
          `mkdir -p /app/lib/${appId} /app/bin`,
          `cp -a linux-unpacked/. /app/lib/${appId}/`,
          `install -Dm755 flatpak-files/bin/electron-wrapper /app/bin/electron-wrapper`,
          `ln -sf /app/lib/${appId}/${executableName} /app/bin/${executableName}`,
          `cp -a flatpak-files/share /app/`
        ]
      }
    ]
  };

  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function main() {
  fs.mkdirSync(distDir, { recursive: true });
  fs.rmSync(buildDir, { recursive: true, force: true });
  fs.rmSync(repoDir, { recursive: true, force: true });
  fs.rmSync(artifactPath, { force: true });

  run('npx', [
    'electron-builder',
    '--linux',
    'dir',
    '--x64',
    '--publish',
    'never'
  ]);

  writeFlatpakSourceFiles();
  writeManifest();

  run('flatpak-builder', [
    '--force-clean',
    '--disable-rofiles-fuse',
    '--arch',
    arch,
    '--repo',
    repoDir,
    buildDir,
    manifestPath
  ]);
  run('flatpak', [
    'build-bundle',
    '--arch',
    arch,
    repoDir,
    artifactPath,
    appId
  ]);

  console.log(`Built ${path.relative(rootDir, artifactPath)}`);
}

main();
