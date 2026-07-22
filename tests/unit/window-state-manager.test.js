const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  DEFAULT_WINDOW_STATE,
  WindowStateManager,
  clampZoomFactor,
  normalizeWindowState
} = require('../../src/main/window-state-manager');

const displays = [
  {
    bounds: { x: 0, y: 0, width: 1920, height: 1080 },
    workArea: { x: 0, y: 0, width: 1920, height: 1040 }
  },
  {
    bounds: { x: 1920, y: 0, width: 1280, height: 1024 },
    workArea: { x: 1920, y: 0, width: 1280, height: 984 }
  }
];

function createTempUserDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'chatgpt-window-state-test-'));
}

describe('window state manager', () => {
  test('restores valid window bounds', () => {
    const state = normalizeWindowState(
      {
        width: 1100,
        height: 760,
        x: 120,
        y: 80,
        isMaximized: true,
        isFullScreen: false,
        zoomFactor: 1.25
      },
      { displays }
    );

    expect(state).toEqual({
      width: 1100,
      height: 760,
      x: 120,
      y: 80,
      isMaximized: true,
      isFullScreen: false,
      zoomFactor: 1.25
    });
  });

  test('corrects off-screen bounds', () => {
    const state = normalizeWindowState(
      {
        width: 1100,
        height: 760,
        x: -5000,
        y: 100
      },
      { displays }
    );

    expect(state.x).toBe(0);
    expect(state.y).toBe(0);
  });

  test('falls back to the primary display when a monitor is disconnected', () => {
    const state = normalizeWindowState(
      {
        width: 1000,
        height: 700,
        x: 2400,
        y: 100
      },
      { displays: [displays[0]] }
    );

    expect(state.x).toBe(0);
    expect(state.y).toBe(0);
  });

  test('replaces invalid dimensions with defaults', () => {
    const state = normalizeWindowState(
      {
        width: 100,
        height: Number.NaN,
        x: 10,
        y: 10
      },
      { displays }
    );

    expect(state.width).toBe(DEFAULT_WINDOW_STATE.width);
    expect(state.height).toBe(DEFAULT_WINDOW_STATE.height);
  });

  test('clamps zoom factor to a safe range', () => {
    expect(clampZoomFactor(0.1)).toBe(0.5);
    expect(clampZoomFactor(4)).toBe(3);
    expect(clampZoomFactor(1.4)).toBe(1.4);
    expect(clampZoomFactor('large')).toBe(1);
  });

  test('loads persisted state from disk', () => {
    const userDataPath = createTempUserDataDir();
    fs.writeFileSync(
      path.join(userDataPath, 'window-state.json'),
      JSON.stringify({
        width: 1000,
        height: 720,
        x: 40,
        y: 50,
        zoomFactor: 1.1
      }),
      'utf8'
    );

    const manager = new WindowStateManager({
      userDataPath,
      screen: { getAllDisplays: () => displays }
    });

    expect(manager.load()).toMatchObject({
      width: 1000,
      height: 720,
      x: 40,
      y: 50,
      zoomFactor: 1.1
    });
  });

  test('saves bounds and visual state from a window', () => {
    const userDataPath = createTempUserDataDir();
    const manager = new WindowStateManager({
      userDataPath,
      screen: { getAllDisplays: () => displays },
      debounceMs: 0
    });
    const win = {
      getBounds: vi.fn(() => ({ x: 20, y: 30, width: 1200, height: 800 })),
      isMaximized: vi.fn(() => true),
      isFullScreen: vi.fn(() => false),
      webContents: {
        getZoomFactor: vi.fn(() => 1.3)
      }
    };

    manager.saveFromWindow(win);

    expect(JSON.parse(fs.readFileSync(manager.statePath, 'utf8'))).toEqual({
      width: 1200,
      height: 800,
      x: 20,
      y: 30,
      isMaximized: true,
      isFullScreen: false,
      zoomFactor: 1.3
    });
  });
});
