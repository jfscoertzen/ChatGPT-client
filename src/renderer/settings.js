const fields = {
  chatgptUrl: document.querySelector('#chatgpt-url'),
  closeToTray: document.querySelector('#close-to-tray'),
  startMinimized: document.querySelector('#start-minimized'),
  launchAtLogin: document.querySelector('#launch-at-login'),
  enableNotifications: document.querySelector('#enable-notifications'),
  globalShortcut: document.querySelector('#global-shortcut'),
  zoomFactor: document.querySelector('#zoom-factor'),
  profile: document.querySelector('#profile')
};

const form = document.querySelector('#settings-form');
const clearPermissionsButton = document.querySelector(
  '#clear-permissions-button'
);
const clearCacheButton = document.querySelector('#clear-cache-button');
const clearCookiesButton = document.querySelector('#clear-cookies-button');
const clearStorageButton = document.querySelector('#clear-storage-button');
const signOutButton = document.querySelector('#sign-out-button');
const resetButton = document.querySelector('#reset-button');
const status = document.querySelector('#status');

function setStatus(message) {
  status.textContent = message;
}

async function runConfirmedAction(message, action, successMessage) {
  try {
    const result = await window.chatgptConfirmAction.runConfirmedAction({
      confirmFn: window.confirm,
      message,
      action
    });

    if (result.confirmed) {
      setStatus(successMessage);
    }
  } catch (error) {
    setStatus(`Action failed: ${error.message}`);
  }
}

function applySettings(settings) {
  fields.chatgptUrl.value = settings.chatgptUrl;
  fields.closeToTray.checked = settings.closeToTray;
  fields.startMinimized.checked = settings.startMinimized;
  fields.launchAtLogin.checked = settings.launchAtLogin;
  fields.enableNotifications.checked = settings.enableNotifications;
  fields.globalShortcut.value = settings.globalShortcut;
  fields.zoomFactor.value = settings.zoomFactor;
  fields.profile.value = settings.profile;
}

function readSettings() {
  return {
    chatgptUrl: fields.chatgptUrl.value,
    closeToTray: fields.closeToTray.checked,
    startMinimized: fields.startMinimized.checked,
    launchAtLogin: fields.launchAtLogin.checked,
    enableNotifications: fields.enableNotifications.checked,
    globalShortcut: fields.globalShortcut.value,
    zoomFactor: Number(fields.zoomFactor.value),
    profile: fields.profile.value
  };
}

async function loadSettings() {
  const settings = await window.chatgptSettings.get();
  applySettings(settings);
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  try {
    const settings = await window.chatgptSettings.save(readSettings());
    applySettings(settings);
    setStatus('Saved.');
  } catch (error) {
    setStatus(`Could not save settings: ${error.message}`);
  }
});

resetButton.addEventListener('click', async () => {
  if (!window.confirm('Reset application settings to defaults?')) {
    return;
  }

  try {
    const settings = await window.chatgptSettings.reset();
    applySettings(settings);
    setStatus('Defaults restored.');
  } catch (error) {
    setStatus(`Could not reset settings: ${error.message}`);
  }
});

clearPermissionsButton.addEventListener('click', async () => {
  await runConfirmedAction(
    'Clear remembered permission decisions?',
    () => window.chatgptSettings.clearPermissions(),
    'Remembered permission decisions cleared.'
  );
});

clearCacheButton.addEventListener('click', async () => {
  await runConfirmedAction(
    'Clear the active profile cache?',
    () => window.chatgptSettings.clearCache(),
    'Cache cleared.'
  );
});

clearCookiesButton.addEventListener('click', async () => {
  await runConfirmedAction(
    'Clear cookies for the active profile? This may sign you out.',
    () => window.chatgptSettings.clearCookies(),
    'Cookies cleared.'
  );
});

clearStorageButton.addEventListener('click', async () => {
  await runConfirmedAction(
    'Clear local storage data for the active profile? This may sign you out.',
    () => window.chatgptSettings.clearStorageData(),
    'Storage data cleared.'
  );
});

signOutButton.addEventListener('click', async () => {
  await runConfirmedAction(
    'Sign out and clear local session data for the active profile?',
    () => window.chatgptSettings.signOutAndClearSessionData(),
    'Session data cleared.'
  );
});

loadSettings().catch((error) => {
  setStatus(`Could not load settings: ${error.message}`);
});
