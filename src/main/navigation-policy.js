const electron = require('electron');

const TRUSTED_HOSTS = new Set([
  'chatgpt.com',
  'chat.openai.com',
  'auth.openai.com',
  'auth0.openai.com',
  'platform.openai.com',
  'openai.com',
  'appleid.apple.com',
  'accounts.google.com',
  'login.live.com',
  'login.microsoftonline.com',
  'oauth2.googleapis.com'
]);

const SENSITIVE_QUERY_KEYS = new Set([
  'access_token',
  'auth',
  'code',
  'email',
  'id_token',
  'login_hint',
  'password',
  'refresh_token',
  'session',
  'state',
  'token'
]);

function parseUrl(url) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function isTrustedHost(hostname) {
  const normalized = hostname.toLowerCase();

  return (
    TRUSTED_HOSTS.has(normalized) ||
    normalized.endsWith('.chatgpt.com') ||
    normalized.endsWith('.openai.com')
  );
}

function normalizeUrl(parsedUrl) {
  parsedUrl.hash = '';
  return parsedUrl.toString();
}

function getTrustedBlobOrigin(url) {
  if (!url.startsWith('blob:')) {
    return null;
  }

  const blobOrigin = parseUrl(url.slice('blob:'.length));

  if (!blobOrigin || blobOrigin.protocol !== 'https:') {
    return null;
  }

  return isTrustedHost(blobOrigin.hostname) ? blobOrigin : null;
}

function decideNavigation(url) {
  const parsedUrl = parseUrl(url);

  if (!parsedUrl) {
    return { action: 'block', reason: 'invalid URL' };
  }

  if (parsedUrl.protocol === 'blob:') {
    return getTrustedBlobOrigin(url)
      ? { action: 'allow' }
      : { action: 'block', reason: 'untrusted blob origin' };
  }

  if (['javascript:', 'file:', 'data:'].includes(parsedUrl.protocol)) {
    return { action: 'block', reason: 'unsafe protocol' };
  }

  if (parsedUrl.protocol !== 'https:') {
    return { action: 'block', reason: 'unsupported protocol' };
  }

  if (isTrustedHost(parsedUrl.hostname)) {
    return { action: 'allow' };
  }

  return {
    action: 'external',
    url: normalizeUrl(parsedUrl)
  };
}

function redactUrl(url) {
  const parsedUrl = parseUrl(url);

  if (!parsedUrl) {
    return '[invalid URL]';
  }

  for (const key of parsedUrl.searchParams.keys()) {
    if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) {
      parsedUrl.searchParams.set(key, 'REDACTED');
    }
  }

  parsedUrl.hash = '';
  return parsedUrl.toString();
}

function logBlockedNavigation(logger, url, reason) {
  logger.warn(`Blocked navigation (${reason}): ${redactUrl(url)}`);
}

function openExternal(shellImpl, logger, url) {
  try {
    shellImpl.openExternal(url);
  } catch (error) {
    logger.warn(
      `Could not open external URL: ${redactUrl(url)} ${error.message}`
    );
  }
}

function registerNavigationPolicy(win, dependencies = {}) {
  const shellImpl = dependencies.shell || electron.shell;
  const logger = dependencies.logger || console;

  win.webContents.setWindowOpenHandler(({ url }) => {
    const decision = decideNavigation(url);

    if (decision.action === 'allow') {
      return { action: 'allow' };
    }

    if (decision.action === 'external') {
      openExternal(shellImpl, logger, decision.url);
      return { action: 'deny' };
    }

    logBlockedNavigation(logger, url, decision.reason);
    return { action: 'deny' };
  });

  win.webContents.on('will-navigate', (event, url) => {
    const decision = decideNavigation(url);

    if (decision.action === 'allow') {
      return;
    }

    event.preventDefault();

    if (decision.action === 'external') {
      openExternal(shellImpl, logger, decision.url);
      return;
    }

    logBlockedNavigation(logger, url, decision.reason);
  });
}

module.exports = {
  decideNavigation,
  redactUrl,
  registerNavigationPolicy,
  registerWindowOpenHandler: registerNavigationPolicy
};
