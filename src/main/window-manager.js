const path = require('path');
const electron = require('electron');
const { CHATGPT_URL } = require('./constants');
const {
  DownloadManager,
  registerDownloadHandling
} = require('./download-manager');
const { registerContextMenu } = require('./menu-manager');
const { HealthManager, registerHealthHandling } = require('./health-manager');
const { registerNavigationPolicy } = require('./navigation-policy');
const { createNotificationManager } = require('./notification-manager');
const { registerOfflineHandling } = require('./offline-manager');
const {
  PermissionManager,
  registerPermissionHandlers
} = require('./permission-manager');
const { ProfileManager } = require('./profile-manager');
const { SettingsManager } = require('./settings-manager');
const { registerLocalShortcuts } = require('./shortcut-manager');
const {
  applyWindowState,
  registerWindowStatePersistence,
  WindowStateManager
} = require('./window-state-manager');

const { BrowserWindow } = electron;

function getWindowOptions(
  baseDir = path.join(__dirname, '..', '..'),
  windowState = {},
  profilePartition = 'persist:chatgpt-default'
) {
  return {
    width: windowState.width || 1280,
    height: windowState.height || 820,
    x: windowState.x,
    y: windowState.y,
    minWidth: 980,
    minHeight: 640,
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(baseDir, 'src', 'preload', 'chatgpt.js'),
      partition: profilePartition,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  };
}

function createWindow(dependencies = {}) {
  const BrowserWindowImpl = dependencies.BrowserWindow || BrowserWindow;
  const settingsManager =
    dependencies.settingsManager || new SettingsManager(dependencies);
  const settings = settingsManager.get();
  const healthManager =
    dependencies.healthManager || new HealthManager(dependencies);
  const profileManager =
    dependencies.profileManager ||
    new ProfileManager({ ...dependencies, settingsManager });
  const windowStateManager =
    dependencies.windowStateManager || new WindowStateManager(dependencies);
  const windowState = windowStateManager.load();
  const hasPersistedWindowState =
    typeof windowStateManager.hasPersistedState === 'function'
      ? windowStateManager.hasPersistedState()
      : Object.hasOwn(windowState, 'zoomFactor');
  const win = new BrowserWindowImpl(
    getWindowOptions(
      dependencies.baseDir,
      windowState,
      profileManager.getPartition()
    )
  );
  const permissionManager =
    dependencies.permissionManager ||
    new PermissionManager({ ...dependencies, settingsManager });
  const notificationManager =
    dependencies.notificationManager ||
    createNotificationManager({ ...dependencies, settingsManager, win });
  const downloadManager =
    dependencies.downloadManager ||
    new DownloadManager({
      ...dependencies,
      notifier: notificationManager,
      win
    });

  registerNavigationPolicy(win, dependencies);
  if (
    win.webContents &&
    win.webContents.session &&
    typeof win.webContents.session.setPermissionRequestHandler === 'function'
  ) {
    registerPermissionHandlers(win.webContents.session, permissionManager);
  }
  if (
    win.webContents &&
    win.webContents.session &&
    typeof win.webContents.session.on === 'function'
  ) {
    registerDownloadHandling(win.webContents.session, downloadManager);
  }
  registerContextMenu(win, dependencies);
  registerLocalShortcuts(win, settings);
  registerHealthHandling(win, healthManager);
  registerOfflineHandling(win, {
    ...dependencies,
    notificationManager,
    targetUrl: settings.chatgptUrl || CHATGPT_URL
  });
  registerWindowStatePersistence(win, windowStateManager);

  applyWindowState(win, {
    ...windowState,
    zoomFactor: hasPersistedWindowState
      ? windowState.zoomFactor
      : settings.zoomFactor
  });

  win.loadURL(settings.chatgptUrl || CHATGPT_URL);
  return win;
}

module.exports = {
  createWindow,
  getWindowOptions
};
