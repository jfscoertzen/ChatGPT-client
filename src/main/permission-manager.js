const { redactUrl } = require('./navigation-policy');

const TRUSTED_PERMISSION_HOSTS = new Set([
  'chatgpt.com',
  'chat.openai.com',
  'auth.openai.com',
  'auth0.openai.com',
  'platform.openai.com',
  'openai.com'
]);

const UNSUPPORTED_PERMISSIONS = new Set([
  'geolocation',
  'midi',
  'midiSysex',
  'serial',
  'usb'
]);

const SUPPORTED_PERMISSIONS = new Set([
  'clipboard-read',
  'clipboard-sanitized-write',
  'display-capture',
  'media',
  'microphone',
  'camera',
  'notifications'
]);

function parseOrigin(url) {
  try {
    const parsed = new URL(url);
    return parsed.origin;
  } catch {
    return null;
  }
}

function isTrustedOrigin(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    return (
      parsed.protocol === 'https:' &&
      (TRUSTED_PERMISSION_HOSTS.has(hostname) ||
        hostname.endsWith('.chatgpt.com') ||
        hostname.endsWith('.openai.com'))
    );
  } catch {
    return false;
  }
}

function normalizePermission(permission, details = {}) {
  if (permission === 'media') {
    const mediaTypes = new Set(details.mediaTypes || []);

    if (mediaTypes.has('audio') && mediaTypes.has('video')) {
      return 'media:audio-video';
    }

    if (mediaTypes.has('audio')) {
      return 'microphone';
    }

    if (mediaTypes.has('video')) {
      return 'camera';
    }
  }

  return permission;
}

function decisionKey({ permission, requestingUrl, details = {} }) {
  return [
    parseOrigin(requestingUrl) || 'unknown',
    normalizePermission(permission, details)
  ].join('|');
}

function decidePermissionRequest({
  permission,
  requestingUrl,
  details = {},
  settings = {}
}) {
  const normalizedPermission = normalizePermission(permission, details);

  if (!isTrustedOrigin(requestingUrl)) {
    return { allowed: false, remember: false };
  }

  if (
    UNSUPPORTED_PERMISSIONS.has(permission) ||
    UNSUPPORTED_PERMISSIONS.has(normalizedPermission)
  ) {
    return { allowed: false, remember: false };
  }

  if (
    !SUPPORTED_PERMISSIONS.has(permission) &&
    !SUPPORTED_PERMISSIONS.has(normalizedPermission)
  ) {
    return { allowed: false, remember: false };
  }

  if (normalizedPermission === 'notifications') {
    return { allowed: settings.enableNotifications !== false, remember: true };
  }

  return { allowed: true, remember: true };
}

class PermissionManager {
  constructor(options = {}) {
    this.settingsManager = options.settingsManager;
    this.logger = options.logger || console;
    this.rememberedDecisions = new Map();
  }

  getSettings() {
    if (
      this.settingsManager &&
      typeof this.settingsManager.get === 'function'
    ) {
      return this.settingsManager.get();
    }

    return {};
  }

  decide(request) {
    const key = decisionKey(request);

    if (this.rememberedDecisions.has(key)) {
      return this.rememberedDecisions.get(key);
    }

    const decision = decidePermissionRequest({
      ...request,
      settings: this.getSettings()
    });

    if (decision.remember) {
      this.rememberedDecisions.set(key, decision);
    }

    if (!decision.allowed) {
      this.logger.warn(
        `Denied permission ${request.permission} for ${redactUrl(
          request.requestingUrl || ''
        )}.`
      );
    }

    return decision;
  }

  clearRememberedDecisions() {
    this.rememberedDecisions.clear();
  }
}

function getRequestingUrl(webContents, details = {}) {
  if (details.requestingUrl) {
    return details.requestingUrl;
  }

  if (webContents && typeof webContents.getURL === 'function') {
    return webContents.getURL();
  }

  return '';
}

function registerPermissionHandlers(session, permissionManager) {
  session.setPermissionRequestHandler(
    (webContents, permission, callback, details = {}) => {
      const decision = permissionManager.decide({
        details,
        permission,
        requestingUrl: getRequestingUrl(webContents, details)
      });

      callback(decision.allowed);
    }
  );

  session.setPermissionCheckHandler(
    (webContents, permission, requestingOrigin) => {
      const decision = permissionManager.decide({
        permission,
        requestingUrl: requestingOrigin || getRequestingUrl(webContents)
      });

      return decision.allowed;
    }
  );
}

module.exports = {
  PermissionManager,
  decidePermissionRequest,
  isTrustedOrigin,
  normalizePermission,
  registerPermissionHandlers
};
