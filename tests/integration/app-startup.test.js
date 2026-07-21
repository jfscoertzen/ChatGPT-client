const { startApp } = require('../../main');
const { createFakeBrowserWindowClass } = require('../helpers/fake-electron');

describe('application startup wiring', () => {
  test('starts without real Electron and creates a secure main window', async () => {
    const FakeBrowserWindow = createFakeBrowserWindowClass();
    const app = {
      on: vi.fn(),
      quit: vi.fn(),
      whenReady: vi.fn(() => Promise.resolve())
    };
    const ipcMain = {
      handle: vi.fn()
    };

    startApp({
      app,
      BrowserWindow: FakeBrowserWindow,
      clipboard: { readText: vi.fn() },
      ipcMain,
      shell: { openExternal: vi.fn() },
      platform: 'linux',
      baseDir: '/app'
    });
    await app.whenReady.mock.results[0].value;
    await Promise.resolve();

    expect(ipcMain.handle).toHaveBeenCalledWith(
      'chatgpt-desktop:paste-primary-selection',
      expect.any(Function)
    );
    expect(FakeBrowserWindow.windows).toHaveLength(1);
    expect(FakeBrowserWindow.windows[0].options.webPreferences).toMatchObject({
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    });
  });
});
