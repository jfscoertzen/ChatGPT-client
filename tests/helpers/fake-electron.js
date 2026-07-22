function createFakeBrowserWindowClass() {
  const windows = [];

  class FakeBrowserWindow {
    constructor(options) {
      this.options = options;
      this.loadedUrl = null;
      this.handlers = new Map();
      this.hide = vi.fn(() => {
        this.visible = false;
      });
      this.minimize = vi.fn(() => {
        this.minimized = true;
      });
      this.show = vi.fn(() => {
        this.visible = true;
      });
      this.focus = vi.fn();
      this.destroy = vi.fn(() => {
        this.destroyed = true;
      });
      this.restore = vi.fn(() => {
        this.minimized = false;
      });
      this.webContents = {
        handlers: new Map(),
        session: {
          handlers: new Map(),
          on: vi.fn((eventName, handler) => {
            this.webContents.session.handlers.set(eventName, handler);
          }),
          setPermissionCheckHandler: vi.fn(),
          setPermissionRequestHandler: vi.fn(),
          clearCache: vi.fn(() => Promise.resolve()),
          clearStorageData: vi.fn(() => Promise.resolve())
        },
        windowOpenHandler: null,
        executeJavaScript: vi.fn(() => Promise.resolve()),
        on: vi.fn((eventName, handler) => {
          this.webContents.handlers.set(eventName, handler);
        }),
        getURL: vi.fn(() => this.loadedUrl || ''),
        reload: vi.fn(),
        reloadIgnoringCache: vi.fn(),
        setZoomFactor: vi.fn(),
        setWindowOpenHandler: vi.fn((handler) => {
          this.webContents.windowOpenHandler = handler;
        })
      };
      windows.push(this);
    }

    getBounds() {
      return {
        x: this.options.x || 0,
        y: this.options.y || 0,
        width: this.options.width,
        height: this.options.height
      };
    }

    isMaximized() {
      return false;
    }

    isFullScreen() {
      return false;
    }

    isMinimized() {
      return Boolean(this.minimized);
    }

    isVisible() {
      return this.visible !== false;
    }

    isFocused() {
      return Boolean(this.focused);
    }

    maximize() {
      this.maximized = true;
    }

    setFullScreen(value) {
      this.fullScreen = value;
    }

    on(eventName, handler) {
      this.handlers.set(eventName, handler);
    }

    loadURL(url) {
      this.loadedUrl = url;
    }

    loadFile(filePath) {
      this.loadedFile = filePath;
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
