const {
  DEFAULT_PROFILE,
  ProfileManager,
  getProfileArg,
  getProfilePartition,
  isValidProfileName,
  normalizeProfileName
} = require('../../src/main/profile-manager');

describe('profile manager', () => {
  test('generates the default profile and partition', () => {
    expect(DEFAULT_PROFILE).toBe('default');
    expect(normalizeProfileName()).toBe('default');
    expect(normalizeProfileName('')).toBe('default');
    expect(getProfilePartition()).toBe('persist:chatgpt-default');
  });

  test('accepts valid profile names', () => {
    expect(isValidProfileName('personal')).toBe(true);
    expect(isValidProfileName('work_1')).toBe(true);
    expect(isValidProfileName('team.dev')).toBe(true);
    expect(normalizeProfileName(' work-2 ')).toBe('work-2');
  });

  test('rejects path traversal attempts', () => {
    expect(() => normalizeProfileName('../secret')).toThrow(/path traversal/);
    expect(() => normalizeProfileName('work/secret')).toThrow(/path traversal/);
    expect(() => normalizeProfileName('work\\secret')).toThrow(
      /path traversal/
    );
  });

  test('rejects invalid characters', () => {
    expect(() => normalizeProfileName('work profile')).toThrow(
      /invalid characters/
    );
    expect(() => normalizeProfileName('work$')).toThrow(/invalid characters/);
    expect(() => normalizeProfileName('-work')).toThrow(/invalid characters/);
  });

  test('separate profiles produce separate session partitions', () => {
    expect(getProfilePartition('personal')).toBe('persist:chatgpt-personal');
    expect(getProfilePartition('work')).toBe('persist:chatgpt-work');
    expect(getProfilePartition('personal')).not.toBe(
      getProfilePartition('work')
    );
  });

  test('reads profile names from CLI arguments', () => {
    expect(getProfileArg(['node', 'main.js', '--profile', 'work'])).toBe(
      'work'
    );
    expect(getProfileArg(['node', 'main.js', '--profile=personal'])).toBe(
      'personal'
    );
  });

  test('prefers CLI profile over settings profile', () => {
    const manager = new ProfileManager({
      argv: ['node', 'main.js', '--profile=work'],
      settingsManager: {
        get: vi.fn(() => ({ profile: 'personal' }))
      }
    });

    expect(manager.getProfileName()).toBe('work');
    expect(manager.getPartition()).toBe('persist:chatgpt-work');
  });

  test('falls back to default when the configured profile is unsafe', () => {
    const logger = { warn: vi.fn() };
    const manager = new ProfileManager({
      argv: [],
      logger,
      settingsManager: {
        get: vi.fn(() => ({ profile: '../secret' }))
      }
    });

    expect(manager.getProfileName()).toBe('default');
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('Profile validation')
    );
  });
});
