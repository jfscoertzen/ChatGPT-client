const { startApp } = require('../../main');
const { createFakeBrowserWindowClass } = require('../helpers/fake-electron');

describe('application startup wiring', () => {
  test('starts through the modular app coordinator and creates a secure main window', async () => {
    const FakeBrowserWindow = createFakeBrowserWindowClass();
    const app = {
      getPath: vi.fn(() => '/tmp/chatgpt-test-user-data'),
      on: vi.fn(),
      quit: vi.fn(),
      whenReady: vi.fn(() => Promise.resolve())
    };
    const ipcMain = {
      handle: vi.fn()
    };
    class Tray {
      setToolTip() {}
      setContextMenu() {}
      on() {}
    }
    const globalShortcut = {
      register: vi.fn(() => true),
      unregisterAll: vi.fn()
    };
    const launchAtLoginManager = {
      apply: vi.fn()
    };
    const Menu = {
      buildFromTemplate: vi.fn((template) => ({ template })),
      setApplicationMenu: vi.fn()
    };

    startApp({
      app,
      BrowserWindow: FakeBrowserWindow,
      clipboard: { readText: vi.fn() },
      globalShortcut,
      ipcMain,
      launchAtLoginManager,
      Menu,
      nativeImage: { createFromPath: vi.fn((iconPath) => iconPath) },
      shell: { openExternal: vi.fn() },
      Tray,
      platform: 'linux',
      baseDir: '/app'
    });
    await app.whenReady.mock.results[0].value;
    await Promise.resolve();

    expect(ipcMain.handle).toHaveBeenCalledWith(
      'chatgpt-desktop:paste-primary-selection',
      expect.any(Function)
    );
    expect(ipcMain.handle).toHaveBeenCalledWith(
      'chatgpt-desktop:settings:get',
      expect.any(Function)
    );
    expect(ipcMain.handle).toHaveBeenCalledWith(
      'chatgpt-desktop:settings:permissions:clear',
      expect.any(Function)
    );
    expect(ipcMain.handle).toHaveBeenCalledWith(
      'chatgpt-desktop:privacy:cache:clear',
      expect.any(Function)
    );
    expect(ipcMain.handle).toHaveBeenCalledWith(
      'chatgpt-desktop:privacy:cookies:clear',
      expect.any(Function)
    );
    expect(ipcMain.handle).toHaveBeenCalledWith(
      'chatgpt-desktop:privacy:storage:clear',
      expect.any(Function)
    );
    expect(ipcMain.handle).toHaveBeenCalledWith(
      'chatgpt-desktop:privacy:session:clear',
      expect.any(Function)
    );
    expect(ipcMain.handle).toHaveBeenCalledWith(
      'chatgpt-desktop:offline:retry',
      expect.any(Function)
    );
    expect(ipcMain.handle).toHaveBeenCalledWith(
      'chatgpt-desktop:offline:open-browser',
      expect.any(Function)
    );
    expect(ipcMain.handle).toHaveBeenCalledWith(
      'chatgpt-desktop:health:reload',
      expect.any(Function)
    );
    expect(ipcMain.handle).toHaveBeenCalledWith(
      'chatgpt-desktop:health:restart-window',
      expect.any(Function)
    );
    expect(ipcMain.handle).toHaveBeenCalledWith(
      'chatgpt-desktop:health:restart-safe-mode',
      expect.any(Function)
    );
    expect(globalShortcut.register).toHaveBeenCalledWith(
      'Ctrl+Alt+Space',
      expect.any(Function)
    );
    expect(launchAtLoginManager.apply).toHaveBeenCalledWith(
      expect.objectContaining({
        launchAtLogin: false,
        startMinimized: false
      })
    );
    expect(Menu.setApplicationMenu).toHaveBeenCalledWith(
      expect.objectContaining({ template: expect.any(Array) })
    );
    expect(FakeBrowserWindow.windows).toHaveLength(1);
    expect(FakeBrowserWindow.windows[0].options.webPreferences).toMatchObject({
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    });
  });

  test('applies safe mode before creating the main window', async () => {
    const FakeBrowserWindow = createFakeBrowserWindowClass();
    const app = {
      disableHardwareAcceleration: vi.fn(),
      getPath: vi.fn(() => '/tmp/chatgpt-test-user-data'),
      on: vi.fn(),
      quit: vi.fn(),
      whenReady: vi.fn(() => Promise.resolve())
    };
    const ipcMain = {
      handle: vi.fn()
    };

    startApp({
      app,
      argv: ['node', 'main.js', '--safe-mode'],
      BrowserWindow: FakeBrowserWindow,
      clipboard: { readText: vi.fn() },
      globalShortcut: {
        register: vi.fn(() => true),
        unregisterAll: vi.fn()
      },
      ipcMain,
      launchAtLoginManager: {
        apply: vi.fn()
      },
      Menu: {
        buildFromTemplate: vi.fn((template) => ({ template })),
        setApplicationMenu: vi.fn()
      },
      nativeImage: { createFromPath: vi.fn((iconPath) => iconPath) },
      shell: { openExternal: vi.fn() },
      Tray: class {
        setToolTip() {}
        setContextMenu() {}
        on() {}
      },
      platform: 'linux',
      baseDir: '/app'
    });

    expect(app.disableHardwareAcceleration).toHaveBeenCalledOnce();
    await app.whenReady.mock.results[0].value;
  });
});
