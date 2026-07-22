const path = require('path');
const {
  OfflineRetryState,
  buildOfflinePageUrl,
  isMainFrameNetworkFailure,
  registerOfflineHandling
} = require('../../src/main/offline-manager');

function createWindow() {
  const handlers = new Map();

  return {
    loadedFile: null,
    loadedUrl: null,
    webContents: {
      handlers,
      getURL: vi.fn(() => 'https://chatgpt.com'),
      on: vi.fn((eventName, handler) => {
        handlers.set(eventName, handler);
      })
    },
    loadFile: vi.fn(),
    loadURL: vi.fn()
  };
}

describe('offline manager', () => {
  test('identifies main-frame network failures', () => {
    expect(
      isMainFrameNetworkFailure({
        errorCode: -106,
        isMainFrame: true
      })
    ).toBe(true);
  });

  test('ignores subresource failures', () => {
    expect(
      isMainFrameNetworkFailure({
        errorCode: -106,
        isMainFrame: false
      })
    ).toBe(false);
  });

  test('retry delays increase and cap', () => {
    const retry = new OfflineRetryState({
      initialDelayMs: 100,
      maxDelayMs: 450
    });

    expect(retry.nextDelay()).toBe(100);
    expect(retry.nextDelay()).toBe(200);
    expect(retry.nextDelay()).toBe(400);
    expect(retry.nextDelay()).toBe(450);
  });

  test('retry state resets after success', () => {
    const retry = new OfflineRetryState({ initialDelayMs: 100 });

    retry.nextDelay();
    retry.nextDelay();
    retry.reset();

    expect(retry.attempts).toBe(0);
    expect(retry.nextDelay()).toBe(100);
  });

  test('retry loop stops at the configured limit', () => {
    const retry = new OfflineRetryState({ maxAttempts: 2 });

    expect(retry.canRetry()).toBe(true);
    retry.nextDelay();
    expect(retry.canRetry()).toBe(true);
    retry.nextDelay();
    expect(retry.canRetry()).toBe(false);
  });

  test('builds an offline page URL with sensitive params redacted', () => {
    const url = buildOfflinePageUrl('/app', {
      errorCode: -106,
      errorDescription: 'DNS failed',
      retrying: true,
      targetUrl: 'https://chatgpt.com/?token=secret&message=hello'
    });

    expect(url.filePath).toBe(
      path.join('/app', 'src', 'renderer', 'offline.html')
    );
    expect(url.query).toMatchObject({
      errorCode: '-106',
      retrying: 'true',
      targetUrl: 'https://chatgpt.com/?token=REDACTED&message=hello'
    });
  });

  test('main-frame load failures show the offline page and schedule retry', () => {
    const win = createWindow();
    const retry = new OfflineRetryState({
      initialDelayMs: 100,
      maxAttempts: 3
    });
    const setTimeout = vi.fn((callback) => {
      callback();
      return 1;
    });

    registerOfflineHandling(win, {
      baseDir: '/app',
      retry,
      setTimeout,
      targetUrl: 'https://chatgpt.com'
    });

    win.webContents.handlers.get('did-fail-load')(
      {},
      -106,
      'ERR_INTERNET_DISCONNECTED',
      'https://chatgpt.com',
      true
    );

    expect(win.loadFile).toHaveBeenCalledWith(
      path.join('/app', 'src', 'renderer', 'offline.html'),
      expect.objectContaining({
        query: expect.objectContaining({
          errorCode: '-106',
          targetUrl: 'https://chatgpt.com/'
        })
      })
    );
    expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 100);
    expect(win.loadURL).toHaveBeenCalledWith('https://chatgpt.com');
  });

  test('main-frame load failures mark the app offline', () => {
    const win = createWindow();
    const notificationManager = { markOffline: vi.fn() };

    registerOfflineHandling(win, {
      baseDir: '/app',
      notificationManager,
      targetUrl: 'https://chatgpt.com'
    });

    win.webContents.handlers.get('did-fail-load')(
      {},
      -106,
      'ERR_INTERNET_DISCONNECTED',
      'https://chatgpt.com',
      true
    );

    expect(notificationManager.markOffline).toHaveBeenCalledOnce();
  });

  test('subresource failures do not replace the page', () => {
    const win = createWindow();

    registerOfflineHandling(win, {
      baseDir: '/app',
      targetUrl: 'https://chatgpt.com'
    });

    win.webContents.handlers.get('did-fail-load')(
      {},
      -106,
      'ERR_INTERNET_DISCONNECTED',
      'https://chatgpt.com/logo.png',
      false
    );

    expect(win.loadFile).not.toHaveBeenCalled();
  });

  test('successful loads reset retry state', () => {
    const win = createWindow();
    const retry = new OfflineRetryState({ initialDelayMs: 100 });

    retry.nextDelay();
    registerOfflineHandling(win, {
      baseDir: '/app',
      retry,
      targetUrl: 'https://chatgpt.com'
    });

    win.webContents.handlers.get('did-finish-load')();

    expect(retry.attempts).toBe(0);
  });

  test('successful reconnect after offline attempts sends a notification', () => {
    const win = createWindow();
    const retry = new OfflineRetryState({ initialDelayMs: 100 });
    const notificationManager = { notifyReconnected: vi.fn() };

    retry.nextDelay();
    registerOfflineHandling(win, {
      baseDir: '/app',
      notificationManager,
      retry,
      targetUrl: 'https://chatgpt.com'
    });

    win.webContents.handlers.get('did-finish-load')();

    expect(notificationManager.notifyReconnected).toHaveBeenCalledOnce();
  });

  test('offline page loads do not reset retry state', () => {
    const win = createWindow();
    const retry = new OfflineRetryState({ initialDelayMs: 100 });

    retry.nextDelay();
    win.webContents.getURL.mockReturnValue(
      'file:///app/src/renderer/offline.html'
    );
    registerOfflineHandling(win, {
      baseDir: '/app',
      retry,
      targetUrl: 'https://chatgpt.com'
    });

    win.webContents.handlers.get('did-finish-load')();

    expect(retry.attempts).toBe(1);
  });
});
