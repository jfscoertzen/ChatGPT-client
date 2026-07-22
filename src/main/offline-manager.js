const path = require('path');
const electron = require('electron');
const { redactUrl } = require('./navigation-policy');

const MAIN_FRAME_NETWORK_ERROR_CODES = new Set([
  -2, -6, -7, -21, -102, -105, -106, -109, -118, -130, -137, -138, -501
]);

class OfflineRetryState {
  constructor(options = {}) {
    this.initialDelayMs = options.initialDelayMs || 1000;
    this.maxDelayMs = options.maxDelayMs || 30000;
    this.maxAttempts = options.maxAttempts || 6;
    this.attempts = 0;
  }

  canRetry() {
    return this.attempts < this.maxAttempts;
  }

  nextDelay() {
    const delay = Math.min(
      this.initialDelayMs * 2 ** this.attempts,
      this.maxDelayMs
    );
    this.attempts += 1;
    return delay;
  }

  reset() {
    this.attempts = 0;
  }
}

function isMainFrameNetworkFailure(details) {
  return (
    Boolean(details && details.isMainFrame) &&
    MAIN_FRAME_NETWORK_ERROR_CODES.has(details.errorCode)
  );
}

function buildOfflinePageUrl(
  baseDir = path.join(__dirname, '..', '..'),
  details = {}
) {
  return {
    filePath: path.join(baseDir, 'src', 'renderer', 'offline.html'),
    query: {
      errorCode: String(details.errorCode || ''),
      errorDescription: details.errorDescription || 'Network error',
      retrying: String(Boolean(details.retrying)),
      targetUrl: redactUrl(details.targetUrl || '')
    }
  };
}

function showOfflinePage(win, options = {}) {
  const offlinePage = buildOfflinePageUrl(options.baseDir, options);

  if (typeof win.loadFile === 'function') {
    win.loadFile(offlinePage.filePath, { query: offlinePage.query });
  }
}

function scheduleRetry(win, options = {}) {
  const retry = options.retry;
  const setTimeoutImpl = options.setTimeout || setTimeout;
  const logger = options.logger || console;

  if (!retry.canRetry()) {
    logger.warn('Offline retry limit reached.');
    return;
  }

  const delay = retry.nextDelay();
  setTimeoutImpl(() => {
    if (typeof win.loadURL === 'function') {
      win.loadURL(options.targetUrl);
    }
  }, delay);
}

function registerOfflineHandling(win, dependencies = {}) {
  const retry = dependencies.retry || new OfflineRetryState();
  const targetUrl = dependencies.targetUrl;
  const notificationManager = dependencies.notificationManager;

  win.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedUrl, isMainFrame) => {
      const details = {
        errorCode,
        errorDescription,
        isMainFrame,
        targetUrl: targetUrl || validatedUrl
      };

      if (!isMainFrameNetworkFailure(details)) {
        return;
      }

      if (
        notificationManager &&
        typeof notificationManager.markOffline === 'function'
      ) {
        notificationManager.markOffline();
      }

      showOfflinePage(win, {
        ...dependencies,
        ...details,
        retrying: retry.canRetry()
      });
      scheduleRetry(win, {
        ...dependencies,
        retry,
        targetUrl: details.targetUrl
      });
    }
  );

  win.webContents.on('did-finish-load', () => {
    const currentUrl =
      win.webContents && typeof win.webContents.getURL === 'function'
        ? win.webContents.getURL()
        : '';

    if (
      currentUrl.startsWith('file://') &&
      currentUrl.includes('/offline.html')
    ) {
      return;
    }

    const hadOfflineAttempts = retry.attempts > 0;
    retry.reset();

    if (
      hadOfflineAttempts &&
      notificationManager &&
      typeof notificationManager.notifyReconnected === 'function'
    ) {
      notificationManager.notifyReconnected();
    }
  });

  return retry;
}

function registerOfflineIpc(win, dependencies = {}) {
  const ipcMainImpl = dependencies.ipcMain || electron.ipcMain;
  const shellImpl = dependencies.shell || electron.shell;
  const targetUrl = dependencies.targetUrl;
  const logger = dependencies.logger || console;

  function isOfflinePageSender(event) {
    const senderUrl =
      event && event.sender && typeof event.sender.getURL === 'function'
        ? event.sender.getURL()
        : '';

    return (
      senderUrl.startsWith('file://') && senderUrl.includes('/offline.html')
    );
  }

  ipcMainImpl.handle('chatgpt-desktop:offline:retry', (event) => {
    if (!isOfflinePageSender(event)) {
      logger.warn('Rejected offline retry request from non-offline page.');
      return false;
    }

    if (typeof win.loadURL === 'function') {
      win.loadURL(targetUrl);
    }

    return true;
  });
  ipcMainImpl.handle('chatgpt-desktop:offline:open-browser', (event) => {
    if (!isOfflinePageSender(event)) {
      logger.warn('Rejected offline browser request from non-offline page.');
      return false;
    }

    shellImpl.openExternal(targetUrl);
    return true;
  });
}

module.exports = {
  MAIN_FRAME_NETWORK_ERROR_CODES,
  OfflineRetryState,
  buildOfflinePageUrl,
  isMainFrameNetworkFailure,
  registerOfflineHandling,
  registerOfflineIpc,
  scheduleRetry,
  showOfflinePage
};
