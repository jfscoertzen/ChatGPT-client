const fs = require('fs');
const os = require('os');
const path = require('path');
const electron = require('electron');
const { redactUrl } = require('./navigation-policy');
const { DEFAULT_SETTINGS } = require('./settings-manager');

const SENSITIVE_SETTING_KEYS = new Set([
  'auth',
  'accesstoken',
  'cookie',
  'cookies',
  'idtoken',
  'password',
  'refreshtoken',
  'session',
  'token'
]);

const ALLOWED_ENV_KEYS = [
  'XDG_CURRENT_DESKTOP',
  'XDG_SESSION_TYPE',
  'DESKTOP_SESSION',
  'WAYLAND_DISPLAY',
  'DISPLAY'
];

function readPackageVersion(baseDir = path.join(__dirname, '..', '..')) {
  try {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(baseDir, 'package.json'), 'utf8')
    );
    return packageJson.version || 'unknown';
  } catch {
    return 'unknown';
  }
}

function parseOsRelease(content = '') {
  const result = {};

  for (const line of content.split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (!match) {
      continue;
    }

    result[match[1]] = match[2].replace(/^"|"$/g, '');
  }

  return {
    name: result.PRETTY_NAME || result.NAME || os.type(),
    id: result.ID || 'unknown',
    version: result.VERSION_ID || result.VERSION || os.release()
  };
}

function collectLinuxDistribution(fsImpl = fs) {
  try {
    return parseOsRelease(fsImpl.readFileSync('/etc/os-release', 'utf8'));
  } catch {
    return {
      name: os.type(),
      id: 'unknown',
      version: os.release()
    };
  }
}

function sanitizeValue(value) {
  if (typeof value === 'string') {
    return sanitizeText(value);
  }

  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }

  if (value && typeof value === 'object') {
    return sanitizeObject(value);
  }

  return value;
}

function sanitizeObject(input = {}) {
  const output = {};

  for (const [key, value] of Object.entries(input)) {
    if (SENSITIVE_SETTING_KEYS.has(key.toLowerCase())) {
      output[key] = '[REDACTED]';
      continue;
    }

    output[key] = sanitizeValue(value);
  }

  return output;
}

function sanitizeText(value = '') {
  const withoutUrls = value.replace(/https?:\/\/[^\s]+/g, (match) =>
    redactUrl(match)
  );

  if (
    /\b(user|assistant|conversation|prompt|message content)\b/i.test(
      withoutUrls
    )
  ) {
    return '[REDACTED]';
  }

  return withoutUrls.replace(
    /\b(access_token|refresh_token|id_token|token|password|session|cookie)=([^\s&]+)/gi,
    '$1=REDACTED'
  );
}

function sanitizeSettings(settings = DEFAULT_SETTINGS) {
  return sanitizeObject(settings);
}

function sanitizeLogs(logs = []) {
  return logs.map((entry) => sanitizeValue(entry));
}

function collectAllowedEnvironment(env = process.env) {
  const collected = {};

  for (const key of ALLOWED_ENV_KEYS) {
    if (env[key]) {
      collected[key] = env[key];
    }
  }

  return collected;
}

function sanitizeCommandLine(argv = []) {
  return argv.map((arg) => sanitizeText(arg));
}

class DiagnosticsManager {
  constructor(options = {}) {
    this.app = options.app || electron.app;
    this.dialog = options.dialog || electron.dialog;
    this.fs = options.fs || fs;
    this.baseDir = options.baseDir || path.join(__dirname, '..', '..');
    this.process = options.process || process;
    this.settingsManager = options.settingsManager;
    this.healthManager = options.healthManager;
    this.logs = options.logs || [];
  }

  collect() {
    const versions = this.process.versions || {};
    const env = this.process.env || {};
    const settings = this.settingsManager?.get?.() || DEFAULT_SETTINGS;
    const healthLogs =
      typeof this.healthManager?.getLogEntries === 'function'
        ? this.healthManager.getLogEntries()
        : [];

    return {
      generatedAt: new Date().toISOString(),
      app: {
        name: this.app?.getName?.() || 'ChatGPT',
        version: this.app?.getVersion?.() || readPackageVersion(this.baseDir)
      },
      runtime: {
        electron: versions.electron || process.versions.electron || 'unknown',
        chromium: versions.chrome || process.versions.chrome || 'unknown',
        node: versions.node || process.versions.node || 'unknown'
      },
      system: {
        platform: this.process.platform || process.platform,
        architecture: this.process.arch || process.arch,
        linuxDistribution: collectLinuxDistribution(this.fs),
        desktopEnvironment:
          env.XDG_CURRENT_DESKTOP || env.DESKTOP_SESSION || '',
        sessionType: env.XDG_SESSION_TYPE || '',
        gpuAccelerationDisabled:
          typeof this.app?.commandLine?.hasSwitch === 'function'
            ? this.app.commandLine.hasSwitch('disable-gpu')
            : false
      },
      commandLine: sanitizeCommandLine(this.process.argv || []),
      environment: collectAllowedEnvironment(env),
      settings: sanitizeSettings(settings),
      logs: sanitizeLogs([...healthLogs, ...this.logs])
    };
  }

  async exportDiagnostics(win) {
    const defaultPath = path.join(
      this.app?.getPath?.('documents') || os.homedir(),
      `chatgpt-diagnostics-${Date.now()}.json`
    );
    const dialogOptions = {
      title: 'Export Diagnostics',
      defaultPath,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    };
    const result = win
      ? await this.dialog.showSaveDialog(win, dialogOptions)
      : await this.dialog.showSaveDialog(dialogOptions);

    if (result.canceled || !result.filePath) {
      return { ok: false, canceled: true };
    }

    const diagnostics = this.collect();
    this.fs.writeFileSync(
      result.filePath,
      `${JSON.stringify(diagnostics, null, 2)}\n`,
      'utf8'
    );

    return { ok: true, filePath: result.filePath };
  }
}

module.exports = {
  ALLOWED_ENV_KEYS,
  DiagnosticsManager,
  collectAllowedEnvironment,
  collectLinuxDistribution,
  parseOsRelease,
  sanitizeCommandLine,
  sanitizeLogs,
  sanitizeSettings,
  sanitizeText
};
