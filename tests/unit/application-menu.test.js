const {
  createApplicationMenu,
  registerApplicationMenu
} = require('../../src/main/menu-manager');

function createWindow() {
  return {
    hidden: false,
    fullScreen: false,
    isVisible: vi.fn(() => true),
    isFullScreen: vi.fn(() => false),
    hide: vi.fn(),
    show: vi.fn(),
    focus: vi.fn(),
    minimize: vi.fn(),
    setFullScreen: vi.fn(),
    loadURL: vi.fn(),
    webContents: {
      reload: vi.fn(),
      reloadIgnoringCache: vi.fn(),
      getZoomFactor: vi.fn(() => 1),
      setZoomFactor: vi.fn(),
      openDevTools: vi.fn()
    }
  };
}

function createMenu() {
  return {
    buildFromTemplate: vi.fn((template) => ({ template })),
    setApplicationMenu: vi.fn()
  };
}

function findMenu(menu, label) {
  return menu.template.find((item) => item.label === label);
}

function findSubmenuItem(menu, menuLabel, itemLabel) {
  return findMenu(menu, menuLabel).submenu.find(
    (item) => item.label === itemLabel
  );
}

function findNestedSubmenuItem(menu, menuLabel, submenuLabel, itemLabel) {
  return findSubmenuItem(menu, menuLabel, submenuLabel).submenu.find(
    (item) => item.label === itemLabel
  );
}

describe('native application menu', () => {
  test('builds the expected top-level menus', () => {
    const Menu = createMenu();
    const menu = createApplicationMenu({ win: createWindow() }, { Menu });

    expect(menu.template.map((item) => item.label)).toEqual([
      'File',
      'View',
      'Window',
      'Help'
    ]);
  });

  test('menu actions call the expected window methods', () => {
    const Menu = createMenu();
    const win = createWindow();
    const app = { quit: vi.fn() };
    const menu = createApplicationMenu(
      { app, win, settings: { chatgptUrl: 'https://chatgpt.com' } },
      { Menu }
    );

    findSubmenuItem(menu, 'File', 'New Chat').click();
    findSubmenuItem(menu, 'View', 'Reload').click();
    findSubmenuItem(menu, 'View', 'Force Reload').click();
    findSubmenuItem(menu, 'View', 'Zoom In').click();
    findSubmenuItem(menu, 'View', 'Zoom Out').click();
    findSubmenuItem(menu, 'View', 'Actual Size').click();
    findSubmenuItem(menu, 'View', 'Toggle Fullscreen').click();
    findSubmenuItem(menu, 'Window', 'Minimize').click();
    findSubmenuItem(menu, 'Window', 'Show/Hide').click();
    findSubmenuItem(menu, 'File', 'Quit').click();

    expect(win.loadURL).toHaveBeenCalledWith('https://chatgpt.com');
    expect(win.webContents.reload).toHaveBeenCalledOnce();
    expect(win.webContents.reloadIgnoringCache).toHaveBeenCalledOnce();
    expect(win.webContents.setZoomFactor).toHaveBeenNthCalledWith(1, 1.1);
    expect(win.webContents.setZoomFactor).toHaveBeenNthCalledWith(2, 0.9);
    expect(win.webContents.setZoomFactor).toHaveBeenNthCalledWith(3, 1);
    expect(win.setFullScreen).toHaveBeenCalledWith(true);
    expect(win.minimize).toHaveBeenCalledOnce();
    expect(win.hide).toHaveBeenCalledOnce();
    expect(app.quit).toHaveBeenCalledOnce();
  });

  test('opens the project repository from the Help menu', () => {
    const Menu = createMenu();
    const shell = { openExternal: vi.fn() };
    const menu = createApplicationMenu(
      { win: createWindow() },
      { Menu, shell }
    );

    findSubmenuItem(menu, 'Help', 'Open Project Repository').click();

    expect(shell.openExternal).toHaveBeenCalledWith(
      'https://github.com/jfscoertzen/ChatGPT-client'
    );
  });

  test('shows profile management in the File menu', () => {
    const Menu = createMenu();
    const onSelectProfile = vi.fn();
    const menu = createApplicationMenu(
      {
        onSelectProfile,
        settings: { profile: 'work' },
        win: createWindow()
      },
      { Menu }
    );
    const defaultProfile = findNestedSubmenuItem(
      menu,
      'File',
      'Profile',
      'default'
    );
    const workProfile = findNestedSubmenuItem(menu, 'File', 'Profile', 'work');

    expect(workProfile.checked).toBe(true);
    defaultProfile.click();
    expect(onSelectProfile).toHaveBeenCalledWith('default');
  });

  test('exports diagnostics from the Help menu', async () => {
    const Menu = createMenu();
    const win = createWindow();
    const diagnosticsManager = {
      exportDiagnostics: vi.fn(() => Promise.resolve({ ok: true }))
    };
    const menu = createApplicationMenu({ diagnosticsManager, win }, { Menu });
    const item = findSubmenuItem(menu, 'Help', 'Export Diagnostics');

    expect(item.enabled).toBe(true);
    await item.click();

    expect(diagnosticsManager.exportDiagnostics).toHaveBeenCalledWith(win);
  });

  test('keeps diagnostics export disabled until diagnostics are wired', () => {
    const Menu = createMenu();
    const menu = createApplicationMenu({ win: createWindow() }, { Menu });

    expect(findSubmenuItem(menu, 'Help', 'Export Diagnostics').enabled).toBe(
      false
    );
  });

  test('developer tools are hidden outside development builds', () => {
    const Menu = createMenu();
    const menu = createApplicationMenu(
      { win: createWindow(), isDevelopment: false },
      { Menu }
    );

    expect(
      findSubmenuItem(menu, 'View', 'Toggle Developer Tools')
    ).toBeUndefined();
  });

  test('developer tools can be enabled explicitly', () => {
    const Menu = createMenu();
    const win = createWindow();
    const menu = createApplicationMenu({ win, isDevelopment: true }, { Menu });

    findSubmenuItem(menu, 'View', 'Toggle Developer Tools').click();

    expect(win.webContents.openDevTools).toHaveBeenCalledWith({
      mode: 'detach'
    });
  });

  test('registers the application menu with Electron', () => {
    const Menu = createMenu();

    const menu = registerApplicationMenu({ win: createWindow() }, { Menu });

    expect(Menu.setApplicationMenu).toHaveBeenCalledWith(menu);
  });
});
