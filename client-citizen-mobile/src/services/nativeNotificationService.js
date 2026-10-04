/**
 * RESONIX AI — Native Android Notification Service Bridge
 * 
 * Responsibilities:
 * - Bridges React Native JavaScript to native Kotlin ResonixNotificationModule.
 * - Handles Android 13+ (API 33+) POST_NOTIFICATIONS runtime permission gracefully.
 * - Persists permission request status to avoid prompting on every app launch.
 * - Provides clean notification tap event emitter and initial notification retriever.
 * - Resilient fallback for non-native / test environments.
 */

let NativeModules = null;
let Platform = { OS: 'android', Version: 34 };
let PermissionsAndroid = null;
let DeviceEventEmitter = null;

try {
  const RN = require('react-native');
  NativeModules = RN.NativeModules;
  Platform = RN.Platform || Platform;
  PermissionsAndroid = RN.PermissionsAndroid;
  DeviceEventEmitter = RN.DeviceEventEmitter;
} catch (_) {
  // Safe mock for Node / test runtime
  DeviceEventEmitter = {
    addListener: () => ({ remove: () => {} }),
  };
}
const storage = require('../utils/storage');

const PERMISSION_ASKED_KEY = '@resonix_notification_permission_asked';
const ResonixNotification = NativeModules ? NativeModules.ResonixNotificationModule : null;

class NativeNotificationService {
  constructor() {
    this.tapListeners = new Set();
    this.initialNotification = null;
    this.isInitialized = false;

    if (DeviceEventEmitter) {
      DeviceEventEmitter.addListener('onNotificationTapped', (data) => {
        console.log('[NativeNotificationService] 📲 Notification tapped:', data);
        this.tapListeners.forEach((listener) => {
          try {
            listener(data);
          } catch (err) {
            console.warn('[NativeNotificationService] Tap listener error:', err.message);
          }
        });
      });
    }
  }

  /**
   * Initializes notification service, retrieves initial tap data if launched via notification
   */
  async init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    try {
      // 1. Check for notification that launched the app
      if (ResonixNotification && typeof ResonixNotification.getInitialNotification === 'function') {
        const initial = await ResonixNotification.getInitialNotification();
        if (initial) {
          this.initialNotification = initial;
          console.log('[NativeNotificationService] 🚀 App launched via notification:', initial);
        }
      }

      // 2. Request permission once if not previously prompted
      await this.requestPermissionOnce();
    } catch (err) {
      console.warn('[NativeNotificationService] Init error:', err.message);
    }
  }

  /**
   * Checks whether notifications are allowed
   */
  async checkPermission() {
    if (Platform.OS !== 'android') return true;

    try {
      if (ResonixNotification && typeof ResonixNotification.checkPermission === 'function') {
        return await ResonixNotification.checkPermission();
      }
      if (Platform.Version >= 33) {
        return await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      }
      return true;
    } catch (err) {
      console.warn('[NativeNotificationService] Check permission note:', err.message);
      return false;
    }
  }

  /**
   * Requests Android POST_NOTIFICATIONS permission at runtime (only prompts once)
   */
  async requestPermissionOnce() {
    if (Platform.OS !== 'android' || Platform.Version < 33) return true;

    try {
      const alreadyAsked = await storage.getItem(PERMISSION_ASKED_KEY);
      if (alreadyAsked) {
        return await this.checkPermission();
      }

      await storage.setItem(PERMISSION_ASKED_KEY, true);

      const result = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        {
          title: 'Resonix Emergency Notifications',
          message: 'Enable notifications to receive urgent rescue updates, dispatch status, and responder alerts.',
          buttonPositive: 'Allow',
          buttonNegative: 'Not Now',
        }
      );

      return result === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn('[NativeNotificationService] Request permission error:', err.message);
      return false;
    }
  }

  /**
   * Displays an Android system notification
   * @param {Object} options
   * @param {number} [options.id] - Notification ID
   * @param {string} options.title - Notification Title
   * @param {string} options.message - Notification Message Body
   * @param {Object} [options.data] - Custom metadata (e.g. incidentId, screen, status)
   */
  async showNotification({ id, title, message, data = {} }) {
    if (!title || !message) return false;

    const notifId = id || Math.floor(Math.random() * 100000) + 1000;

    try {
      if (ResonixNotification && typeof ResonixNotification.showNotification === 'function') {
        await ResonixNotification.showNotification(
          notifId,
          String(title),
          String(message),
          {
            screen: data.screen || 'STATUS',
            incidentId: data.incidentId || '',
            status: data.status || '',
            ...data,
          }
        );
        return true;
      } else {
        console.log(`[NativeNotificationService:Fallback] [ID:${notifId}] ${title} — ${message}`);
        return true;
      }
    } catch (err) {
      console.warn('[NativeNotificationService] Failed to show notification:', err.message);
      return false;
    }
  }

  /**
   * Returns and clears any initial notification that opened the app
   */
  getInitialNotification() {
    const notif = this.initialNotification;
    this.initialNotification = null;
    return notif;
  }

  /**
   * Subscribes to notification tap events while app is running/backgrounded
   * @param {Function} callback
   * @returns {Function} unsubscribe
   */
  onNotificationTapped(callback) {
    if (typeof callback === 'function') {
      this.tapListeners.add(callback);
    }
    return () => {
      this.tapListeners.delete(callback);
    };
  }
}

const nativeNotificationService = new NativeNotificationService();
module.exports = nativeNotificationService;
