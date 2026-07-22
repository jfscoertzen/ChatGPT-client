const {
  createTrayMenu,
  focusMainWindow,
  initializeTray
} = require('../../src/main/tray-manager');
const { retainTrayManager } = require('../../main');
const { createFakeBrowserWindowClass } = require('../helpers/fake-electron');

function createMenu() {
  return {
    buildFromTemplate: vi.fn((template) => ({ template }))
  };
}

function createTrayClass() {
  const instances = [];

  class FakeTray {
    constructor(icon) {
      this.icon = icon;
      this.handlers = new Map();
      this.setToolTip = vi.fn();
      this.setContextMenu = vi.fn();
      this.on = vi.fn((eventName, handler) => {
        this.handlers.set(eventName, handler);
      });
      instances.push(this);
    }
  }

  FakeTray.instances = instances;
  return FakeTray;
}

describe('tray manager', () => {
  test('retains tray manager references for Electron tray lifetime', () => {
    const manager = { tray: {} };

    expect(retainTrayManager(manager)).toBe(manager);
  });

  test('builds the expected tray menu', () => {
    const Menu = createMenu();
    const actions = {
      openChatGpt: vi.fn(),
      newChat: vi.fn(),
      reload: vi.fn(),
      openSettings: vi.fn(),
      quit: vi.fn()
    };

    const menu = createTrayMenu(actions, Menu);

    expect(menu.template.map((item) => item.label || item.type)).toEqual([
      'Open ChatGPT',
      'New chat',
      'Reload',
      'Settings',
      'separator',
      'Quit'
    ]);

    menu.template[1].click();
    expect(actions.newChat).toHaveBeenCalledOnce();
  });

  test('focuses hidden or minimized windows', () => {
    const win = {
      isMinimized: vi.fn(() => true),
      isVisible: vi.fn(() => false),
      restore: vi.fn(),
      show: vi.fn(),
      focus: vi.fn()
    };

    focusMainWindow(win);

    expect(win.restore).toHaveBeenCalledOnce();
    expect(win.show).toHaveBeenCalledOnce();
    expect(win.focus).toHaveBeenCalledOnce();
  });

  test('initializes the tray without crashing', () => {
    const FakeBrowserWindow = createFakeBrowserWindowClass();
    const FakeTray = createTrayClass();
    const Menu = createMenu();
    const win = new FakeBrowserWindow({});

    const manager = initializeTray({
      win,
      Tray: FakeTray,
      Menu,
      nativeImage: { createFromPath: vi.fn((iconPath) => iconPath) },
      settingsManager: {
        get: vi.fn(() => ({ closeToTray: true, startMinimized: false }))
      }
    });

    expect(manager.tray).toBe(FakeTray.instances[0]);
    expect(manager.tray.setToolTip).toHaveBeenCalledWith('ChatGPT');
    expect(manager.tray.setContextMenu).toHaveBeenCalledWith(
      expect.objectContaining({ template: expect.any(Array) })
    );
  });

  test('gracefully disables tray support if tray creation fails', () => {
    const logger = { warn: vi.fn() };
    class BrokenTray {
      constructor() {
        throw new Error('tray unavailable');
      }
    }

    const manager = initializeTray({
      win: {},
      Tray: BrokenTray,
      Menu: createMenu(),
      nativeImage: { createFromPath: vi.fn((iconPath) => iconPath) },
      logger,
      settingsManager: {
        get: vi.fn(() => ({ closeToTray: true, startMinimized: false }))
      }
    });

    expect(manager.tray).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('tray unavailable')
    );
  });

  test('close-to-tray hides the window instead of closing it', () => {
    const FakeBrowserWindow = createFakeBrowserWindowClass();
    const FakeTray = createTrayClass();
    const win = new FakeBrowserWindow({});
    const event = { preventDefault: vi.fn() };

    initializeTray({
      win,
      Tray: FakeTray,
      Menu: createMenu(),
      nativeImage: { createFromPath: vi.fn((iconPath) => iconPath) },
      settingsManager: {
        get: vi.fn(() => ({ closeToTray: true, startMinimized: false }))
      }
    });

    win.handlers.get('close')(event);

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(win.hide).toHaveBeenCalledOnce();
  });

  test('explicit quit terminates the app instead of hiding the window', () => {
    const FakeBrowserWindow = createFakeBrowserWindowClass();
    const FakeTray = createTrayClass();
    const Menu = createMenu();
    const app = { quit: vi.fn() };
    const win = new FakeBrowserWindow({});
    const event = { preventDefault: vi.fn() };
    const manager = initializeTray({
      app,
      win,
      Tray: FakeTray,
      Menu,
      nativeImage: { createFromPath: vi.fn((iconPath) => iconPath) },
      settingsManager: {
        get: vi.fn(() => ({ closeToTray: true, startMinimized: false }))
      }
    });

    manager.actions.quit();
    win.handlers.get('close')(event);

    expect(app.quit).toHaveBeenCalledOnce();
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(win.hide).not.toHaveBeenCalled();
  });
});
