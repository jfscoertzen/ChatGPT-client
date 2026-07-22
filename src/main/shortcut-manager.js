const electron = require('electron');
const { CHATGPT_URL } = require('./constants');
const { clampZoomFactor } = require('./window-state-manager');

const DEFAULT_GLOBAL_SHORTCUT = 'Ctrl+Alt+Space';
const ZOOM_STEP = 0.1;

function isKeyDown(input) {
  return input && input.type === 'keyDown';
}

function normalizedKey(input) {
  return String(input.key || '').toLowerCase();
}

function hasOnlyControl(input) {
  return Boolean(input.control) && !input.shift && !input.alt && !input.meta;
}

function hasControlShift(input) {
  return (
    Boolean(input.control) && Boolean(input.shift) && !input.alt && !input.meta
  );
}

function setZoom(win, zoomFactor) {
  if (!win.webContents || typeof win.webContents.setZoomFactor !== 'function') {
    return;
  }

  win.webContents.setZoomFactor(clampZoomFactor(Number(zoomFactor.toFixed(2))));
}

function getZoom(win) {
  if (win.webContents && typeof win.webContents.getZoomFactor === 'function') {
    return win.webContents.getZoomFactor();
  }

  return 1;
}

function registerLocalShortcuts(win, options = {}) {
  const chatgptUrl = options.chatgptUrl || CHATGPT_URL;

  win.webContents.on('before-input-event', (event, input) => {
    if (!isKeyDown(input)) {
      return;
    }

    const key = normalizedKey(input);

    if (input.key === 'F5') {
      event.preventDefault();
      win.webContents.reload();
      return;
    }

    if (hasControlShift(input) && key === 'n') {
      event.preventDefault();
      win.loadURL(chatgptUrl);
      return;
    }

    if (hasControlShift(input) && key === 'r') {
      event.preventDefault();
      if (typeof win.webContents.reloadIgnoringCache === 'function') {
        win.webContents.reloadIgnoringCache();
      } else {
        win.webContents.reload();
      }
      return;
    }

    if (hasOnlyControl(input) && key === 'r') {
      event.preventDefault();
      win.webContents.reload();
      return;
    }

    if (hasOnlyControl(input) && ['+', '='].includes(key)) {
      event.preventDefault();
      setZoom(win, getZoom(win) + ZOOM_STEP);
      return;
    }

    if (hasOnlyControl(input) && key === '-') {
      event.preventDefault();
      setZoom(win, getZoom(win) - ZOOM_STEP);
      return;
    }

    if (hasOnlyControl(input) && key === '0') {
      event.preventDefault();
      setZoom(win, 1);
    }
  });
}

function toggleMainWindow(win) {
  if (!win) {
    return;
  }

  const isVisible =
    typeof win.isVisible === 'function' ? win.isVisible() : true;
  const isFocused =
    typeof win.isFocused === 'function' ? win.isFocused() : false;

  if (isVisible && isFocused) {
    if (typeof win.hide === 'function') {
      win.hide();
    }
    return;
  }

  if (typeof win.isMinimized === 'function' && win.isMinimized()) {
    win.restore();
  }

  if (!isVisible && typeof win.show === 'function') {
    win.show();
  }

  if (typeof win.focus === 'function') {
    win.focus();
  }
}

function registerGlobalShortcut(win, dependencies = {}) {
  const appImpl = dependencies.app || electron.app;
  const globalShortcutImpl =
    dependencies.globalShortcut || electron.globalShortcut;
  const logger = dependencies.logger || console;
  const settings = dependencies.settings || {};
  const accelerator = settings.globalShortcut || DEFAULT_GLOBAL_SHORTCUT;

  let registered = false;

  try {
    registered = globalShortcutImpl.register(accelerator, () => {
      toggleMainWindow(win);
    });
  } catch (error) {
    logger.warn(
      `Could not register global shortcut ${accelerator}: ${error.message}`
    );
  }

  if (!registered) {
    logger.warn(`Could not register global shortcut ${accelerator}.`);
    return false;
  }

  if (appImpl && typeof appImpl.on === 'function') {
    appImpl.on('will-quit', () => {
      globalShortcutImpl.unregisterAll();
    });
  }

  return true;
}

module.exports = {
  DEFAULT_GLOBAL_SHORTCUT,
  registerGlobalShortcut,
  registerLocalShortcuts,
  toggleMainWindow
};
