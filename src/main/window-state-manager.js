const fs = require('fs');
const path = require('path');
const electron = require('electron');

const MIN_WINDOW_WIDTH = 980;
const MIN_WINDOW_HEIGHT = 640;
const DEFAULT_WINDOW_STATE = Object.freeze({
  width: 1280,
  height: 820,
  x: undefined,
  y: undefined,
  isMaximized: false,
  isFullScreen: false,
  zoomFactor: 1
});

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function clampZoomFactor(value) {
  if (!isFiniteNumber(value)) {
    return DEFAULT_WINDOW_STATE.zoomFactor;
  }

  return clamp(value, 0.5, 3);
}

function getDisplayWorkAreas(displays) {
  return displays.map((display) => display.workArea || display.bounds);
}

function intersects(bounds, area) {
  const overlapWidth =
    Math.min(bounds.x + bounds.width, area.x + area.width) -
    Math.max(bounds.x, area.x);
  const overlapHeight =
    Math.min(bounds.y + bounds.height, area.y + area.height) -
    Math.max(bounds.y, area.y);

  return overlapWidth > 80 && overlapHeight > 80;
}

function getPrimaryArea(displays) {
  return (
    getDisplayWorkAreas(displays)[0] || {
      x: 0,
      y: 0,
      width: 1920,
      height: 1080
    }
  );
}

function coerceDimension(value, fallback, minimum) {
  if (!isFiniteNumber(value) || value < minimum) {
    return fallback;
  }

  return value;
}

function normalizeWindowState(input = {}, options = {}) {
  const displays =
    options.displays && options.displays.length > 0
      ? options.displays
      : [{ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }];
  const width = coerceDimension(
    input.width,
    DEFAULT_WINDOW_STATE.width,
    MIN_WINDOW_WIDTH
  );
  const height = coerceDimension(
    input.height,
    DEFAULT_WINDOW_STATE.height,
    MIN_WINDOW_HEIGHT
  );
  const primaryArea = getPrimaryArea(displays);
  const hasStoredPosition = isFiniteNumber(input.x) && isFiniteNumber(input.y);
  let x = hasStoredPosition ? input.x : DEFAULT_WINDOW_STATE.x;
  let y = hasStoredPosition ? input.y : DEFAULT_WINDOW_STATE.y;

  if (hasStoredPosition) {
    const proposedBounds = { x, y, width, height };
    const visibleArea = getDisplayWorkAreas(displays).find((area) =>
      intersects(proposedBounds, area)
    );

    if (!visibleArea) {
      x = primaryArea.x;
      y = primaryArea.y;
    } else {
      x = clamp(
        x,
        visibleArea.x - width + 80,
        visibleArea.x + visibleArea.width - 80
      );
      y = clamp(
        y,
        visibleArea.y,
        Math.max(visibleArea.y, visibleArea.y + visibleArea.height - 80)
      );
    }
  }

  return {
    width,
    height,
    x,
    y,
    isMaximized:
      typeof input.isMaximized === 'boolean'
        ? input.isMaximized
        : DEFAULT_WINDOW_STATE.isMaximized,
    isFullScreen:
      typeof input.isFullScreen === 'boolean'
        ? input.isFullScreen
        : DEFAULT_WINDOW_STATE.isFullScreen,
    zoomFactor: clampZoomFactor(input.zoomFactor)
  };
}

class WindowStateManager {
  constructor(options = {}) {
    const appImpl = options.app || electron.app;
    this.fs = options.fs || fs;
    this.logger = options.logger || console;
    this.screen = options.screen || electron.screen;
    this.debounceMs = options.debounceMs ?? 250;
    this.setTimeout = options.setTimeout || setTimeout;
    this.clearTimeout = options.clearTimeout || clearTimeout;
    this.pendingSave = null;
    this.userDataPath =
      options.userDataPath ||
      (appImpl && typeof appImpl.getPath === 'function'
        ? appImpl.getPath('userData')
        : process.cwd());
    this.statePath =
      options.statePath || path.join(this.userDataPath, 'window-state.json');
    this.currentState = null;
    this.loadedFromDisk = false;
  }

  getDisplays() {
    if (this.screen && typeof this.screen.getAllDisplays === 'function') {
      return this.screen.getAllDisplays();
    }

    return [{ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }];
  }

  load() {
    if (!this.fs.existsSync(this.statePath)) {
      this.loadedFromDisk = false;
      this.currentState = normalizeWindowState(
        {},
        { displays: this.getDisplays() }
      );
      return this.get();
    }

    this.loadedFromDisk = true;
    let parsed;
    try {
      parsed = JSON.parse(this.fs.readFileSync(this.statePath, 'utf8'));
    } catch (error) {
      this.logger.warn(`Could not load window state: ${error.message}`);
      parsed = {};
    }

    this.currentState = normalizeWindowState(parsed, {
      displays: this.getDisplays()
    });
    return this.get();
  }

  hasPersistedState() {
    return this.loadedFromDisk;
  }

  get() {
    if (!this.currentState) {
      return this.load();
    }

    return { ...this.currentState };
  }

  save(state) {
    const normalized = normalizeWindowState(state, {
      displays: this.getDisplays()
    });
    this.writeState(normalized);
    this.currentState = normalized;
    return this.get();
  }

  scheduleSaveFromWindow(win) {
    if (this.pendingSave) {
      this.clearTimeout(this.pendingSave);
    }

    if (this.debounceMs === 0) {
      this.saveFromWindow(win);
      return;
    }

    this.pendingSave = this.setTimeout(() => {
      this.pendingSave = null;
      this.saveFromWindow(win);
    }, this.debounceMs);
  }

  saveFromWindow(win) {
    if (!win || typeof win.getBounds !== 'function') {
      return this.get();
    }

    const bounds = win.getBounds();
    const zoomFactor =
      win.webContents && typeof win.webContents.getZoomFactor === 'function'
        ? win.webContents.getZoomFactor()
        : this.get().zoomFactor;
    const nextState = {
      ...bounds,
      isMaximized:
        typeof win.isMaximized === 'function' ? win.isMaximized() : false,
      isFullScreen:
        typeof win.isFullScreen === 'function' ? win.isFullScreen() : false,
      zoomFactor
    };

    return this.save(nextState);
  }

  writeState(state) {
    this.fs.mkdirSync(path.dirname(this.statePath), { recursive: true });
    const tempPath = `${this.statePath}.${process.pid}.tmp`;
    this.fs.writeFileSync(
      tempPath,
      `${JSON.stringify(state, null, 2)}\n`,
      'utf8'
    );
    this.fs.renameSync(tempPath, this.statePath);
  }
}

function applyWindowState(win, state) {
  if (state.isMaximized && typeof win.maximize === 'function') {
    win.maximize();
  }

  if (state.isFullScreen && typeof win.setFullScreen === 'function') {
    win.setFullScreen(true);
  }

  if (win.webContents && typeof win.webContents.setZoomFactor === 'function') {
    win.webContents.setZoomFactor(state.zoomFactor);
  }
}

function registerWindowStatePersistence(win, windowStateManager) {
  for (const eventName of [
    'move',
    'resize',
    'maximize',
    'unmaximize',
    'enter-full-screen',
    'leave-full-screen',
    'close'
  ]) {
    if (typeof win.on === 'function') {
      win.on(eventName, () => {
        windowStateManager.scheduleSaveFromWindow(win);
      });
    }
  }

  if (win.webContents && typeof win.webContents.on === 'function') {
    win.webContents.on('zoom-changed', () => {
      windowStateManager.scheduleSaveFromWindow(win);
    });
  }
}

module.exports = {
  DEFAULT_WINDOW_STATE,
  MIN_WINDOW_HEIGHT,
  MIN_WINDOW_WIDTH,
  WindowStateManager,
  applyWindowState,
  clampZoomFactor,
  normalizeWindowState,
  registerWindowStatePersistence
};
