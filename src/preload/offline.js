/*
 * ChatGPT Desktop Wrapper
 * Developer: Stephan Coertzen
 * License: MIT
 */
const { contextBridge, ipcRenderer } = require('electron');

const offlineApi = {
  retry: () => ipcRenderer.invoke('chatgpt-desktop:offline:retry'),
  openInBrowser: () =>
    ipcRenderer.invoke('chatgpt-desktop:offline:open-browser')
};

if (typeof contextBridge !== 'undefined') {
  contextBridge.exposeInMainWorld('chatgptOffline', offlineApi);
}

module.exports = {
  offlineApi
};
