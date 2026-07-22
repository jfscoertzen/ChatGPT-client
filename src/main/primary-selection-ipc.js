const electron = require('electron');

const { clipboard, ipcMain } = electron;

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

module.exports = {
  registerPrimarySelectionPasteHandler
};
