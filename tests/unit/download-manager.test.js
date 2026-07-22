const path = require('path');
const {
  DownloadManager,
  createDownloadRecord,
  registerDownloadHandling,
  sanitizeFilename
} = require('../../src/main/download-manager');

function createDownloadItem(options = {}) {
  const handlers = new Map();
  let savePath = options.savePath || '/tmp/report.txt';
  const item = {
    handlers,
    cancel: vi.fn(),
    getFilename: vi.fn(() => options.filename || 'report.txt'),
    getMimeType: vi.fn(() => options.mimeType || 'text/plain'),
    getReceivedBytes: vi.fn(() => options.receivedBytes || 0),
    getTotalBytes: vi.fn(() => options.totalBytes || 100),
    getURL: vi.fn(() => options.url || 'https://chatgpt.com/report.txt'),
    getSavePath: vi.fn(() => savePath),
    pause: vi.fn(),
    resume: vi.fn(),
    setSavePath: vi.fn((nextSavePath) => {
      savePath = nextSavePath;
    }),
    on: vi.fn((eventName, handler) => {
      handlers.set(eventName, handler);
    })
  };

  return item;
}

describe('download manager', () => {
  test('sanitizes unsafe filenames', () => {
    expect(sanitizeFilename('../../secret?.txt')).toBe('secret_.txt');
    expect(sanitizeFilename('')).toBe('download');
    expect(sanitizeFilename('CON')).toBe('download');
  });

  test('creates download records without sensitive URLs', () => {
    const item = createDownloadItem({
      filename: 'report.txt',
      url: 'https://chatgpt.com/file?token=secret'
    });

    expect(createDownloadRecord('download-1', item)).toMatchObject({
      id: 'download-1',
      filename: 'report.txt',
      state: 'started',
      url: 'https://chatgpt.com/file?token=REDACTED'
    });
  });

  test('tracks download state transitions', async () => {
    const manager = new DownloadManager();
    const item = createDownloadItem({
      receivedBytes: 25,
      totalBytes: 100
    });

    const record = await manager.trackDownload(item);
    item.handlers.get('updated')({}, 'progressing');

    expect(manager.downloads.get(record.id)).toMatchObject({
      receivedBytes: 25,
      totalBytes: 100,
      state: 'progressing'
    });
  });

  test('completion notification fires only once', async () => {
    const notifier = { notifyDownloadComplete: vi.fn() };
    const manager = new DownloadManager({ notifier });
    const item = createDownloadItem();
    const record = await manager.trackDownload(item);

    item.handlers.get('done')({}, 'completed');
    item.handlers.get('done')({}, 'completed');

    expect(manager.downloads.get(record.id).state).toBe('completed');
    expect(notifier.notifyDownloadComplete).toHaveBeenCalledOnce();
  });

  test('cancelled downloads are handled', async () => {
    const manager = new DownloadManager();
    const item = createDownloadItem();
    const record = await manager.trackDownload(item);

    item.handlers.get('done')({}, 'cancelled');

    expect(manager.downloads.get(record.id).state).toBe('cancelled');
  });

  test('interrupted downloads are reported', async () => {
    const logger = { warn: vi.fn() };
    const manager = new DownloadManager({ logger });
    const item = createDownloadItem();
    const record = await manager.trackDownload(item);

    item.handlers.get('done')({}, 'interrupted');

    expect(manager.downloads.get(record.id).state).toBe('interrupted');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('interrupted')
    );
  });

  test('uses a sanitized default save path', () => {
    const manager = new DownloadManager({
      app: { getPath: vi.fn(() => '/home/user/Downloads') }
    });
    const item = createDownloadItem({ filename: '../../secret?.txt' });

    manager.prepareSavePath(item);

    expect(item.setSavePath).toHaveBeenCalledWith(
      path.join('/home/user/Downloads', 'secret_.txt')
    );
  });

  test('prompts for a visible save path when a dialog is available', async () => {
    const dialog = {
      showSaveDialog: vi.fn(() =>
        Promise.resolve({
          canceled: false,
          filePath: '/home/user/Desktop/report.txt'
        })
      )
    };
    const manager = new DownloadManager({
      app: { getPath: vi.fn(() => '/home/user/Downloads') },
      dialog,
      win: { id: 1 }
    });
    const item = createDownloadItem({ filename: 'report.txt' });

    const record = await manager.trackDownload(item);

    expect(item.pause).toHaveBeenCalledOnce();
    expect(dialog.showSaveDialog).toHaveBeenCalledWith(
      { id: 1 },
      expect.objectContaining({
        defaultPath: path.join('/home/user/Downloads', 'report.txt')
      })
    );
    expect(item.setSavePath).toHaveBeenCalledWith(
      '/home/user/Desktop/report.txt'
    );
    expect(item.resume).toHaveBeenCalledOnce();
    expect(record.savePath).toBe('/home/user/Desktop/report.txt');
  });

  test('cancels the download when the save dialog is cancelled', async () => {
    const dialog = {
      showSaveDialog: vi.fn(() => Promise.resolve({ canceled: true }))
    };
    const manager = new DownloadManager({ dialog });
    const item = createDownloadItem();

    const record = await manager.trackDownload(item);

    expect(record).toBeNull();
    expect(item.cancel).toHaveBeenCalledOnce();
    expect(item.resume).not.toHaveBeenCalled();
  });

  test('registers will-download handling on the session', () => {
    const session = {
      on: vi.fn()
    };
    const manager = new DownloadManager();

    registerDownloadHandling(session, manager);

    expect(session.on).toHaveBeenCalledWith(
      'will-download',
      expect.any(Function)
    );
  });
});
