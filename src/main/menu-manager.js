const electron = require('electron');
const { CHATGPT_URL } = require('./constants');
const { createSettingsWindow } = require('./settings-manager');
const { clampZoomFactor } = require('./window-state-manager');

const { Menu } = electron;
const PROJECT_REPOSITORY_URL = 'https://github.com/jfscoertzen/ChatGPT-client';
const PROFILE_MENU_ITEMS = ['default', 'personal', 'work'];

function createContextMenu(params, MenuImpl = Menu) {
  const template = [];

  if (params.isEditable) {
    template.push(
      { role: 'undo' },
      { role: 'redo' },
      { type: 'separator' },
      { role: 'cut' },
      { role: 'copy' },
      { role: 'paste' },
      { role: 'selectAll' }
    );
  } else if (params.selectionText) {
    template.push({ role: 'copy' });
  }

  return template.length > 0 ? MenuImpl.buildFromTemplate(template) : null;
}

function registerContextMenu(win, dependencies = {}) {
  const MenuImpl = dependencies.Menu || Menu;

  win.webContents.on('context-menu', (_event, params) => {
    const menu = createContextMenu(params, MenuImpl);

    if (menu) {
      menu.popup({ window: win });
    }
  });
}

function getZoom(win) {
  if (win.webContents && typeof win.webContents.getZoomFactor === 'function') {
    return win.webContents.getZoomFactor();
  }

  return 1;
}

function setZoom(win, zoomFactor) {
  if (win.webContents && typeof win.webContents.setZoomFactor === 'function') {
    win.webContents.setZoomFactor(
      clampZoomFactor(Number(zoomFactor.toFixed(2)))
    );
  }
}

function showOrHideWindow(win) {
  if (!win) {
    return;
  }

  if (typeof win.isVisible === 'function' && win.isVisible()) {
    if (typeof win.hide === 'function') {
      win.hide();
    }
    return;
  }

  if (typeof win.show === 'function') {
    win.show();
  }

  if (typeof win.focus === 'function') {
    win.focus();
  }
}

function shouldEnableDeveloperTools(options = {}) {
  return Boolean(options.isDevelopment || options.enableDeveloperTools);
}

function createApplicationMenu(options = {}, dependencies = {}) {
  const MenuImpl = dependencies.Menu || Menu;
  const shellImpl = dependencies.shell || electron.shell;
  const logger = dependencies.logger || console;
  const appImpl = options.app || dependencies.app || electron.app;
  const diagnosticsManager =
    options.diagnosticsManager || dependencies.diagnosticsManager;
  const onSelectProfile =
    options.onSelectProfile || dependencies.onSelectProfile;
  const win = options.win;
  const settings = options.settings || {};
  const chatgptUrl = settings.chatgptUrl || CHATGPT_URL;
  const currentProfile = settings.profile || 'default';
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Chat',
          accelerator: 'Ctrl+Shift+N',
          click: () => win && win.loadURL(chatgptUrl)
        },
        {
          label: 'Settings',
          click: () => createSettingsWindow({ ...dependencies, ...options })
        },
        {
          label: 'Profile',
          submenu: PROFILE_MENU_ITEMS.map((profile) => ({
            label: profile,
            type: 'radio',
            checked: currentProfile === profile,
            click: () => {
              if (typeof onSelectProfile === 'function') {
                onSelectProfile(profile);
              }
            }
          }))
        },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'Ctrl+Q',
          click: () => appImpl.quit()
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'Ctrl+R',
          click: () => win && win.webContents.reload()
        },
        {
          label: 'Force Reload',
          accelerator: 'Ctrl+Shift+R',
          click: () => {
            if (!win) {
              return;
            }

            if (typeof win.webContents.reloadIgnoringCache === 'function') {
              win.webContents.reloadIgnoringCache();
            } else {
              win.webContents.reload();
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Zoom In',
          accelerator: 'Ctrl+Plus',
          click: () => win && setZoom(win, getZoom(win) + 0.1)
        },
        {
          label: 'Zoom Out',
          accelerator: 'Ctrl+-',
          click: () => win && setZoom(win, getZoom(win) - 0.1)
        },
        {
          label: 'Actual Size',
          accelerator: 'Ctrl+0',
          click: () => win && setZoom(win, 1)
        },
        { type: 'separator' },
        {
          label: 'Toggle Fullscreen',
          role: 'togglefullscreen',
          click: () => {
            if (win && typeof win.setFullScreen === 'function') {
              win.setFullScreen(!win.isFullScreen());
            }
          }
        },
        ...(shouldEnableDeveloperTools(options)
          ? [
              { type: 'separator' },
              {
                label: 'Toggle Developer Tools',
                click: () => {
                  if (
                    win &&
                    win.webContents &&
                    typeof win.webContents.openDevTools === 'function'
                  ) {
                    win.webContents.openDevTools({ mode: 'detach' });
                  }
                }
              }
            ]
          : [])
      ]
    },
    {
      label: 'Window',
      submenu: [
        {
          label: 'Minimize',
          role: 'minimize',
          click: () => win && win.minimize()
        },
        {
          label: 'Show/Hide',
          click: () => showOrHideWindow(win)
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Open Project Repository',
          click: () => shellImpl.openExternal(PROJECT_REPOSITORY_URL)
        },
        {
          label: 'Export Diagnostics',
          enabled: Boolean(diagnosticsManager),
          click: async () => {
            if (!diagnosticsManager) {
              return;
            }

            try {
              await diagnosticsManager.exportDiagnostics(win);
            } catch (error) {
              logger.warn(`Could not export diagnostics: ${error.message}`);
            }
          }
        },
        {
          label: 'About',
          role: 'about'
        }
      ]
    }
  ];

  return MenuImpl.buildFromTemplate(template);
}

function registerApplicationMenu(options = {}, dependencies = {}) {
  const MenuImpl = dependencies.Menu || Menu;
  const menu = createApplicationMenu(options, dependencies);

  MenuImpl.setApplicationMenu(menu);
  return menu;
}

module.exports = {
  PROJECT_REPOSITORY_URL,
  PROFILE_MENU_ITEMS,
  createApplicationMenu,
  createContextMenu,
  registerApplicationMenu,
  registerContextMenu
};
