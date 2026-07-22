const electron = require('electron');
const { redactUrl } = require('./navigation-policy');

const RECOVERY_ACTIONS = Object.freeze([
  'wait',
  'reload',
  'restart-window',
  'restart-safe-mode'
]);

function hasSafeModeArg(argv = []) {
  return argv.includes('--safe-mode');
}

function applySafeMode(appImpl, argv = process.argv) {
  if (!hasSafeModeArg(argv)) {
    return false;
  }

  if (appImpl && typeof appImpl.disableHardwareAcceleration === 'function') {
    appImpl.disableHardwareAcceleration();
  }

  return true;
}

function sanitizeFailureDetails(details = {}) {
  const sanitized = {};

  for (const key of [
    'type',
    'reason',
    'exitCode',
    'errorCode',
    'errorDescription',
    'validatedUrl',
    'isMainFrame',
    'childProcessType'
  ]) {
    if (Object.hasOwn(details, key)) {
      sanitized[key] =
        typeof details[key] === 'string'
          ? sanitizeFailureText(details[key])
          : details[key];
    }
  }

  if (sanitized.validatedUrl) {
    sanitized.validatedUrl = redactUrl(sanitized.validatedUrl);
  }

  return sanitized;
}

function sanitizeFailureText(value) {
  return value.replace(/https?:\/\/[^\s]+/g, (match) => redactUrl(match));
}

function getWindowUrl(win) {
  if (win?.webContents && typeof win.webContents.getURL === 'function') {
    return win.webContents.getURL();
  }

  return '';
}

class HealthManager {
  constructor(options = {}) {
    this.app = options.app || electron.app;
    this.dialog = options.dialog || electron.dialog;
    this.getWindow = options.getWindow;
    this.logger = options.logger || console;
    this.logEntries = options.logEntries || [];
    this.recreateWindow = options.recreateWindow;
    this.argv = options.argv || process.argv;
    this.safeModeApplied = hasSafeModeArg(this.argv);
  }

  logFailure(details) {
    const sanitized = sanitizeFailureDetails(details);
    this.logEntries.push({
      level: 'warn',
      timestamp: new Date().toISOString(),
      event: sanitized
    });
    this.logger.warn(`Health event: ${JSON.stringify(sanitized)}`);
    return sanitized;
  }

  getLogEntries() {
    return this.logEntries.map((entry) => ({ ...entry }));
  }

  async offerRecovery(details = {}) {
    this.logFailure(details);

    if (!this.dialog || typeof this.dialog.showMessageBox !== 'function') {
      return { action: 'wait' };
    }

    const dialogOptions = {
      type: 'warning',
      title: 'ChatGPT Recovery',
      message: 'The ChatGPT window reported a problem.',
      detail: details.type || 'Application health event',
      buttons: ['Wait', 'Reload', 'Restart Window', 'Restart in Safe Mode'],
      defaultId: 1,
      cancelId: 0,
      noLink: true
    };
    const currentWindow = this.getWindow?.();
    const result = currentWindow
      ? await this.dialog.showMessageBox(currentWindow, dialogOptions)
      : await this.dialog.showMessageBox(dialogOptions);
    const action = RECOVERY_ACTIONS[result.response] || 'wait';

    return this.recover(action);
  }

  recover(action) {
    switch (action) {
      case 'reload':
        return this.reload();
      case 'restart-window':
        return this.restartWindow();
      case 'restart-safe-mode':
        return this.restartInSafeMode();
      case 'wait':
      default:
        return { ok: true, action: 'wait' };
    }
  }

  reload() {
    const win = this.getWindow?.();

    if (win?.webContents && typeof win.webContents.reload === 'function') {
      win.webContents.reload();
      return { ok: true, action: 'reload' };
    }

    return { ok: false, action: 'reload' };
  }

  restartWindow() {
    const win = this.getWindow?.();

    if (typeof this.recreateWindow === 'function') {
      if (win && typeof win.destroy === 'function') {
        win.destroy();
      }

      this.recreateWindow();
      return { ok: true, action: 'restart-window' };
    }

    if (
      win?.webContents &&
      typeof win.webContents.reloadIgnoringCache === 'function'
    ) {
      win.webContents.reloadIgnoringCache();
      return { ok: true, action: 'restart-window' };
    }

    return { ok: false, action: 'restart-window' };
  }

  restartInSafeMode() {
    const nextArgs = this.argv.includes('--safe-mode')
      ? [...this.argv]
      : [...this.argv, '--safe-mode'];

    if (this.app && typeof this.app.relaunch === 'function') {
      this.app.relaunch({ args: nextArgs.slice(1) });
    }

    if (this.app && typeof this.app.exit === 'function') {
      this.app.exit(0);
    }

    return { ok: true, action: 'restart-safe-mode' };
  }
}

function registerHealthHandling(win, healthManager) {
  win.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedUrl, isMainFrame) => {
      healthManager.logFailure({
        type: 'did-fail-load',
        errorCode,
        errorDescription,
        validatedUrl,
        isMainFrame
      });
    }
  );

  win.webContents.on('render-process-gone', (_event, details = {}) => {
    healthManager.offerRecovery({
      type: 'render-process-gone',
      ...details,
      validatedUrl: getWindowUrl(win)
    });
  });

  win.on('unresponsive', () => {
    healthManager.offerRecovery({
      type: 'unresponsive',
      validatedUrl: getWindowUrl(win)
    });
  });

  win.on('responsive', () => {
    healthManager.logger.info?.('Health event: {"type":"responsive"}');
  });
}

function registerChildProcessHealth(appImpl, healthManager) {
  if (appImpl && typeof appImpl.on === 'function') {
    appImpl.on('child-process-gone', (_event, details = {}) => {
      healthManager.offerRecovery({
        ...details,
        type: 'child-process-gone',
        childProcessType: details.type
      });
    });
  }
}

function registerHealthIpc(healthManager, dependencies = {}) {
  const ipcMainImpl = dependencies.ipcMain || electron.ipcMain;

  ipcMainImpl.handle('chatgpt-desktop:health:wait', () =>
    healthManager.recover('wait')
  );
  ipcMainImpl.handle('chatgpt-desktop:health:reload', () =>
    healthManager.recover('reload')
  );
  ipcMainImpl.handle('chatgpt-desktop:health:restart-window', () =>
    healthManager.recover('restart-window')
  );
  ipcMainImpl.handle('chatgpt-desktop:health:restart-safe-mode', () =>
    healthManager.recover('restart-safe-mode')
  );
}

module.exports = {
  HealthManager,
  applySafeMode,
  hasSafeModeArg,
  registerChildProcessHealth,
  registerHealthHandling,
  registerHealthIpc,
  sanitizeFailureDetails,
  sanitizeFailureText
};
