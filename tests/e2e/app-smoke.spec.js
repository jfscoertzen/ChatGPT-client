const { test } = require('@playwright/test');

test.skip(
  !process.env.RUN_E2E,
  'Electron GUI smoke tests require RUN_E2E=1 and a desktop-capable environment.'
);

test('development Electron app starts and closes cleanly', async () => {
  const { _electron: electron } = require('@playwright/test');
  const app = await electron.launch({ args: ['.'] });

  try {
    await app.firstWindow();
  } finally {
    await app.close();
  }
});
