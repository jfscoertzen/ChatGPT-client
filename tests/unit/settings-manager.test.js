const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  DEFAULT_SETTINGS,
  SettingsManager,
  sanitizeSettings,
  validateChatGptUrl
} = require('../../src/main/settings-manager');

function createTempUserDataDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'chatgpt-settings-test-'));
}

describe('settings manager', () => {
  test('loads defaults when no settings file exists', () => {
    const userDataPath = createTempUserDataDir();
    const manager = new SettingsManager({ userDataPath });

    expect(manager.load()).toEqual(DEFAULT_SETTINGS);
  });

  test('loads valid settings', () => {
    const userDataPath = createTempUserDataDir();
    const settingsPath = path.join(userDataPath, 'settings.json');
    const settings = {
      chatgptUrl: 'https://chatgpt.com',
      closeToTray: false,
      startMinimized: true,
      launchAtLogin: true,
      enableNotifications: false,
      globalShortcut: 'Ctrl+Alt+G',
      zoomFactor: 1.25,
      profile: 'work'
    };

    fs.writeFileSync(settingsPath, JSON.stringify(settings), 'utf8');

    const manager = new SettingsManager({ userDataPath });
    expect(manager.load()).toEqual(settings);
  });

  test('merges missing fields with defaults', () => {
    const userDataPath = createTempUserDataDir();
    fs.writeFileSync(
      path.join(userDataPath, 'settings.json'),
      JSON.stringify({ closeToTray: false }),
      'utf8'
    );

    const manager = new SettingsManager({ userDataPath });

    expect(manager.load()).toEqual({
      ...DEFAULT_SETTINGS,
      closeToTray: false
    });
  });

  test('rejects invalid values and keeps safe defaults', () => {
    const result = sanitizeSettings({
      chatgptUrl: 'javascript:alert(1)',
      closeToTray: 'yes',
      startMinimized: 'no',
      launchAtLogin: 'true',
      enableNotifications: 1,
      globalShortcut: '',
      zoomFactor: 100,
      profile: '../secrets'
    });

    expect(result.settings).toEqual(DEFAULT_SETTINGS);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('chatgptUrl'),
        expect.stringContaining('closeToTray'),
        expect.stringContaining('profile')
      ])
    );
  });

  test('recovers safely from malformed JSON', () => {
    const userDataPath = createTempUserDataDir();
    const settingsPath = path.join(userDataPath, 'settings.json');
    const logger = { warn: vi.fn(), error: vi.fn() };

    fs.writeFileSync(settingsPath, '{bad json', 'utf8');

    const manager = new SettingsManager({ userDataPath, logger });

    expect(manager.load()).toEqual(DEFAULT_SETTINGS);
    expect(fs.existsSync(settingsPath)).toBe(false);
    expect(
      fs
        .readdirSync(userDataPath)
        .some((file) => file.startsWith('settings.malformed-'))
    ).toBe(true);
    expect(logger.warn).toHaveBeenCalled();
  });

  test('writes settings atomically', () => {
    const userDataPath = createTempUserDataDir();
    const manager = new SettingsManager({ userDataPath });

    manager.save({ closeToTray: false, profile: 'work' });

    expect(JSON.parse(fs.readFileSync(manager.settingsPath, 'utf8'))).toEqual({
      ...DEFAULT_SETTINGS,
      closeToTray: false,
      profile: 'work'
    });
    expect(
      fs.readdirSync(userDataPath).some((file) => file.endsWith('.tmp'))
    ).toBe(false);
  });

  test('settings save syncs launch-at-login state when configured', async () => {
    let handler;
    const userDataPath = createTempUserDataDir();
    const manager = new SettingsManager({ userDataPath });
    const launchAtLoginManager = { apply: vi.fn() };
    const ipcMain = {
      handle: vi.fn((channel, callback) => {
        if (channel === 'chatgpt-desktop:settings:save') {
          handler = callback;
        }
      })
    };
    const { registerSettingsIpc } = require('../../src/main/settings-manager');

    registerSettingsIpc(manager, { ipcMain, launchAtLoginManager });
    await handler({}, { launchAtLogin: true, startMinimized: true });

    expect(launchAtLoginManager.apply).toHaveBeenCalledWith(
      expect.objectContaining({
        launchAtLogin: true,
        startMinimized: true
      })
    );
  });

  test('settings save reports profile changes for restart handling', async () => {
    let handler;
    const userDataPath = createTempUserDataDir();
    const manager = new SettingsManager({ userDataPath });
    const onSettingsSaved = vi.fn();
    const ipcMain = {
      handle: vi.fn((channel, callback) => {
        if (channel === 'chatgpt-desktop:settings:save') {
          handler = callback;
        }
      })
    };
    const { registerSettingsIpc } = require('../../src/main/settings-manager');

    registerSettingsIpc(manager, { ipcMain, onSettingsSaved });
    await handler({}, { profile: 'work' });

    expect(onSettingsSaved).toHaveBeenCalledWith(
      expect.objectContaining({ profile: 'work' }),
      expect.objectContaining({ profile: 'default' })
    );
  });

  test('rejects unsafe ChatGPT URLs', () => {
    expect(validateChatGptUrl('https://chatgpt.com')).toEqual({
      ok: true,
      url: 'https://chatgpt.com'
    });
    expect(validateChatGptUrl('https://auth.openai.com/login')).toEqual({
      ok: true,
      url: 'https://auth.openai.com/login'
    });
    expect(validateChatGptUrl('http://chatgpt.com')).toMatchObject({
      ok: false
    });
    expect(validateChatGptUrl('https://example.com')).toMatchObject({
      ok: false
    });
    expect(validateChatGptUrl('file:///tmp/test')).toMatchObject({
      ok: false
    });
  });
});
