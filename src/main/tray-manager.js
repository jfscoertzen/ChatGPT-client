const path = require('path');
const electron = require('electron');
const { CHATGPT_URL } = require('./constants');
const { createSettingsWindow } = require('./settings-manager');

function getTrayIconPath(baseDir = path.join(__dirname, '..', '..')) {
  return path.join(baseDir, 'build', 'icons', '256x256.png');
}

function focusMainWindow(win) {
  if (!win) {
    return;
  }

  if (typeof win.isMinimized === 'function' && win.isMinimized()) {
    win.restore();
  }

  if (typeof win.isVisible === 'function' && !win.isVisible()) {
    win.show();
  }

  if (typeof win.focus === 'function') {
    win.focus();
  }
}

function createTrayMenu(actions, MenuImpl = electron.Menu) {
  return MenuImpl.buildFromTemplate([
    {
      label: 'Open ChatGPT',
      click: actions.openChatGpt
    },
    {
      label: 'New chat',
      click: actions.newChat
    },
    {
      label: 'Reload',
      click: actions.reload
    },
    {
      label: 'Settings',
      click: actions.openSettings
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: actions.quit
    }
  ]);
}

function initializeTray(dependencies = {}) {
  const win = dependencies.win;
  const appImpl = dependencies.app || electron.app;
  const TrayImpl = dependencies.Tray || electron.Tray;
  const MenuImpl = dependencies.Menu || electron.Menu;
  const nativeImageImpl = dependencies.nativeImage || electron.nativeImage;
  const logger = dependencies.logger || console;
  const baseDir = dependencies.baseDir || path.join(__dirname, '..', '..');
  const settings =
    dependencies.settings ||
    (dependencies.settingsManager && dependencies.settingsManager.get
      ? dependencies.settingsManager.get()
      : {});
  const state = {
    explicitQuit: false
  };

  const actions = {
    openChatGpt: () => focusMainWindow(win),
    newChat: () => {
      focusMainWindow(win);
      if (win && typeof win.loadURL === 'function') {
        win.loadURL(settings.chatgptUrl || CHATGPT_URL);
      }
    },
    reload: () => {
      focusMainWindow(win);
      if (
        win &&
        win.webContents &&
        typeof win.webContents.reload === 'function'
      ) {
        win.webContents.reload();
      }
    },
    openSettings: () => createSettingsWindow(dependencies),
    quit: () => {
      state.explicitQuit = true;
      appImpl.quit();
    }
  };

  let tray;
  try {
    const image = nativeImageImpl.createFromPath(getTrayIconPath(baseDir));
    tray = new TrayImpl(image);
    tray.setToolTip('ChatGPT');
    tray.setContextMenu(createTrayMenu(actions, MenuImpl));
    tray.on('click', actions.openChatGpt);
  } catch (error) {
    logger.warn(`System tray unavailable: ${error.message}`);
    return { actions, isExplicitQuit: () => state.explicitQuit, tray: null };
  }

  if (win && typeof win.on === 'function' && settings.closeToTray) {
    win.on('close', (event) => {
      if (state.explicitQuit) {
        return;
      }

      event.preventDefault();
      if (typeof win.hide === 'function') {
        win.hide();
      }
    });
  }

  if (win && settings.startMinimized && typeof win.hide === 'function') {
    win.hide();
  }

  return { actions, isExplicitQuit: () => state.explicitQuit, tray };
}

module.exports = {
  createTrayMenu,
  focusMainWindow,
  getTrayIconPath,
  initializeTray
};
