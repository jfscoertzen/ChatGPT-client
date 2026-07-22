const electron = require('electron');

const CHATGPT_STORAGE_TYPES = Object.freeze([
  'cookies',
  'filesystem',
  'indexdb',
  'localstorage',
  'serviceworkers',
  'cachestorage'
]);

function asPromise(value) {
  return Promise.resolve(value);
}

class PrivacyManager {
  constructor(options = {}) {
    this.getSession = options.getSession;
    this.getWindow = options.getWindow;
    this.permissionManager = options.permissionManager;
    this.settingsManager = options.settingsManager;
  }

  requireSession() {
    const session = this.getSession?.();

    if (!session) {
      throw new Error('No active Electron session is available.');
    }

    return session;
  }

  async clearCache() {
    const session = this.requireSession();

    if (typeof session.clearCache !== 'function') {
      throw new Error('The active Electron session cannot clear cache data.');
    }

    await asPromise(session.clearCache());
    return { ok: true, action: 'clearCache' };
  }

  async clearCookies() {
    const session = this.requireSession();

    if (typeof session.clearStorageData !== 'function') {
      throw new Error('The active Electron session cannot clear cookies.');
    }

    await asPromise(session.clearStorageData({ storages: ['cookies'] }));
    return { ok: true, action: 'clearCookies' };
  }

  async clearStorageData() {
    const session = this.requireSession();

    if (typeof session.clearStorageData !== 'function') {
      throw new Error('The active Electron session cannot clear storage data.');
    }

    await asPromise(
      session.clearStorageData({ storages: [...CHATGPT_STORAGE_TYPES] })
    );
    return { ok: true, action: 'clearStorageData' };
  }

  async clearRememberedPermissions() {
    if (
      this.permissionManager &&
      typeof this.permissionManager.clearRememberedDecisions === 'function'
    ) {
      this.permissionManager.clearRememberedDecisions();
    }

    return { ok: true, action: 'clearRememberedPermissions' };
  }

  async signOutAndClearSessionData() {
    await this.clearCache();
    await this.clearStorageData();

    const win = this.getWindow?.();
    const settings = this.settingsManager?.get?.() || {};
    if (win && typeof win.loadURL === 'function' && settings.chatgptUrl) {
      win.loadURL(settings.chatgptUrl);
    }

    return { ok: true, action: 'signOutAndClearSessionData' };
  }
}

function registerPrivacyIpc(privacyManager, dependencies = {}) {
  const ipcMainImpl = dependencies.ipcMain || electron.ipcMain;

  ipcMainImpl.handle('chatgpt-desktop:privacy:cache:clear', () =>
    privacyManager.clearCache()
  );
  ipcMainImpl.handle('chatgpt-desktop:privacy:cookies:clear', () =>
    privacyManager.clearCookies()
  );
  ipcMainImpl.handle('chatgpt-desktop:privacy:storage:clear', () =>
    privacyManager.clearStorageData()
  );
  ipcMainImpl.handle('chatgpt-desktop:privacy:session:clear', () =>
    privacyManager.signOutAndClearSessionData()
  );
}

module.exports = {
  CHATGPT_STORAGE_TYPES,
  PrivacyManager,
  registerPrivacyIpc
};
