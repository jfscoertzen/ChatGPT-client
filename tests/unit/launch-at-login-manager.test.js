const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  LaunchAtLoginManager,
  buildAutostartDesktopEntry,
  quoteExecPath
} = require('../../src/main/launch-at-login-manager');

function createTempHome() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'chatgpt-autostart-test-'));
}

describe('launch at login manager', () => {
  test('quotes safe exec paths', () => {
    expect(quoteExecPath('/home/user/Applications/ChatGPT.AppImage')).toBe(
      '"/home/user/Applications/ChatGPT.AppImage"'
    );
    expect(quoteExecPath('/home/user/App"Name')).toBe(
      '"/home/user/App\\"Name"'
    );
  });

  test('autostart entry includes start-minimized when configured', () => {
    const entry = buildAutostartDesktopEntry({
      execPath: '/home/user/Applications/ChatGPT.AppImage',
      startMinimized: true
    });

    expect(entry).toContain(
      'Exec="/home/user/Applications/ChatGPT.AppImage" --start-minimized'
    );
    expect(entry).toContain('X-GNOME-Autostart-enabled=true');
  });

  test('writes an autostart entry', () => {
    const home = createTempHome();
    const manager = new LaunchAtLoginManager({
      env: { HOME: home },
      execPath: '/home/user/Applications/ChatGPT.AppImage'
    });

    manager.apply({ launchAtLogin: true, startMinimized: false });

    expect(fs.readFileSync(manager.autostartPath, 'utf8')).toContain(
      'Exec="/home/user/Applications/ChatGPT.AppImage"'
    );
  });

  test('removes an autostart entry', () => {
    const home = createTempHome();
    const manager = new LaunchAtLoginManager({
      env: { HOME: home },
      execPath: '/home/user/Applications/ChatGPT.AppImage'
    });

    manager.apply({ launchAtLogin: true, startMinimized: false });
    manager.apply({ launchAtLogin: false, startMinimized: false });

    expect(fs.existsSync(manager.autostartPath)).toBe(false);
  });

  test('rejects unsafe exec paths', () => {
    const home = createTempHome();
    const manager = new LaunchAtLoginManager({
      env: { HOME: home },
      execPath: '../relative'
    });

    expect(() =>
      manager.apply({ launchAtLogin: true, startMinimized: false })
    ).toThrow('absolute');
  });
});
