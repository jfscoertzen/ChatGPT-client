const path = require('path');
const {
  CHATGPT_URL,
  createContextMenu,
  createWindow,
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
    expect(options.webPreferences).toMatchObject({
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    });
    expect(options.webPreferences.preload).toBe(
      path.join('/app', 'preload.js')
    );
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

  test('opens new windows externally and denies in-app popups', () => {
    const FakeBrowserWindow = createFakeBrowserWindowClass();
    const shell = { openExternal: vi.fn() };
    const win = createWindow({ BrowserWindow: FakeBrowserWindow, shell });

    const result = win.webContents.windowOpenHandler({
      url: 'https://example.com'
    });

    expect(shell.openExternal).toHaveBeenCalledWith('https://example.com');
    expect(result).toEqual({ action: 'deny' });
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
