const {
  NotificationManager,
  createNotificationManager
} = require('../../src/main/notification-manager');

function createNotificationClass() {
  const instances = [];

  class FakeNotification {
    constructor(options) {
      this.options = options;
      this.handlers = new Map();
      this.show = vi.fn();
      this.on = vi.fn((eventName, handler) => {
        this.handlers.set(eventName, handler);
      });
      instances.push(this);
    }
  }

  FakeNotification.instances = instances;
  return FakeNotification;
}

function createWindow() {
  return {
    isMinimized: vi.fn(() => false),
    isVisible: vi.fn(() => false),
    restore: vi.fn(),
    show: vi.fn(),
    focus: vi.fn()
  };
}

describe('notification manager', () => {
  test('notifications respect settings', () => {
    const Notification = createNotificationClass();
    const manager = new NotificationManager({
      Notification,
      settingsManager: {
        get: () => ({ enableNotifications: false })
      },
      win: createWindow()
    });

    expect(manager.notifyDownloadComplete({ filename: 'report.txt' })).toBe(
      false
    );
    expect(Notification.instances).toHaveLength(0);
  });

  test('download notification sends once', () => {
    const Notification = createNotificationClass();
    const manager = new NotificationManager({
      Notification,
      settingsManager: {
        get: () => ({ enableNotifications: true })
      },
      win: createWindow()
    });
    const record = { id: 'download-1', filename: 'report.txt' };

    expect(manager.notifyDownloadComplete(record)).toBe(true);
    expect(manager.notifyDownloadComplete(record)).toBe(false);
    expect(Notification.instances).toHaveLength(1);
    expect(Notification.instances[0].options).toMatchObject({
      title: 'Download complete',
      body: 'report.txt'
    });
  });

  test('reconnection notification sends once per outage', () => {
    const Notification = createNotificationClass();
    const manager = new NotificationManager({
      Notification,
      settingsManager: {
        get: () => ({ enableNotifications: true })
      },
      win: createWindow()
    });

    manager.markOffline();

    expect(manager.notifyReconnected()).toBe(true);
    expect(manager.notifyReconnected()).toBe(false);
    expect(Notification.instances).toHaveLength(1);
    expect(Notification.instances[0].options.title).toBe('ChatGPT is ready');
  });

  test('notification click focuses the window', () => {
    const Notification = createNotificationClass();
    const win = createWindow();
    const manager = new NotificationManager({
      Notification,
      settingsManager: {
        get: () => ({ enableNotifications: true })
      },
      win
    });

    manager.notifyDownloadComplete({
      id: 'download-1',
      filename: 'report.txt'
    });
    Notification.instances[0].handlers.get('click')();

    expect(win.show).toHaveBeenCalledOnce();
    expect(win.focus).toHaveBeenCalledOnce();
  });

  test('factory returns a notification manager', () => {
    const manager = createNotificationManager({
      Notification: createNotificationClass(),
      settingsManager: {
        get: () => ({ enableNotifications: true })
      },
      win: createWindow()
    });

    expect(manager).toBeInstanceOf(NotificationManager);
  });
});
