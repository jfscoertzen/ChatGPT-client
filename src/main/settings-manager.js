const fs = require('fs');
const path = require('path');
const electron = require('electron');
const { CHATGPT_URL } = require('./constants');

const DEFAULT_SETTINGS = Object.freeze({
  chatgptUrl: CHATGPT_URL,
  closeToTray: true,
  startMinimized: false,
  launchAtLogin: false,
  enableNotifications: true,
  globalShortcut: 'Ctrl+Alt+Space',
  zoomFactor: 1,
  profile: 'default'
});

const ALLOWED_CHATGPT_HOSTS = new Set([
  'chatgpt.com',
  'chat.openai.com',
  'openai.com',
  'auth.openai.com',
  'platform.openai.com'
]);

function isAllowedHost(hostname) {
  return (
    ALLOWED_CHATGPT_HOSTS.has(hostname) ||
    hostname.endsWith('.chatgpt.com') ||
    hostname.endsWith('.openai.com')
  );
}

function validateChatGptUrl(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return { ok: false, reason: 'URL must be a non-empty string.' };
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch (error) {
    return { ok: false, reason: `URL could not be parsed: ${error.message}` };
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, reason: 'URL must use HTTPS.' };
  }

  if (!isAllowedHost(parsed.hostname.toLowerCase())) {
    return {
      ok: false,
      reason: 'URL host is not an allowed ChatGPT/OpenAI host.'
    };
  }

  parsed.hash = '';
  if (parsed.pathname === '/' && parsed.search === '') {
    return { ok: true, url: parsed.origin };
  }

  return { ok: true, url: parsed.toString() };
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isValidProfileName(value) {
  return (
    typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(value)
  );
}

function isValidShortcut(value) {
  return (
    typeof value === 'string' && value.trim().length > 0 && value.length <= 80
  );
}

function sanitizeSettings(input = {}) {
  const source = isPlainObject(input) ? input : {};
  const settings = { ...DEFAULT_SETTINGS };
  const errors = [];

  if (Object.hasOwn(source, 'chatgptUrl')) {
    const result = validateChatGptUrl(source.chatgptUrl);
    if (result.ok) {
      settings.chatgptUrl = result.url;
    } else {
      errors.push(`chatgptUrl rejected: ${result.reason}`);
    }
  }

  for (const key of [
    'closeToTray',
    'startMinimized',
    'launchAtLogin',
    'enableNotifications'
  ]) {
    if (!Object.hasOwn(source, key)) {
      continue;
    }

    if (typeof source[key] === 'boolean') {
      settings[key] = source[key];
    } else {
      errors.push(`${key} rejected: expected boolean.`);
    }
  }

  if (Object.hasOwn(source, 'globalShortcut')) {
    if (isValidShortcut(source.globalShortcut)) {
      settings.globalShortcut = source.globalShortcut.trim();
    } else {
      errors.push(
        'globalShortcut rejected: expected non-empty shortcut string.'
      );
    }
  }

  if (Object.hasOwn(source, 'zoomFactor')) {
    if (
      typeof source.zoomFactor === 'number' &&
      Number.isFinite(source.zoomFactor) &&
      source.zoomFactor >= 0.5 &&
      source.zoomFactor <= 3
    ) {
      settings.zoomFactor = source.zoomFactor;
    } else {
      errors.push('zoomFactor rejected: expected number between 0.5 and 3.');
    }
  }

  if (Object.hasOwn(source, 'profile')) {
    if (isValidProfileName(source.profile)) {
      settings.profile = source.profile;
    } else {
      errors.push('profile rejected: expected safe profile name.');
    }
  }

  return { settings, errors };
}

class SettingsManager {
  constructor(options = {}) {
    const appImpl = options.app || electron.app;
    this.fs = options.fs || fs;
    this.logger = options.logger || console;
    this.userDataPath =
      options.userDataPath ||
      (appImpl && typeof appImpl.getPath === 'function'
        ? appImpl.getPath('userData')
        : process.cwd());
    this.settingsPath =
      options.settingsPath || path.join(this.userDataPath, 'settings.json');
    this.currentSettings = null;
  }

  load() {
    if (!this.fs.existsSync(this.settingsPath)) {
      this.currentSettings = { ...DEFAULT_SETTINGS };
      return this.get();
    }

    let parsed;
    try {
      parsed = JSON.parse(this.fs.readFileSync(this.settingsPath, 'utf8'));
    } catch (error) {
      this.backupMalformedSettings(error);
      this.currentSettings = { ...DEFAULT_SETTINGS };
      return this.get();
    }

    const { settings, errors } = sanitizeSettings(parsed);
    this.logValidationErrors(errors);
    this.currentSettings = settings;
    return this.get();
  }

  get() {
    if (!this.currentSettings) {
      return this.load();
    }

    return { ...this.currentSettings };
  }

  save(nextSettings) {
    const { settings, errors } = sanitizeSettings({
      ...this.get(),
      ...nextSettings
    });

    this.logValidationErrors(errors);
    this.writeSettings(settings);
    this.currentSettings = settings;
    return this.get();
  }

  resetToDefaults() {
    this.writeSettings(DEFAULT_SETTINGS);
    this.currentSettings = { ...DEFAULT_SETTINGS };
    return this.get();
  }

  backupMalformedSettings(error) {
    const backupPath = path.join(
      path.dirname(this.settingsPath),
      `settings.malformed-${Date.now()}.json`
    );

    try {
      this.fs.renameSync(this.settingsPath, backupPath);
      this.logger.warn(
        `Malformed settings moved to ${backupPath}: ${error.message}`
      );
    } catch (backupError) {
      this.logger.error(
        `Could not back up malformed settings: ${backupError.message}`
      );
    }
  }

  logValidationErrors(errors) {
    for (const error of errors) {
      this.logger.warn(`Settings validation: ${error}`);
    }
  }

  writeSettings(settings) {
    this.fs.mkdirSync(path.dirname(this.settingsPath), { recursive: true });
    const tempPath = `${this.settingsPath}.${process.pid}.tmp`;
    this.fs.writeFileSync(
      tempPath,
      `${JSON.stringify(settings, null, 2)}\n`,
      'utf8'
    );
    this.fs.renameSync(tempPath, this.settingsPath);
  }
}

function registerSettingsIpc(settingsManager, dependencies = {}) {
  const ipcMainImpl = dependencies.ipcMain || electron.ipcMain;
  const launchAtLoginManager = dependencies.launchAtLoginManager;
  const permissionManager = dependencies.permissionManager;
  const onSettingsSaved = dependencies.onSettingsSaved;

  function syncLaunchAtLogin(settings) {
    if (
      launchAtLoginManager &&
      typeof launchAtLoginManager.apply === 'function'
    ) {
      launchAtLoginManager.apply(settings);
    }

    return settings;
  }

  ipcMainImpl.handle('chatgpt-desktop:settings:get', () =>
    settingsManager.get()
  );
  ipcMainImpl.handle('chatgpt-desktop:settings:save', (_event, settings) => {
    const previousSettings = settingsManager.get();
    const savedSettings = syncLaunchAtLogin(settingsManager.save(settings));

    if (typeof onSettingsSaved === 'function') {
      onSettingsSaved(savedSettings, previousSettings);
    }

    return savedSettings;
  });
  ipcMainImpl.handle('chatgpt-desktop:settings:reset', () =>
    syncLaunchAtLogin(settingsManager.resetToDefaults())
  );
  ipcMainImpl.handle('chatgpt-desktop:settings:permissions:clear', () => {
    if (
      permissionManager &&
      typeof permissionManager.clearRememberedDecisions === 'function'
    ) {
      permissionManager.clearRememberedDecisions();
    }

    return true;
  });
}

function getSettingsWindowOptions(baseDir = path.join(__dirname, '..', '..')) {
  return {
    width: 560,
    height: 620,
    minWidth: 480,
    minHeight: 520,
    title: 'ChatGPT Settings',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(baseDir, 'src', 'preload', 'settings.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  };
}

function createSettingsWindow(dependencies = {}) {
  const BrowserWindowImpl =
    dependencies.BrowserWindow || electron.BrowserWindow;
  const baseDir = dependencies.baseDir || path.join(__dirname, '..', '..');
  const win = new BrowserWindowImpl(getSettingsWindowOptions(baseDir));

  if (typeof win.loadFile === 'function') {
    win.loadFile(path.join(baseDir, 'src', 'renderer', 'settings.html'));
  }

  return win;
}

module.exports = {
  DEFAULT_SETTINGS,
  SettingsManager,
  createSettingsWindow,
  getSettingsWindowOptions,
  registerSettingsIpc,
  sanitizeSettings,
  validateChatGptUrl
};
