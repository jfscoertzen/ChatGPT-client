const electron = require('electron');
const { CHATGPT_URL } = require('./constants');
const { DiagnosticsManager } = require('./diagnostics-manager');
const {
  HealthManager,
  applySafeMode,
  hasSafeModeArg,
  registerChildProcessHealth,
  registerHealthIpc,
  sanitizeFailureDetails
} = require('./health-manager');
const {
  createApplicationMenu,
  createContextMenu,
  registerApplicationMenu
} = require('./menu-manager');
const { DownloadManager } = require('./download-manager');
const { LaunchAtLoginManager } = require('./launch-at-login-manager');
const {
  NotificationManager,
  createNotificationManager
} = require('./notification-manager');
const {
  registerPrimarySelectionPasteHandler
} = require('./primary-selection-ipc');
const { OfflineRetryState, registerOfflineIpc } = require('./offline-manager');
const { PermissionManager } = require('./permission-manager');
const { PrivacyManager, registerPrivacyIpc } = require('./privacy-manager');
const {
  ProfileManager,
  getProfileArg,
  getProfilePartition,
  normalizeProfileName
} = require('./profile-manager');
const { registerGlobalShortcut } = require('./shortcut-manager');
const {
  createSettingsWindow,
  DEFAULT_SETTINGS,
  getSettingsWindowOptions,
  registerSettingsIpc,
  SettingsManager,
  validateChatGptUrl
} = require('./settings-manager');
const {
  createTrayMenu,
  focusMainWindow,
  initializeTray
} = require('./tray-manager');
const { createWindow, getWindowOptions } = require('./window-manager');
const {
  DEFAULT_WINDOW_STATE,
  WindowStateManager,
  clampZoomFactor,
  normalizeWindowState
} = require('./window-state-manager');

const { app, BrowserWindow } = electron;
const retainedTrayManagers = [];

function retainTrayManager(manager) {
  if (manager && manager.tray) {
    retainedTrayManagers.push(manager);
  }

  return manager;
}

function startApp(dependencies = {}) {
  const appImpl = dependencies.app || app;
  const BrowserWindowImpl = dependencies.BrowserWindow || BrowserWindow;
  applySafeMode(appImpl, dependencies.argv || process.argv);
  const settingsManager =
    dependencies.settingsManager ||
    new SettingsManager({ ...dependencies, app: appImpl });
  const permissionManager =
    dependencies.permissionManager ||
    new PermissionManager({ ...dependencies, settingsManager });
  const profileManager =
    dependencies.profileManager ||
    new ProfileManager({ ...dependencies, settingsManager });
  const launchAtLoginManager =
    dependencies.launchAtLoginManager ||
    new LaunchAtLoginManager({
      ...dependencies,
      execPath: dependencies.execPath || process.execPath
    });
  let activeWindow = null;
  let activeSession = null;
  const privacyManager =
    dependencies.privacyManager ||
    new PrivacyManager({
      getSession: () => activeSession,
      getWindow: () => activeWindow,
      permissionManager,
      settingsManager
    });
  const healthManager =
    dependencies.healthManager ||
    new HealthManager({
      ...dependencies,
      app: appImpl,
      getWindow: () => activeWindow
    });
  const diagnosticsManager =
    dependencies.diagnosticsManager ||
    new DiagnosticsManager({
      ...dependencies,
      app: appImpl,
      healthManager,
      settingsManager
    });
  let globalShortcutRegistered = false;

  function relaunchForProfile(profile) {
    const currentProfile = settingsManager.get().profile;
    if (profile === currentProfile) {
      return;
    }

    settingsManager.save({ profile });

    if (typeof appImpl.relaunch === 'function') {
      appImpl.relaunch();
    }

    if (typeof appImpl.exit === 'function') {
      appImpl.exit(0);
    }
  }

  function registerGlobalShortcutOnce(win) {
    if (globalShortcutRegistered) {
      return;
    }

    globalShortcutRegistered = registerGlobalShortcut(win, {
      ...dependencies,
      app: appImpl,
      settings: settingsManager.get()
    });
  }

  registerPrimarySelectionPasteHandler(dependencies);
  registerSettingsIpc(settingsManager, {
    ...dependencies,
    launchAtLoginManager,
    permissionManager,
    onSettingsSaved: (settings, previousSettings) => {
      if (settings.profile !== previousSettings.profile) {
        if (typeof appImpl.relaunch === 'function') {
          appImpl.relaunch();
        }

        if (typeof appImpl.exit === 'function') {
          appImpl.exit(0);
        }
      }
    }
  });
  registerPrivacyIpc(privacyManager, dependencies);
  registerHealthIpc(healthManager, dependencies);
  registerChildProcessHealth(appImpl, healthManager);

  appImpl.whenReady().then(() => {
    settingsManager.load();
    launchAtLoginManager.apply(settingsManager.get());
    const win = createWindow({
      ...dependencies,
      healthManager,
      permissionManager,
      profileManager,
      settingsManager
    });
    activeWindow = win;
    activeSession = win.webContents?.session;
    registerOfflineIpc(win, {
      ...dependencies,
      targetUrl: settingsManager.get().chatgptUrl
    });
    registerApplicationMenu(
      {
        ...dependencies,
        app: appImpl,
        diagnosticsManager,
        onSelectProfile: relaunchForProfile,
        settings: settingsManager.get(),
        win
      },
      dependencies
    );
    retainTrayManager(
      initializeTray({ ...dependencies, app: appImpl, settingsManager, win })
    );
    registerGlobalShortcutOnce(win);

    appImpl.on('activate', () => {
      if (BrowserWindowImpl.getAllWindows().length === 0) {
        const activatedWindow = createWindow({
          ...dependencies,
          healthManager,
          permissionManager,
          profileManager,
          settingsManager
        });
        activeWindow = activatedWindow;
        activeSession = activatedWindow.webContents?.session;
        registerOfflineIpc(activatedWindow, {
          ...dependencies,
          targetUrl: settingsManager.get().chatgptUrl
        });
        registerApplicationMenu(
          {
            ...dependencies,
            app: appImpl,
            diagnosticsManager,
            onSelectProfile: relaunchForProfile,
            settings: settingsManager.get(),
            win: activatedWindow
          },
          dependencies
        );
        retainTrayManager(
          initializeTray({
            ...dependencies,
            app: appImpl,
            settingsManager,
            win: activatedWindow
          })
        );
        registerGlobalShortcutOnce(activatedWindow);
      }
    });
  });

  appImpl.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      appImpl.quit();
    }
  });
}

module.exports = {
  CHATGPT_URL,
  DEFAULT_SETTINGS,
  DEFAULT_WINDOW_STATE,
  DiagnosticsManager,
  DownloadManager,
  HealthManager,
  LaunchAtLoginManager,
  NotificationManager,
  OfflineRetryState,
  PermissionManager,
  PrivacyManager,
  ProfileManager,
  WindowStateManager,
  applySafeMode,
  clampZoomFactor,
  createApplicationMenu,
  createContextMenu,
  createNotificationManager,
  createSettingsWindow,
  createTrayMenu,
  createWindow,
  focusMainWindow,
  getSettingsWindowOptions,
  getProfileArg,
  getProfilePartition,
  getWindowOptions,
  hasSafeModeArg,
  initializeTray,
  normalizeWindowState,
  normalizeProfileName,
  sanitizeFailureDetails,
  registerOfflineIpc,
  registerGlobalShortcut,
  registerApplicationMenu,
  registerChildProcessHealth,
  registerHealthIpc,
  retainTrayManager,
  registerPrimarySelectionPasteHandler,
  registerPrivacyIpc,
  registerSettingsIpc,
  SettingsManager,
  startApp,
  validateChatGptUrl
};
