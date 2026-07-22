const {
  DEFAULT_GLOBAL_SHORTCUT,
  registerGlobalShortcut,
  registerLocalShortcuts,
  toggleMainWindow
} = require('../../src/main/shortcut-manager');

function createWindow() {
  const handlers = new Map();

  return {
    handlers,
    isFocused: vi.fn(() => false),
    isMinimized: vi.fn(() => false),
    isVisible: vi.fn(() => true),
    hide: vi.fn(),
    show: vi.fn(),
    focus: vi.fn(),
    restore: vi.fn(),
    loadURL: vi.fn(),
    webContents: {
      on: vi.fn((eventName, handler) => {
        handlers.set(eventName, handler);
      }),
      reload: vi.fn(),
      reloadIgnoringCache: vi.fn(),
      getZoomFactor: vi.fn(() => 1),
      setZoomFactor: vi.fn()
    }
  };
}

function triggerShortcut(win, input) {
  const event = { preventDefault: vi.fn() };
  win.handlers.get('before-input-event')(event, {
    type: 'keyDown',
    ...input
  });
  return event;
}

describe('shortcut manager', () => {
  test('registers F5 reload handling', () => {
    const win = createWindow();

    registerLocalShortcuts(win);
    const event = triggerShortcut(win, { key: 'F5' });

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(win.webContents.reload).toHaveBeenCalledOnce();
  });

  test('registers Ctrl+R reload handling', () => {
    const win = createWindow();

    registerLocalShortcuts(win);
    const event = triggerShortcut(win, { key: 'r', control: true });

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(win.webContents.reload).toHaveBeenCalledOnce();
  });

  test('registers Ctrl+Shift+R force reload handling', () => {
    const win = createWindow();

    registerLocalShortcuts(win);
    const event = triggerShortcut(win, {
      key: 'R',
      control: true,
      shift: true
    });

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(win.webContents.reloadIgnoringCache).toHaveBeenCalledOnce();
  });

  test('registers Ctrl+Shift+N new chat handling', () => {
    const win = createWindow();

    registerLocalShortcuts(win, { chatgptUrl: 'https://chatgpt.com' });
    const event = triggerShortcut(win, {
      key: 'N',
      control: true,
      shift: true
    });

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(win.loadURL).toHaveBeenCalledWith('https://chatgpt.com');
  });

  test('registers zoom shortcuts', () => {
    const win = createWindow();

    registerLocalShortcuts(win);
    triggerShortcut(win, { key: '+', control: true });
    triggerShortcut(win, { key: '-', control: true });
    triggerShortcut(win, { key: '0', control: true });

    expect(win.webContents.setZoomFactor).toHaveBeenNthCalledWith(1, 1.1);
    expect(win.webContents.setZoomFactor).toHaveBeenNthCalledWith(2, 0.9);
    expect(win.webContents.setZoomFactor).toHaveBeenNthCalledWith(3, 1);
  });

  test('ignores unrelated key events', () => {
    const win = createWindow();

    registerLocalShortcuts(win);
    const event = triggerShortcut(win, { key: 'A' });

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(win.webContents.reload).not.toHaveBeenCalled();
  });

  test('global shortcut registration succeeds with configured accelerator', () => {
    const win = createWindow();
    const globalShortcut = {
      register: vi.fn(() => true),
      unregisterAll: vi.fn()
    };
    const app = { on: vi.fn() };

    expect(
      registerGlobalShortcut(win, {
        app,
        globalShortcut,
        settings: { globalShortcut: 'Ctrl+Alt+G' }
      })
    ).toBe(true);
    expect(globalShortcut.register).toHaveBeenCalledWith(
      'Ctrl+Alt+G',
      expect.any(Function)
    );
    expect(app.on).toHaveBeenCalledWith('will-quit', expect.any(Function));
  });

  test('global shortcut registration failure logs a warning and does not crash', () => {
    const logger = { warn: vi.fn() };
    const globalShortcut = {
      register: vi.fn(() => false),
      unregisterAll: vi.fn()
    };

    expect(
      registerGlobalShortcut(createWindow(), {
        globalShortcut,
        logger,
        settings: { globalShortcut: 'Ctrl+Alt+G' }
      })
    ).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Ctrl+Alt+G')
    );
  });

  test('global shortcuts unregister on app exit', () => {
    let willQuit;
    const globalShortcut = {
      register: vi.fn(() => true),
      unregisterAll: vi.fn()
    };
    const app = {
      on: vi.fn((_eventName, handler) => {
        willQuit = handler;
      })
    };

    registerGlobalShortcut(createWindow(), { app, globalShortcut });
    willQuit();

    expect(globalShortcut.unregisterAll).toHaveBeenCalledOnce();
  });

  test('global shortcut toggles the main window', () => {
    const win = createWindow();
    win.isVisible.mockReturnValue(true);
    win.isFocused.mockReturnValue(true);

    toggleMainWindow(win);

    expect(win.hide).toHaveBeenCalledOnce();

    win.isVisible.mockReturnValue(false);
    win.isFocused.mockReturnValue(false);
    toggleMainWindow(win);

    expect(win.show).toHaveBeenCalledOnce();
    expect(win.focus).toHaveBeenCalledOnce();
  });

  test('uses the default global shortcut when none is configured', () => {
    const globalShortcut = {
      register: vi.fn(() => true),
      unregisterAll: vi.fn()
    };

    registerGlobalShortcut(createWindow(), { globalShortcut });

    expect(globalShortcut.register).toHaveBeenCalledWith(
      DEFAULT_GLOBAL_SHORTCUT,
      expect.any(Function)
    );
  });
});
