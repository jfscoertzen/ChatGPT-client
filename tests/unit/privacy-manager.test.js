const {
  CHATGPT_STORAGE_TYPES,
  PrivacyManager,
  registerPrivacyIpc
} = require('../../src/main/privacy-manager');

function createSession() {
  return {
    clearCache: vi.fn(() => Promise.resolve()),
    clearStorageData: vi.fn(() => Promise.resolve())
  };
}

describe('privacy manager', () => {
  test('clears cache on the active Electron session', async () => {
    const session = createSession();
    const manager = new PrivacyManager({ getSession: () => session });

    await expect(manager.clearCache()).resolves.toEqual({
      ok: true,
      action: 'clearCache'
    });

    expect(session.clearCache).toHaveBeenCalledOnce();
    expect(session.clearStorageData).not.toHaveBeenCalled();
  });

  test('clears cookies without clearing unrelated user-data files', async () => {
    const session = createSession();
    const manager = new PrivacyManager({ getSession: () => session });

    await expect(manager.clearCookies()).resolves.toEqual({
      ok: true,
      action: 'clearCookies'
    });

    expect(session.clearStorageData).toHaveBeenCalledWith({
      storages: ['cookies']
    });
  });

  test('clears profile storage data through Electron session storage APIs', async () => {
    const session = createSession();
    const manager = new PrivacyManager({ getSession: () => session });

    await expect(manager.clearStorageData()).resolves.toEqual({
      ok: true,
      action: 'clearStorageData'
    });

    expect(session.clearStorageData).toHaveBeenCalledWith({
      storages: [...CHATGPT_STORAGE_TYPES]
    });
  });

  test('clears remembered permissions through the permission manager', async () => {
    const permissionManager = {
      clearRememberedDecisions: vi.fn()
    };
    const manager = new PrivacyManager({
      getSession: () => createSession(),
      permissionManager
    });

    await expect(manager.clearRememberedPermissions()).resolves.toEqual({
      ok: true,
      action: 'clearRememberedPermissions'
    });

    expect(permissionManager.clearRememberedDecisions).toHaveBeenCalledOnce();
  });

  test('signs out by clearing cache and session storage, then reloads ChatGPT', async () => {
    const session = createSession();
    const win = { loadURL: vi.fn() };
    const manager = new PrivacyManager({
      getSession: () => session,
      getWindow: () => win,
      settingsManager: {
        get: vi.fn(() => ({ chatgptUrl: 'https://chatgpt.com' }))
      }
    });

    await expect(manager.signOutAndClearSessionData()).resolves.toEqual({
      ok: true,
      action: 'signOutAndClearSessionData'
    });

    expect(session.clearCache).toHaveBeenCalledOnce();
    expect(session.clearStorageData).toHaveBeenCalledWith({
      storages: [...CHATGPT_STORAGE_TYPES]
    });
    expect(win.loadURL).toHaveBeenCalledWith('https://chatgpt.com');
  });

  test('throws a useful error when no active session exists', async () => {
    const manager = new PrivacyManager({ getSession: () => null });

    await expect(manager.clearCache()).rejects.toThrow(
      /No active Electron session/
    );
  });

  test('registers explicit privacy IPC channels', async () => {
    const handlers = new Map();
    const ipcMain = {
      handle: vi.fn((channel, handler) => {
        handlers.set(channel, handler);
      })
    };
    const manager = {
      clearCache: vi.fn(() => Promise.resolve({ ok: true })),
      clearCookies: vi.fn(() => Promise.resolve({ ok: true })),
      clearStorageData: vi.fn(() => Promise.resolve({ ok: true })),
      signOutAndClearSessionData: vi.fn(() => Promise.resolve({ ok: true }))
    };

    registerPrivacyIpc(manager, { ipcMain });

    await handlers.get('chatgpt-desktop:privacy:cache:clear')();
    await handlers.get('chatgpt-desktop:privacy:cookies:clear')();
    await handlers.get('chatgpt-desktop:privacy:storage:clear')();
    await handlers.get('chatgpt-desktop:privacy:session:clear')();

    expect(manager.clearCache).toHaveBeenCalledOnce();
    expect(manager.clearCookies).toHaveBeenCalledOnce();
    expect(manager.clearStorageData).toHaveBeenCalledOnce();
    expect(manager.signOutAndClearSessionData).toHaveBeenCalledOnce();
  });
});
