const path = require('path');
const {
  CHATGPT_URL,
  createContextMenu,
  createSettingsWindow,
  createWindow,
  getSettingsWindowOptions,
  getProfilePartition,
  getWindowOptions,
  registerPrimarySelectionPasteHandler
} = require('../../main');
const { createFakeBrowserWindowClass } = require('../helpers/fake-electron');

describe('main process baseline behavior', () => {
  test('uses secure BrowserWindow web preferences', () => {
    const options = getWindowOptions('/app');

    expect(options.width).toBe(1280);
    expect(options.height).toBe(820);
    expect(options.minWidth).toBeGreaterThanOrEqual(900);
    expect(options.minHeight).toBeGreaterThanOrEqual(600);
    expect(options.autoHideMenuBar).toBe(false);
    expect(options.webPreferences).toMatchObject({
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    });
    expect(options.webPreferences.preload).toBe(
      path.join('/app', 'src', 'preload', 'chatgpt.js')
    );
    expect(options.webPreferences.partition).toBe('persist:chatgpt-default');
  });

  test('loads the official ChatGPT URL by default', () => {
    const FakeBrowserWindow = createFakeBrowserWindowClass();

    const win = createWindow({
      BrowserWindow: FakeBrowserWindow,
      shell: { openExternal: vi.fn() },
      baseDir: '/app'
    });

    expect(CHATGPT_URL).toBe('https://chatgpt.com');
    expect(win.loadedUrl).toBe(CHATGPT_URL);
  });

  test('loads the configured validated ChatGPT URL', () => {
    const FakeBrowserWindow = createFakeBrowserWindowClass();
    const settingsManager = {
      get: vi.fn(() => ({
        chatgptUrl: 'https://chat.openai.com/',
        zoomFactor: 1.2
      }))
    };

    const win = createWindow({
      BrowserWindow: FakeBrowserWindow,
      shell: { openExternal: vi.fn() },
      settingsManager,
      baseDir: '/app'
    });

    expect(win.loadedUrl).toBe('https://chat.openai.com/');
    expect(win.webContents.setZoomFactor).toHaveBeenCalledWith(1.2);
  });

  test('uses an isolated persistent session partition for the configured profile', () => {
    const FakeBrowserWindow = createFakeBrowserWindowClass();
    const settingsManager = {
      get: vi.fn(() => ({
        chatgptUrl: 'https://chatgpt.com',
        profile: 'work',
        zoomFactor: 1
      }))
    };

    const win = createWindow({
      BrowserWindow: FakeBrowserWindow,
      shell: { openExternal: vi.fn() },
      settingsManager,
      baseDir: '/app'
    });

    expect(getProfilePartition('work')).toBe('persist:chatgpt-work');
    expect(win.options.webPreferences.partition).toBe('persist:chatgpt-work');
  });

  test('restores persisted window state when creating the main window', () => {
    const FakeBrowserWindow = createFakeBrowserWindowClass();
    const windowStateManager = {
      load: vi.fn(() => ({
        width: 1100,
        height: 720,
        x: 30,
        y: 40,
        isMaximized: true,
        isFullScreen: true,
        zoomFactor: 1.35
      })),
      scheduleSaveFromWindow: vi.fn()
    };

    const win = createWindow({
      BrowserWindow: FakeBrowserWindow,
      shell: { openExternal: vi.fn() },
      windowStateManager,
      baseDir: '/app'
    });

    expect(win.options).toMatchObject({
      width: 1100,
      height: 720,
      x: 30,
      y: 40
    });
    expect(win.maximized).toBe(true);
    expect(win.fullScreen).toBe(true);
    expect(win.webContents.setZoomFactor).toHaveBeenCalledWith(1.35);
    expect(win.handlers.has('resize')).toBe(true);
    expect(win.handlers.has('close')).toBe(true);
  });

  test('uses a secure local settings window', () => {
    const options = getSettingsWindowOptions('/app');

    expect(options.webPreferences).toMatchObject({
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    });
    expect(options.webPreferences.preload).toBe(
      path.join('/app', 'src', 'preload', 'settings.js')
    );
  });

  test('loads settings UI from trusted local application files', () => {
    const FakeBrowserWindow = createFakeBrowserWindowClass();
    const win = createSettingsWindow({
      BrowserWindow: FakeBrowserWindow,
      baseDir: '/app'
    });

    expect(win.loadedFile).toBe(
      path.join('/app', 'src', 'renderer', 'settings.html')
    );
  });

  test('opens new windows externally and denies in-app popups', () => {
    const FakeBrowserWindow = createFakeBrowserWindowClass();
    const shell = { openExternal: vi.fn() };
    const win = createWindow({ BrowserWindow: FakeBrowserWindow, shell });

    const result = win.webContents.windowOpenHandler({
      url: 'https://example.com'
    });

    expect(shell.openExternal).toHaveBeenCalledWith('https://example.com/');
    expect(result).toEqual({ action: 'deny' });
  });

  test('registers explicit permission handlers on the main session', () => {
    const FakeBrowserWindow = createFakeBrowserWindowClass();
    const win = createWindow({
      BrowserWindow: FakeBrowserWindow,
      shell: { openExternal: vi.fn() }
    });

    expect(
      win.webContents.session.setPermissionRequestHandler
    ).toHaveBeenCalledWith(expect.any(Function));
    expect(
      win.webContents.session.setPermissionCheckHandler
    ).toHaveBeenCalledWith(expect.any(Function));
  });

  test('registers download handling on the main session', () => {
    const FakeBrowserWindow = createFakeBrowserWindowClass();
    const win = createWindow({
      BrowserWindow: FakeBrowserWindow,
      shell: { openExternal: vi.fn() }
    });

    expect(win.webContents.session.on).toHaveBeenCalledWith(
      'will-download',
      expect.any(Function)
    );
  });

  test('registers health monitoring on the main window', () => {
    const FakeBrowserWindow = createFakeBrowserWindowClass();
    const win = createWindow({
      BrowserWindow: FakeBrowserWindow,
      shell: { openExternal: vi.fn() }
    });

    expect(win.webContents.handlers.has('render-process-gone')).toBe(true);
    expect(win.handlers.has('unresponsive')).toBe(true);
    expect(win.handlers.has('responsive')).toBe(true);
  });

  test('handles F5 by preventing default and reloading', () => {
    const FakeBrowserWindow = createFakeBrowserWindowClass();
    const win = createWindow({
      BrowserWindow: FakeBrowserWindow,
      shell: { openExternal: vi.fn() }
    });
    const handler = win.webContents.handlers.get('before-input-event');
    const event = { preventDefault: vi.fn() };

    handler(event, { type: 'keyDown', key: 'F5' });

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(win.webContents.reload).toHaveBeenCalledOnce();
  });

  test('does not reload for unrelated key events', () => {
    const FakeBrowserWindow = createFakeBrowserWindowClass();
    const win = createWindow({
      BrowserWindow: FakeBrowserWindow,
      shell: { openExternal: vi.fn() }
    });
    const handler = win.webContents.handlers.get('before-input-event');
    const event = { preventDefault: vi.fn() };

    handler(event, { type: 'keyDown', key: 'A' });

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(win.webContents.reload).not.toHaveBeenCalled();
  });

  test('does not inject a permanent refresh button into the ChatGPT page', () => {
    const FakeBrowserWindow = createFakeBrowserWindowClass();
    const win = createWindow({
      BrowserWindow: FakeBrowserWindow,
      shell: { openExternal: vi.fn() }
    });

    expect(win.webContents.handlers.has('dom-ready')).toBe(false);
    expect(win.webContents.executeJavaScript).not.toHaveBeenCalled();
  });

  test('builds an editable context menu with paste support', () => {
    const Menu = {
      buildFromTemplate: vi.fn((template) => ({ template }))
    };

    const menu = createContextMenu({ isEditable: true }, Menu);

    expect(Menu.buildFromTemplate).toHaveBeenCalledOnce();
    expect(menu.template).toEqual(
      expect.arrayContaining([
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ])
    );
  });

  test('primary selection paste IPC inserts only Linux selection text', async () => {
    let handler;
    const ipcMain = {
      handle: vi.fn((_channel, callback) => {
        handler = callback;
      })
    };
    const clipboard = {
      readText: vi.fn(() => 'selected text')
    };
    const event = {
      sender: {
        insertText: vi.fn(() => Promise.resolve())
      }
    };

    registerPrimarySelectionPasteHandler({
      ipcMain,
      clipboard,
      platform: 'linux'
    });

    await expect(handler(event)).resolves.toBe(true);
    expect(ipcMain.handle).toHaveBeenCalledWith(
      'chatgpt-desktop:paste-primary-selection',
      expect.any(Function)
    );
    expect(clipboard.readText).toHaveBeenCalledWith('selection');
    expect(event.sender.insertText).toHaveBeenCalledWith('selected text');
  });

  test('primary selection paste IPC is disabled outside Linux', async () => {
    let handler;
    const ipcMain = {
      handle: vi.fn((_channel, callback) => {
        handler = callback;
      })
    };
    const clipboard = {
      readText: vi.fn(() => 'selected text')
    };
    const event = {
      sender: {
        insertText: vi.fn()
      }
    };

    registerPrimarySelectionPasteHandler({
      ipcMain,
      clipboard,
      platform: 'darwin'
    });

    await expect(handler(event)).resolves.toBe(false);
    expect(clipboard.readText).not.toHaveBeenCalled();
    expect(event.sender.insertText).not.toHaveBeenCalled();
  });
});
