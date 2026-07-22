/*
 * ChatGPT Desktop Wrapper
 * Developer: Stephan Coertzen <coertzen.jfs@gmail.com>
 * License: MIT
 */
const { contextBridge, ipcRenderer } = require('electron');

const settingsApi = {
  get: () => ipcRenderer.invoke('chatgpt-desktop:settings:get'),
  save: (settings) =>
    ipcRenderer.invoke('chatgpt-desktop:settings:save', settings),
  reset: () => ipcRenderer.invoke('chatgpt-desktop:settings:reset'),
  clearPermissions: () =>
    ipcRenderer.invoke('chatgpt-desktop:settings:permissions:clear'),
  clearCache: () => ipcRenderer.invoke('chatgpt-desktop:privacy:cache:clear'),
  clearCookies: () =>
    ipcRenderer.invoke('chatgpt-desktop:privacy:cookies:clear'),
  clearStorageData: () =>
    ipcRenderer.invoke('chatgpt-desktop:privacy:storage:clear'),
  signOutAndClearSessionData: () =>
    ipcRenderer.invoke('chatgpt-desktop:privacy:session:clear')
};

if (typeof contextBridge !== 'undefined') {
  contextBridge.exposeInMainWorld('chatgptSettings', settingsApi);
}

module.exports = {
  settingsApi
};
