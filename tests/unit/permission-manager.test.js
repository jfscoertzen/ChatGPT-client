const {
  PermissionManager,
  decidePermissionRequest,
  registerPermissionHandlers
} = require('../../src/main/permission-manager');

function createSession() {
  return {
    setPermissionCheckHandler: vi.fn(),
    setPermissionRequestHandler: vi.fn()
  };
}

describe('permission manager', () => {
  test('trusted-origin microphone requests follow configured policy', () => {
    expect(
      decidePermissionRequest({
        permission: 'media',
        requestingUrl: 'https://chatgpt.com',
        details: { mediaTypes: ['audio'] },
        settings: { enableNotifications: true }
      })
    ).toEqual({ allowed: true, remember: true });
  });

  test('trusted-origin camera requests follow configured policy', () => {
    expect(
      decidePermissionRequest({
        permission: 'media',
        requestingUrl: 'https://chatgpt.com',
        details: { mediaTypes: ['video'] },
        settings: { enableNotifications: true }
      })
    ).toEqual({ allowed: true, remember: true });
  });

  test('untrusted-origin permissions are denied', () => {
    expect(
      decidePermissionRequest({
        permission: 'media',
        requestingUrl: 'https://example.com',
        details: { mediaTypes: ['audio'] },
        settings: { enableNotifications: true }
      })
    ).toEqual({ allowed: false, remember: false });
  });

  test('unsupported permissions are denied', () => {
    expect(
      decidePermissionRequest({
        permission: 'serial',
        requestingUrl: 'https://chatgpt.com',
        settings: { enableNotifications: true }
      })
    ).toEqual({ allowed: false, remember: false });
  });

  test('notifications respect settings', () => {
    expect(
      decidePermissionRequest({
        permission: 'notifications',
        requestingUrl: 'https://chatgpt.com',
        settings: { enableNotifications: false }
      })
    ).toEqual({ allowed: false, remember: true });
  });

  test('stored decisions can be cleared', () => {
    const manager = new PermissionManager({
      settingsManager: {
        get: () => ({ enableNotifications: true })
      }
    });

    manager.decide({
      permission: 'media',
      requestingUrl: 'https://chatgpt.com',
      details: { mediaTypes: ['audio'] }
    });

    expect(manager.rememberedDecisions.size).toBe(1);

    manager.clearRememberedDecisions();

    expect(manager.rememberedDecisions.size).toBe(0);
  });

  test('registers Electron permission handlers', () => {
    const session = createSession();
    const manager = new PermissionManager({
      settingsManager: {
        get: () => ({ enableNotifications: true })
      }
    });

    registerPermissionHandlers(session, manager);

    expect(session.setPermissionRequestHandler).toHaveBeenCalledWith(
      expect.any(Function)
    );
    expect(session.setPermissionCheckHandler).toHaveBeenCalledWith(
      expect.any(Function)
    );
  });

  test('request handler returns decisions through Electron callback', () => {
    const session = createSession();
    const callback = vi.fn();
    const webContents = { getURL: vi.fn(() => 'https://chatgpt.com') };
    const manager = new PermissionManager({
      settingsManager: {
        get: () => ({ enableNotifications: true })
      }
    });

    registerPermissionHandlers(session, manager);
    session.setPermissionRequestHandler.mock.calls[0][0](
      webContents,
      'media',
      callback,
      { mediaTypes: ['audio'] }
    );

    expect(callback).toHaveBeenCalledWith(true);
  });
});
