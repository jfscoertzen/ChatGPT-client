const {
  HealthManager,
  applySafeMode,
  hasSafeModeArg,
  registerChildProcessHealth,
  registerHealthHandling,
  registerHealthIpc,
  sanitizeFailureDetails,
  sanitizeFailureText
} = require('../../src/main/health-manager');
const { createFakeBrowserWindowClass } = require('../helpers/fake-electron');

describe('health manager', () => {
  test('detects safe-mode command-line arguments', () => {
    expect(hasSafeModeArg(['node', 'main.js', '--safe-mode'])).toBe(true);
    expect(hasSafeModeArg(['node', 'main.js'])).toBe(false);
  });

  test('safe mode disables GPU acceleration before app ready', () => {
    const app = {
      disableHardwareAcceleration: vi.fn()
    };

    expect(applySafeMode(app, ['node', 'main.js', '--safe-mode'])).toBe(true);
    expect(app.disableHardwareAcceleration).toHaveBeenCalledOnce();
  });

  test('safe mode does nothing when the flag is absent', () => {
    const app = {
      disableHardwareAcceleration: vi.fn()
    };

    expect(applySafeMode(app, ['node', 'main.js'])).toBe(false);
    expect(app.disableHardwareAcceleration).not.toHaveBeenCalled();
  });

  test('sanitizes failure details before logging', () => {
    const sanitized = sanitizeFailureDetails({
      type: 'did-fail-load',
      errorCode: -105,
      errorDescription: 'DNS failed',
      validatedUrl: 'https://chatgpt.com/?token=abc&code=123&ok=1',
      ignored: 'secret'
    });

    expect(sanitized).toEqual({
      type: 'did-fail-load',
      errorCode: -105,
      errorDescription: 'DNS failed',
      validatedUrl: 'https://chatgpt.com/?token=REDACTED&code=REDACTED&ok=1'
    });
  });

  test('sanitizes URLs embedded in failure text', () => {
    expect(
      sanitizeFailureText('failed https://chatgpt.com/?token=secret later')
    ).toBe('failed https://chatgpt.com/?token=REDACTED later');
  });

  test('failure events are logged safely', () => {
    const logger = { warn: vi.fn() };
    const manager = new HealthManager({ logger, argv: [] });

    manager.logFailure({
      type: 'render-process-gone',
      reason: 'crashed',
      validatedUrl: 'https://chatgpt.com/?access_token=secret'
    });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('access_token=REDACTED')
    );
    expect(logger.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('secret')
    );
  });

  test('reload recovery reloads the active window', () => {
    const FakeBrowserWindow = createFakeBrowserWindowClass();
    const win = new FakeBrowserWindow({});
    const manager = new HealthManager({
      argv: [],
      getWindow: () => win
    });

    expect(manager.recover('reload')).toEqual({ ok: true, action: 'reload' });
    expect(win.webContents.reload).toHaveBeenCalledOnce();
  });

  test('restart-window recovery destroys and recreates when a callback is available', () => {
    const FakeBrowserWindow = createFakeBrowserWindowClass();
    const win = new FakeBrowserWindow({});
    const recreateWindow = vi.fn();
    const manager = new HealthManager({
      argv: [],
      getWindow: () => win,
      recreateWindow
    });

    expect(manager.recover('restart-window')).toEqual({
      ok: true,
      action: 'restart-window'
    });
    expect(win.destroy).toHaveBeenCalledOnce();
    expect(recreateWindow).toHaveBeenCalledOnce();
  });

  test('restart-window recovery falls back to force reload without a callback', () => {
    const FakeBrowserWindow = createFakeBrowserWindowClass();
    const win = new FakeBrowserWindow({});
    const manager = new HealthManager({
      argv: [],
      getWindow: () => win
    });

    expect(manager.recover('restart-window')).toEqual({
      ok: true,
      action: 'restart-window'
    });
    expect(win.webContents.reloadIgnoringCache).toHaveBeenCalledOnce();
  });

  test('safe-mode recovery relaunches with the safe-mode flag', () => {
    const app = {
      relaunch: vi.fn(),
      exit: vi.fn()
    };
    const manager = new HealthManager({
      app,
      argv: ['node', 'main.js']
    });

    expect(manager.recover('restart-safe-mode')).toEqual({
      ok: true,
      action: 'restart-safe-mode'
    });
    expect(app.relaunch).toHaveBeenCalledWith({
      args: ['main.js', '--safe-mode']
    });
    expect(app.exit).toHaveBeenCalledWith(0);
  });

  test('registers window health event handlers', () => {
    const FakeBrowserWindow = createFakeBrowserWindowClass();
    const win = new FakeBrowserWindow({});
    const manager = {
      logFailure: vi.fn(),
      offerRecovery: vi.fn(),
      logger: { info: vi.fn() }
    };

    registerHealthHandling(win, manager);

    expect(win.webContents.handlers.has('did-fail-load')).toBe(true);
    expect(win.webContents.handlers.has('render-process-gone')).toBe(true);
    expect(win.handlers.has('unresponsive')).toBe(true);
    expect(win.handlers.has('responsive')).toBe(true);
  });

  test('registers child-process health handling', () => {
    let handler;
    const app = {
      on: vi.fn((eventName, callback) => {
        if (eventName === 'child-process-gone') {
          handler = callback;
        }
      })
    };
    const manager = {
      offerRecovery: vi.fn()
    };

    registerChildProcessHealth(app, manager);
    handler({}, { type: 'GPU', reason: 'crashed' });

    expect(manager.offerRecovery).toHaveBeenCalledWith({
      type: 'child-process-gone',
      childProcessType: 'GPU',
      reason: 'crashed'
    });
  });

  test('recovery dialog maps selected button to recovery action', async () => {
    const manager = new HealthManager({
      argv: [],
      dialog: {
        showMessageBox: vi.fn(() => Promise.resolve({ response: 1 }))
      },
      getWindow: () => null
    });
    vi.spyOn(manager, 'reload').mockReturnValue({ ok: true, action: 'reload' });

    await expect(
      manager.offerRecovery({ type: 'unresponsive' })
    ).resolves.toEqual({
      ok: true,
      action: 'reload'
    });
  });

  test('registers explicit recovery IPC channels', async () => {
    const handlers = new Map();
    const ipcMain = {
      handle: vi.fn((channel, handler) => {
        handlers.set(channel, handler);
      })
    };
    const manager = {
      recover: vi.fn((action) => ({ ok: true, action }))
    };

    registerHealthIpc(manager, { ipcMain });

    expect(handlers.get('chatgpt-desktop:health:wait')()).toEqual({
      ok: true,
      action: 'wait'
    });
    expect(handlers.get('chatgpt-desktop:health:reload')()).toEqual({
      ok: true,
      action: 'reload'
    });
    expect(handlers.get('chatgpt-desktop:health:restart-window')()).toEqual({
      ok: true,
      action: 'restart-window'
    });
    expect(handlers.get('chatgpt-desktop:health:restart-safe-mode')()).toEqual({
      ok: true,
      action: 'restart-safe-mode'
    });
  });
});
