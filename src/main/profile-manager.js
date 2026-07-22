const DEFAULT_PROFILE = 'default';
const PROFILE_NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

function isValidProfileName(value) {
  return typeof value === 'string' && PROFILE_NAME_PATTERN.test(value);
}

function normalizeProfileName(value = DEFAULT_PROFILE) {
  if (value === undefined || value === null || value === '') {
    return DEFAULT_PROFILE;
  }

  if (typeof value !== 'string') {
    throw new Error('Profile name must be a string.');
  }

  const name = value.trim();
  if (!name) {
    return DEFAULT_PROFILE;
  }

  if (name.includes('/') || name.includes('\\') || name.includes('..')) {
    throw new Error('Profile name must not contain path traversal.');
  }

  if (!isValidProfileName(name)) {
    throw new Error('Profile name contains invalid characters.');
  }

  return name;
}

function getProfilePartition(profileName = DEFAULT_PROFILE) {
  return `persist:chatgpt-${normalizeProfileName(profileName)}`;
}

function getProfileArg(argv = []) {
  const profileFlag = argv.find((arg) => arg === '--profile');
  if (profileFlag) {
    const index = argv.indexOf(profileFlag);
    return argv[index + 1];
  }

  const prefixedProfile = argv.find((arg) => arg.startsWith('--profile='));
  if (prefixedProfile) {
    return prefixedProfile.slice('--profile='.length);
  }

  return null;
}

class ProfileManager {
  constructor(options = {}) {
    this.argv = options.argv || process.argv;
    this.logger = options.logger || console;
    this.settingsManager = options.settingsManager;
  }

  getProfileName() {
    const requestedProfile =
      getProfileArg(this.argv) || this.settingsManager?.get?.().profile;

    try {
      return normalizeProfileName(requestedProfile);
    } catch (error) {
      this.logger.warn(`Profile validation: ${error.message}`);
      return DEFAULT_PROFILE;
    }
  }

  getPartition() {
    return getProfilePartition(this.getProfileName());
  }
}

module.exports = {
  DEFAULT_PROFILE,
  ProfileManager,
  getProfileArg,
  getProfilePartition,
  isValidProfileName,
  normalizeProfileName
};
