const path = require('path');
const electron = require('electron');
const { redactUrl } = require('./navigation-policy');

const RESERVED_FILENAMES = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9'
]);

function sanitizeFilename(filename) {
  const baseName = path.basename(String(filename || '')).trim();
  const sanitized = baseName
    .replace(/[<>:"/\\|?*]/g, '_')
    .split('')
    .map((character) => (character.charCodeAt(0) < 32 ? '_' : character))
    .join('')
    .replace(/\s+/g, ' ')
    .replace(/^\.+/, '')
    .slice(0, 180);

  if (!sanitized || RESERVED_FILENAMES.has(sanitized.toUpperCase())) {
    return 'download';
  }

  return sanitized;
}

function createDownloadRecord(id, item) {
  return {
    id,
    filename: sanitizeFilename(item.getFilename()),
    mimeType: typeof item.getMimeType === 'function' ? item.getMimeType() : '',
    receivedBytes:
      typeof item.getReceivedBytes === 'function' ? item.getReceivedBytes() : 0,
    savePath: typeof item.getSavePath === 'function' ? item.getSavePath() : '',
    state: 'started',
    totalBytes:
      typeof item.getTotalBytes === 'function' ? item.getTotalBytes() : 0,
    url: typeof item.getURL === 'function' ? redactUrl(item.getURL()) : ''
  };
}

class DownloadManager {
  constructor(options = {}) {
    const appImpl = options.app || electron.app;
    this.dialog = options.dialog || electron.dialog;
    this.logger = options.logger || console;
    this.notifier = options.notifier || null;
    this.win = options.win;
    this.downloads = new Map();
    this.nextId = 1;
    this.downloadDirectory =
      options.downloadDirectory ||
      (appImpl && typeof appImpl.getPath === 'function'
        ? appImpl.getPath('downloads')
        : process.cwd());
  }

  createId() {
    const id = `download-${this.nextId}`;
    this.nextId += 1;
    return id;
  }

  getDefaultSavePath(item) {
    const filename = sanitizeFilename(item.getFilename());
    return path.join(this.downloadDirectory, filename);
  }

  prepareSavePath(item, savePath = this.getDefaultSavePath(item)) {
    if (!savePath) {
      return '';
    }

    if (typeof item.setSavePath === 'function') {
      item.setSavePath(savePath);
    }

    return savePath;
  }

  async chooseSavePath(item) {
    const defaultPath = this.getDefaultSavePath(item);

    if (!this.dialog || typeof this.dialog.showSaveDialog !== 'function') {
      return defaultPath;
    }

    if (typeof item.pause === 'function') {
      item.pause();
    }

    const dialogOptions = {
      defaultPath,
      properties: ['showOverwriteConfirmation'],
      title: 'Save Download'
    };

    const result = this.win
      ? await this.dialog.showSaveDialog(this.win, dialogOptions)
      : await this.dialog.showSaveDialog(dialogOptions);

    if (result.canceled || !result.filePath) {
      if (typeof item.cancel === 'function') {
        item.cancel();
      }

      return null;
    }

    return result.filePath;
  }

  async trackDownload(item) {
    const id = this.createId();
    const savePath = await this.chooseSavePath(item);

    if (!savePath) {
      return null;
    }

    this.prepareSavePath(item, savePath);
    const record = createDownloadRecord(id, item);
    record.savePath =
      typeof item.getSavePath === 'function'
        ? item.getSavePath()
        : record.savePath;
    record.notifiedComplete = false;
    this.downloads.set(id, record);

    item.on('updated', (_event, state) => {
      this.updateDownload(id, item, state);
    });

    item.on('done', (_event, state) => {
      this.finishDownload(id, item, state);
    });

    if (typeof item.resume === 'function') {
      item.resume();
    }

    return record;
  }

  updateDownload(id, item, state) {
    const record = this.downloads.get(id);

    if (!record) {
      return null;
    }

    record.receivedBytes =
      typeof item.getReceivedBytes === 'function'
        ? item.getReceivedBytes()
        : record.receivedBytes;
    record.totalBytes =
      typeof item.getTotalBytes === 'function'
        ? item.getTotalBytes()
        : record.totalBytes;
    record.state = state || 'progressing';
    return record;
  }

  finishDownload(id, item, state) {
    const record = this.downloads.get(id);

    if (!record) {
      return null;
    }

    record.receivedBytes =
      typeof item.getReceivedBytes === 'function'
        ? item.getReceivedBytes()
        : record.receivedBytes;
    record.totalBytes =
      typeof item.getTotalBytes === 'function'
        ? item.getTotalBytes()
        : record.totalBytes;
    record.savePath =
      typeof item.getSavePath === 'function'
        ? item.getSavePath()
        : record.savePath;
    record.state = state;

    if (state === 'completed') {
      this.notifyComplete(record);
    } else if (state === 'interrupted') {
      this.logger.warn(`Download interrupted: ${record.filename}`);
    }

    return record;
  }

  notifyComplete(record) {
    if (record.notifiedComplete) {
      return;
    }

    record.notifiedComplete = true;

    if (
      this.notifier &&
      typeof this.notifier.notifyDownloadComplete === 'function'
    ) {
      this.notifier.notifyDownloadComplete(record);
    }
  }
}

function registerDownloadHandling(session, downloadManager) {
  session.on('will-download', (_event, item) => {
    downloadManager.trackDownload(item).catch((error) => {
      downloadManager.logger.error(
        `Could not start download: ${error.message}`
      );

      if (typeof item.cancel === 'function') {
        item.cancel();
      }
    });
  });
}

module.exports = {
  DownloadManager,
  createDownloadRecord,
  registerDownloadHandling,
  sanitizeFilename
};
