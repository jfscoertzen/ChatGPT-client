const fs = require('fs');
const path = require('path');

function quoteExecPath(execPath) {
  return `"${String(execPath).replaceAll('"', '\\"')}"`;
}

function validateExecPath(execPath) {
  if (!path.isAbsolute(execPath)) {
    throw new Error('Launch at login executable path must be absolute.');
  }
}

function buildAutostartDesktopEntry(options = {}) {
  validateExecPath(options.execPath);
  const args = options.startMinimized ? ' --start-minimized' : '';

  return [
    '[Desktop Entry]',
    'Type=Application',
    'Name=ChatGPT',
    'Comment=Start ChatGPT desktop client at login',
    `Exec=${quoteExecPath(options.execPath)}${args}`,
    'Terminal=false',
    'Categories=Utility;Network;',
    'X-GNOME-Autostart-enabled=true',
    ''
  ].join('\n');
}

class LaunchAtLoginManager {
  constructor(options = {}) {
    this.fs = options.fs || fs;
    this.env = options.env || process.env;
    this.execPath = options.execPath || process.execPath;
    this.logger = options.logger || console;
    const home = options.home || this.env.HOME;
    this.autostartDir =
      options.autostartDir ||
      path.join(home || process.cwd(), '.config', 'autostart');
    this.autostartPath =
      options.autostartPath || path.join(this.autostartDir, 'chatgpt.desktop');
  }

  apply(settings = {}) {
    if (settings.launchAtLogin) {
      return this.enable(settings);
    }

    return this.disable();
  }

  enable(settings = {}) {
    const entry = buildAutostartDesktopEntry({
      execPath: this.execPath,
      startMinimized: settings.startMinimized
    });

    this.fs.mkdirSync(this.autostartDir, { recursive: true });
    this.fs.writeFileSync(this.autostartPath, entry, 'utf8');
    return { enabled: true, path: this.autostartPath };
  }

  disable() {
    if (this.fs.existsSync(this.autostartPath)) {
      this.fs.unlinkSync(this.autostartPath);
    }

    return { enabled: false, path: this.autostartPath };
  }
}

module.exports = {
  LaunchAtLoginManager,
  buildAutostartDesktopEntry,
  quoteExecPath
};
