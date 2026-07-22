const {
  decideNavigation,
  redactUrl,
  registerNavigationPolicy
} = require('../../src/main/navigation-policy');

function createWebContents() {
  const handlers = new Map();

  return {
    handlers,
    setWindowOpenHandler: vi.fn((handler) => {
      handlers.set('window-open', handler);
    }),
    on: vi.fn((eventName, handler) => {
      handlers.set(eventName, handler);
    })
  };
}

describe('navigation policy', () => {
  test('allows trusted ChatGPT URLs inside the app', () => {
    expect(decideNavigation('https://chatgpt.com/c/123')).toEqual({
      action: 'allow'
    });
    expect(decideNavigation('https://chat.openai.com/auth/login')).toEqual({
      action: 'allow'
    });
  });

  test('allows required OpenAI authentication URLs inside the app', () => {
    expect(decideNavigation('https://auth.openai.com/login')).toEqual({
      action: 'allow'
    });
    expect(decideNavigation('https://auth0.openai.com/u/login')).toEqual({
      action: 'allow'
    });
    expect(
      decideNavigation('https://platform.openai.com/auth/callback')
    ).toEqual({
      action: 'allow'
    });
  });

  test('allows Google OAuth URLs required by OpenAI sign-in inside the app', () => {
    expect(
      decideNavigation(
        'https://accounts.google.com/v3/signin/identifier?app_domain=https://auth.openai.com&client_id=abc.apps.googleusercontent.com'
      )
    ).toEqual({ action: 'allow' });
    expect(
      decideNavigation('https://oauth2.googleapis.com/tokeninfo?id_token=abc')
    ).toEqual({ action: 'allow' });
  });

  test('allows Apple and Microsoft OAuth URLs required by OpenAI sign-in inside the app', () => {
    expect(
      decideNavigation(
        'https://appleid.apple.com/auth/authorize?client_id=com.openai.chat'
      )
    ).toEqual({ action: 'allow' });
    expect(
      decideNavigation(
        'https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=openai'
      )
    ).toEqual({ action: 'allow' });
    expect(
      decideNavigation(
        'https://login.live.com/oauth20_authorize.srf?client_id=openai'
      )
    ).toEqual({ action: 'allow' });
  });

  test('opens external HTTPS links in the system browser', () => {
    expect(decideNavigation('https://example.com/docs')).toEqual({
      action: 'external',
      url: 'https://example.com/docs'
    });
  });

  test('allows trusted blob URLs used for generated downloads', () => {
    expect(
      decideNavigation('blob:https://chatgpt.com/9f1f2e7a-3a2e-4f8a')
    ).toEqual({ action: 'allow' });
    expect(
      decideNavigation('blob:https://auth.openai.com/9f1f2e7a-3a2e-4f8a')
    ).toEqual({ action: 'allow' });
  });

  test('blocks untrusted blob URLs', () => {
    expect(decideNavigation('blob:https://example.com/9f1f2e7a')).toEqual({
      action: 'block',
      reason: 'untrusted blob origin'
    });
  });

  test('blocks javascript URLs', () => {
    expect(decideNavigation('javascript:alert(1)')).toEqual({
      action: 'block',
      reason: 'unsafe protocol'
    });
  });

  test('blocks file URLs', () => {
    expect(decideNavigation('file:///tmp/secret.txt')).toEqual({
      action: 'block',
      reason: 'unsafe protocol'
    });
  });

  test('blocks unknown schemes', () => {
    expect(decideNavigation('unknown-scheme://example')).toEqual({
      action: 'block',
      reason: 'unsupported protocol'
    });
  });

  test('redacts sensitive URL parameters from logs', () => {
    expect(
      redactUrl(
        'https://auth.openai.com/login?token=abc&code=123&state=ok&email=a@example.com'
      )
    ).toBe(
      'https://auth.openai.com/login?token=REDACTED&code=REDACTED&state=REDACTED&email=REDACTED'
    );
  });

  test('window-open allows trusted popups inside the app', () => {
    const shell = { openExternal: vi.fn() };
    const webContents = createWebContents();

    registerNavigationPolicy({ webContents }, { shell });

    const result = webContents.handlers.get('window-open')({
      url: 'https://auth.openai.com/login'
    });

    expect(result).toEqual({ action: 'allow' });
    expect(shell.openExternal).not.toHaveBeenCalled();
  });

  test('window-open redirects external HTTPS URLs to the system browser', () => {
    const shell = { openExternal: vi.fn() };
    const webContents = createWebContents();

    registerNavigationPolicy({ webContents }, { shell });

    const result = webContents.handlers.get('window-open')({
      url: 'https://example.com'
    });

    expect(shell.openExternal).toHaveBeenCalledWith('https://example.com/');
    expect(result).toEqual({ action: 'deny' });
  });

  test('will-navigate allows trusted destinations', () => {
    const event = { preventDefault: vi.fn() };
    const shell = { openExternal: vi.fn() };
    const webContents = createWebContents();

    registerNavigationPolicy({ webContents }, { shell });

    webContents.handlers.get('will-navigate')(
      event,
      'https://chatgpt.com/c/123'
    );

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(shell.openExternal).not.toHaveBeenCalled();
  });

  test('will-navigate keeps Google OAuth inside the application', () => {
    const event = { preventDefault: vi.fn() };
    const shell = { openExternal: vi.fn() };
    const webContents = createWebContents();

    registerNavigationPolicy({ webContents }, { shell });

    webContents.handlers.get('will-navigate')(
      event,
      'https://accounts.google.com/signin/oauth/legacy/consent?client_id=abc.apps.googleusercontent.com'
    );

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(shell.openExternal).not.toHaveBeenCalled();
  });

  test('will-navigate redirects arbitrary HTTPS destinations externally', () => {
    const event = { preventDefault: vi.fn() };
    const shell = { openExternal: vi.fn() };
    const webContents = createWebContents();

    registerNavigationPolicy({ webContents }, { shell });

    webContents.handlers.get('will-navigate')(event, 'https://example.com');

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(shell.openExternal).toHaveBeenCalledWith('https://example.com/');
  });

  test('will-navigate blocks unsafe destinations without opening externally', () => {
    const event = { preventDefault: vi.fn() };
    const shell = { openExternal: vi.fn() };
    const logger = { warn: vi.fn() };
    const webContents = createWebContents();

    registerNavigationPolicy({ webContents }, { shell, logger });

    webContents.handlers.get('will-navigate')(event, 'file:///tmp/secret.txt');

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(shell.openExternal).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('file://')
    );
  });
});
