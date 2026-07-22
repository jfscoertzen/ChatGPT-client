const path = require('path');
const {
  DiagnosticsManager,
  collectAllowedEnvironment,
  parseOsRelease,
  sanitizeCommandLine,
  sanitizeLogs,
  sanitizeSettings,
  sanitizeText
} = require('../../src/main/diagnostics-manager');

function createFs() {
  return {
    files: new Map(),
    readFileSync: vi.fn((filePath) => {
      if (filePath === '/etc/os-release') {
        return 'PRETTY_NAME="Ubuntu 22.04"\nID=ubuntu\nVERSION_ID="22.04"\n';
      }

      if (filePath.endsWith('package.json')) {
        return JSON.stringify({ version: '1.2.3' });
      }

      return '';
    }),
    writeFileSync: vi.fn(function writeFile(filePath, content) {
      this.files.set(filePath, content);
    })
  };
}

describe('diagnostics manager', () => {
  test('redacts tokens and sensitive URL parameters', () => {
    expect(sanitizeText('url https://chatgpt.com/?token=secret&ok=1')).toBe(
      'url https://chatgpt.com/?token=REDACTED&ok=1'
    );
    expect(sanitizeText('access_token=secret')).toBe('access_token=REDACTED');
  });

  test('excludes cookies and authentication fields from settings', () => {
    expect(
      sanitizeSettings({
        chatgptUrl: 'https://chatgpt.com/?code=secret',
        profile: 'work',
        cookies: ['private'],
        accessToken: 'secret',
        nested: {
          refreshToken: 'secret',
          enabled: true
        }
      })
    ).toEqual({
      chatgptUrl: 'https://chatgpt.com/?code=REDACTED',
      profile: 'work',
      cookies: '[REDACTED]',
      accessToken: '[REDACTED]',
      nested: {
        refreshToken: '[REDACTED]',
        enabled: true
      }
    });
  });

  test('removes conversation-like content from logs', () => {
    expect(
      sanitizeLogs([
        { level: 'warn', message: 'User: private chat text' },
        { level: 'info', message: 'Renderer recovered' }
      ])
    ).toEqual([
      { level: 'warn', message: '[REDACTED]' },
      { level: 'info', message: 'Renderer recovered' }
    ]);
  });

  test('retains only allowed environment information', () => {
    expect(
      collectAllowedEnvironment({
        XDG_CURRENT_DESKTOP: 'GNOME',
        XDG_SESSION_TYPE: 'wayland',
        HOME: '/home/person',
        SSH_AUTH_SOCK: '/tmp/private'
      })
    ).toEqual({
      XDG_CURRENT_DESKTOP: 'GNOME',
      XDG_SESSION_TYPE: 'wayland'
    });
  });

  test('sanitizes command-line arguments', () => {
    expect(
      sanitizeCommandLine([
        'chatgpt',
        '--profile=work',
        'https://chatgpt.com/?session=secret'
      ])
    ).toEqual([
      'chatgpt',
      '--profile=work',
      'https://chatgpt.com/?session=REDACTED'
    ]);
  });

  test('parses Linux distribution metadata', () => {
    expect(
      parseOsRelease(
        'PRETTY_NAME="Pop!_OS 22.04 LTS"\nID=pop\nVERSION_ID=22.04'
      )
    ).toEqual({
      name: 'Pop!_OS 22.04 LTS',
      id: 'pop',
      version: '22.04'
    });
  });

  test('collects a sanitized diagnostics payload', () => {
    const fs = createFs();
    const manager = new DiagnosticsManager({
      app: {
        getName: vi.fn(() => 'ChatGPT'),
        getVersion: vi.fn(() => '1.0.5'),
        commandLine: {
          hasSwitch: vi.fn(() => true)
        }
      },
      baseDir: '/app',
      fs,
      healthManager: {
        getLogEntries: vi.fn(() => [
          { level: 'warn', message: 'failed https://chatgpt.com/?token=secret' }
        ])
      },
      process: {
        arch: 'x64',
        argv: ['chatgpt', '--safe-mode'],
        env: {
          XDG_CURRENT_DESKTOP: 'GNOME',
          XDG_SESSION_TYPE: 'wayland',
          HOME: '/home/private'
        },
        platform: 'linux',
        versions: {
          chrome: '138',
          electron: '37',
          node: '24'
        }
      },
      settingsManager: {
        get: vi.fn(() => ({
          chatgptUrl: 'https://chatgpt.com/?code=secret',
          cookies: ['private'],
          profile: 'work'
        }))
      }
    });

    expect(manager.collect()).toMatchObject({
      app: {
        name: 'ChatGPT',
        version: '1.0.5'
      },
      runtime: {
        electron: '37',
        chromium: '138',
        node: '24'
      },
      system: {
        architecture: 'x64',
        desktopEnvironment: 'GNOME',
        sessionType: 'wayland',
        gpuAccelerationDisabled: true,
        linuxDistribution: {
          name: 'Ubuntu 22.04',
          id: 'ubuntu',
          version: '22.04'
        }
      },
      environment: {
        XDG_CURRENT_DESKTOP: 'GNOME',
        XDG_SESSION_TYPE: 'wayland'
      },
      settings: {
        chatgptUrl: 'https://chatgpt.com/?code=REDACTED',
        cookies: '[REDACTED]',
        profile: 'work'
      },
      logs: [
        {
          level: 'warn',
          message: 'failed https://chatgpt.com/?token=REDACTED'
        }
      ]
    });
    expect(JSON.stringify(manager.collect())).not.toContain('/home/private');
    expect(JSON.stringify(manager.collect())).not.toContain('secret');
  });

  test('exports diagnostics to the user-selected path', async () => {
    const fs = createFs();
    const outputPath = path.join('/tmp', 'chatgpt-diagnostics.json');
    const manager = new DiagnosticsManager({
      app: {
        getName: vi.fn(() => 'ChatGPT'),
        getPath: vi.fn(() => '/tmp'),
        getVersion: vi.fn(() => '1.0.5')
      },
      dialog: {
        showSaveDialog: vi.fn(() =>
          Promise.resolve({ canceled: false, filePath: outputPath })
        )
      },
      fs,
      process: {
        arch: 'x64',
        argv: ['chatgpt'],
        env: {},
        platform: 'linux',
        versions: {}
      }
    });

    await expect(manager.exportDiagnostics()).resolves.toEqual({
      ok: true,
      filePath: outputPath
    });

    expect(fs.writeFileSync).toHaveBeenCalledWith(
      outputPath,
      expect.stringContaining('"app"'),
      'utf8'
    );
  });

  test('does not write when export is cancelled', async () => {
    const fs = createFs();
    const manager = new DiagnosticsManager({
      dialog: {
        showSaveDialog: vi.fn(() => Promise.resolve({ canceled: true }))
      },
      fs
    });

    await expect(manager.exportDiagnostics()).resolves.toEqual({
      ok: false,
      canceled: true
    });
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });
});
