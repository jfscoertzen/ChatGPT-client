function createFakeBrowserWindowClass() {
  const windows = [];

  class FakeBrowserWindow {
    constructor(options) {
      this.options = options;
      this.loadedUrl = null;
      this.webContents = {
        handlers: new Map(),
        windowOpenHandler: null,
        executeJavaScript: vi.fn(() => Promise.resolve()),
        on: vi.fn((eventName, handler) => {
          this.webContents.handlers.set(eventName, handler);
        }),
        reload: vi.fn(),
        setWindowOpenHandler: vi.fn((handler) => {
          this.webContents.windowOpenHandler = handler;
        })
      };
      windows.push(this);
    }

    loadURL(url) {
      this.loadedUrl = url;
    }

    static getAllWindows() {
      return windows;
    }
  }

  FakeBrowserWindow.windows = windows;
  return FakeBrowserWindow;
}

module.exports = {
  createFakeBrowserWindowClass
};
