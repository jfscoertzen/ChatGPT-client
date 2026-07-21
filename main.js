/*
 * ChatGPT Desktop Wrapper
 * Developer: Stephan Coertzen <coertzen.jfs@gmail.com>
 * License: MIT
 */
const path = require('path');
const electron = require('electron');

const { app, BrowserWindow, Menu, clipboard, ipcMain, shell } = electron;
const CHATGPT_URL = 'https://chatgpt.com';

const REFRESH_BUTTON_SCRIPT = `
(() => {
  const hostId = 'chatgpt-desktop-refresh-host';

  if (document.getElementById(hostId)) {
    return;
  }

  const host = document.createElement('div');
  host.id = hostId;
  host.style.position = 'fixed';
  host.style.top = '64px';
  host.style.right = '14px';
  host.style.zIndex = '2147483647';

  const shadow = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = [
    'button {',
    '  align-items: center;',
    '  background: rgba(255, 255, 255, 0.92);',
    '  border: 1px solid rgba(0, 0, 0, 0.16);',
    '  border-radius: 8px;',
    '  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.16);',
    '  color: #111827;',
    '  cursor: pointer;',
    '  display: inline-flex;',
    '  height: 36px;',
    '  justify-content: center;',
    '  padding: 0;',
    '  width: 36px;',
    '}',
    'button:hover { background: #ffffff; }',
    'button:active { transform: translateY(1px); }',
    'button:focus-visible { outline: 2px solid #2563eb; outline-offset: 2px; }',
    'svg { height: 18px; width: 18px; }',
    '@media (prefers-color-scheme: dark) {',
    '  button {',
    '    background: rgba(31, 41, 55, 0.92);',
    '    border-color: rgba(255, 255, 255, 0.2);',
    '    color: #f9fafb;',
    '  }',
    '  button:hover { background: #374151; }',
    '}'
  ].join('\\n');

  const button = document.createElement('button');
  button.type = 'button';
  button.title = 'Refresh';
  button.setAttribute('aria-label', 'Refresh ChatGPT');

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');

  for (const d of ['M21 12a9 9 0 1 1-2.64-6.36', 'M21 3v6h-6']) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
  }

  button.appendChild(svg);
  button.addEventListener('click', () => {
    window.location.reload();
  });

  shadow.append(style, button);
  document.documentElement.appendChild(host);
})();
`;

function injectRefreshButton(win) {
  win.webContents.executeJavaScript(REFRESH_BUTTON_SCRIPT).catch(() => {
    // The page can briefly reject injection while navigating; the next load retries it.
  });
}

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

function getWindowOptions(baseDir = __dirname) {
  return {
    width: 1280,
    height: 820,
    minWidth: 980,
    minHeight: 640,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(baseDir, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  };
}

function createWindow(dependencies = {}) {
  const BrowserWindowImpl = dependencies.BrowserWindow || BrowserWindow;
  const shellImpl = dependencies.shell || shell;
  const win = new BrowserWindowImpl(getWindowOptions(dependencies.baseDir));

  win.webContents.setWindowOpenHandler(({ url }) => {
    shellImpl.openExternal(url);
    return { action: 'deny' };
  });

  win.webContents.on('context-menu', (_event, params) => {
    const menu = createContextMenu(params);

    if (menu) {
      menu.popup({ window: win });
    }
  });

  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown' && input.key === 'F5') {
      event.preventDefault();
      win.webContents.reload();
    }
  });

  win.webContents.on('dom-ready', () => {
    injectRefreshButton(win);
  });

  win.loadURL(CHATGPT_URL);
  return win;
}

function registerPrimarySelectionPasteHandler(dependencies = {}) {
  const ipcMainImpl = dependencies.ipcMain || ipcMain;
  const clipboardImpl = dependencies.clipboard || clipboard;
  const platform = dependencies.platform || process.platform;

  ipcMainImpl.handle(
    'chatgpt-desktop:paste-primary-selection',
    async (event) => {
      if (platform !== 'linux') {
        return false;
      }

      const text = clipboardImpl.readText('selection');

      if (!text) {
        return false;
      }

      try {
        await event.sender.insertText(text);
        return true;
      } catch {
        return false;
      }
    }
  );
}

function startApp(dependencies = {}) {
  const appImpl = dependencies.app || app;
  const BrowserWindowImpl = dependencies.BrowserWindow || BrowserWindow;

  registerPrimarySelectionPasteHandler(dependencies);

  appImpl.whenReady().then(() => {
    createWindow(dependencies);

    appImpl.on('activate', () => {
      if (BrowserWindowImpl.getAllWindows().length === 0) {
        createWindow(dependencies);
      }
    });
  });

  appImpl.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      appImpl.quit();
    }
  });
}

if (require.main === module) {
  startApp();
}

module.exports = {
  CHATGPT_URL,
  REFRESH_BUTTON_SCRIPT,
  createContextMenu,
  createWindow,
  getWindowOptions,
  injectRefreshButton,
  registerPrimarySelectionPasteHandler,
  startApp
};
