const electron = require('electron');
const { focusMainWindow } = require('./tray-manager');

class NotificationManager {
  constructor(options = {}) {
    this.Notification = options.Notification || electron.Notification;
    this.settingsManager = options.settingsManager;
    this.win = options.win;
    this.sentNotifications = new Set();
    this.wasOffline = false;
  }

  notificationsEnabled() {
    if (
      this.settingsManager &&
      typeof this.settingsManager.get === 'function'
    ) {
      return this.settingsManager.get().enableNotifications !== false;
    }

    return true;
  }

  showNotification(key, options) {
    if (!this.notificationsEnabled()) {
      return false;
    }

    if (this.sentNotifications.has(key)) {
      return false;
    }

    const notification = new this.Notification(options);
    notification.on('click', () => {
      focusMainWindow(this.win);
    });
    notification.show();
    this.sentNotifications.add(key);
    return true;
  }

  markOffline() {
    this.wasOffline = true;
    this.sentNotifications.delete('reconnected');
  }

  notifyReconnected() {
    if (!this.wasOffline) {
      return false;
    }

    const sent = this.showNotification('reconnected', {
      title: 'ChatGPT is ready',
      body: 'Connection restored.'
    });

    if (sent) {
      this.wasOffline = false;
    }

    return sent;
  }

  notifyDownloadComplete(record) {
    return this.showNotification(`download:${record.id}`, {
      title: 'Download complete',
      body: record.filename || 'Download finished.'
    });
  }
}

function createNotificationManager(dependencies = {}) {
  return new NotificationManager(dependencies);
}

module.exports = {
  NotificationManager,
  createNotificationManager
};
