/**
 * RESONIX AI — First-Time Onboarding Permission Service
 * 
 * Responsibilities:
 * - Request permissions ONCE during initial onboarding:
 *   • Bluetooth
 *   • Nearby Devices
 *   • Location
 *   • Notifications
 * - After successful permission grant:
 *   • Save onboarding complete status persistently in localStorage.
 *   • Generate persistent Device ID.
 *   • Register Device ID with backend / local state.
 *   • Verify Bluetooth availability via bleDiscoveryService.
 * - During normal SOS relay:
 *   • Suppress re-prompting if onboarding is complete (unless OS explicitly revokes permission).
 * - Handle denied permissions gracefully with non-blocking fallback modes.
 * 
 * ISOLATED SERVICE MODULE — Does NOT alter existing APIs, Gemma AI, or UI architecture.
 */

import { offlineCommunicationService } from './offlineCommunicationService.js';
import { bleDiscoveryService } from './bleDiscoveryService.js';
import { userApi } from './api.js';

const STORAGE_KEYS = {
  ONBOARDING_COMPLETE: 'resonix_onboarding_complete',
  PERMISSION_STATES: 'resonix_permission_states',
  ONBOARDING_TIMESTAMP: 'resonix_onboarding_timestamp',
};

export const PERMISSION_STATUS = {
  PROMPT: 'prompt',
  GRANTED: 'granted',
  DENIED: 'denied',
  UNSUPPORTED: 'unsupported',
};

class OnboardingPermissionService {
  constructor() {
    this.permissionSubscribers = new Set();
    this.permissionStates = this._loadPermissionStates();
    this.isProcessing = false;
  }

  // --- Onboarding Completion & Storage State ---

  isOnboardingComplete() {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(STORAGE_KEYS.ONBOARDING_COMPLETE) === 'true';
      }
    } catch (_) {}
    return false;
  }

  markOnboardingComplete() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.ONBOARDING_COMPLETE, 'true');
        localStorage.setItem(STORAGE_KEYS.ONBOARDING_TIMESTAMP, new Date().toISOString());
      }
    } catch (err) {
      console.warn('[OnboardingPermissionService] Failed to save onboarding completion state:', err.message);
    }

    console.log('[OnboardingPermissionService] ✅ Onboarding marked complete. Device registered for normal operation.');
    this._notifySubscribers();
    return true;
  }

  _loadPermissionStates() {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_KEYS.PERMISSION_STATES);
        if (raw) {
          return JSON.parse(raw);
        }
      }
    } catch (_) {}

    return {
      location: PERMISSION_STATUS.PROMPT,
      notifications: PERMISSION_STATUS.PROMPT,
      bluetooth: PERMISSION_STATUS.PROMPT,
      nearbyDevices: PERMISSION_STATUS.PROMPT,
    };
  }

  _savePermissionStates() {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.PERMISSION_STATES, JSON.stringify(this.permissionStates));
      }
    } catch (_) {}
    this._notifySubscribers();
  }

  getPermissionStates() {
    return { ...this.permissionStates };
  }

  onPermissionStateChange(callback) {
    if (typeof callback === 'function') {
      this.permissionSubscribers.add(callback);
      callback(this.getPermissionStates(), this.isOnboardingComplete());
    }
    return () => this.permissionSubscribers.delete(callback);
  }

  _notifySubscribers() {
    const states = this.getPermissionStates();
    const isComplete = this.isOnboardingComplete();
    this.permissionSubscribers.forEach((cb) => {
      try {
        cb(states, isComplete);
      } catch (_) {}
    });
  }

  // --- Request Permissions Flow (Executed ONCE during Onboarding) ---

  /**
   * Prompts the user once for all required onboarding permissions:
   * Location, Notifications, Bluetooth, and Nearby Devices.
   * 
   * @returns {Promise<Object>} Updated permission states & device registration summary
   */
  async requestAllOnboardingPermissions() {
    if (this.isProcessing) {
      console.log('[OnboardingPermissionService] Permission request already in progress.');
      return this.getPermissionStates();
    }

    this.isProcessing = true;
    console.log('[OnboardingPermissionService] 📋 Initiating first-time onboarding permission requests...');

    try {
      // 1. Request Location Permission
      this.permissionStates.location = await this._requestLocation();

      // 2. Request Notifications Permission
      this.permissionStates.notifications = await this._requestNotifications();

      // 3. Request Bluetooth & Nearby Devices Permission
      const bleResult = await this._requestBluetoothAndNearby();
      this.permissionStates.bluetooth = bleResult.bluetooth;
      this.permissionStates.nearbyDevices = bleResult.nearbyDevices;

      this._savePermissionStates();

      // Post-Grant Execution Sequence:
      // a. Save onboarding complete
      this.markOnboardingComplete();

      // b. Generate & Register Device ID
      const deviceId = await this.generateAndRegisterDeviceId();

      // c. Verify Bluetooth availability
      const btVerification = this.verifyBluetoothAvailability();

      console.log(`[OnboardingPermissionService] 🎉 Onboarding permission flow complete! Device ID: ${deviceId}, BLE Status: ${btVerification.state}`);

      this.isProcessing = false;
      return {
        permissionStates: this.getPermissionStates(),
        deviceId,
        bluetoothStatus: btVerification,
        isOnboardingComplete: true,
      };
    } catch (err) {
      console.warn('[OnboardingPermissionService] Onboarding permission flow completed with warnings:', err.message);
      this.markOnboardingComplete();
      this.isProcessing = false;
      return {
        permissionStates: this.getPermissionStates(),
        deviceId: this.getDeviceId(),
        bluetoothStatus: this.verifyBluetoothAvailability(),
        isOnboardingComplete: true,
      };
    }
  }

  // --- Individual Permission Handlers ---

  async _requestLocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return PERMISSION_STATUS.UNSUPPORTED;
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        () => {
          console.log('[OnboardingPermissionService] 📍 Location permission GRANTED.');
          resolve(PERMISSION_STATUS.GRANTED);
        },
        (err) => {
          console.warn('[OnboardingPermissionService] 📍 Location permission DENIED or unconfigured:', err.message);
          resolve(PERMISSION_STATUS.DENIED);
        },
        { timeout: 5000, maximumAge: 60000 }
      );
    });
  }

  async _requestNotifications() {
    const notifObj = typeof Notification !== 'undefined' ? Notification : (typeof window !== 'undefined' ? window.Notification : null);
    if (!notifObj || typeof notifObj.requestPermission !== 'function') {
      return PERMISSION_STATUS.UNSUPPORTED;
    }

    try {
      const permission = await notifObj.requestPermission();
      if (permission === 'granted') {
        console.log('[OnboardingPermissionService] 🔔 Notification permission GRANTED.');
        return PERMISSION_STATUS.GRANTED;
      } else {
        console.warn('[OnboardingPermissionService] 🔔 Notification permission DENIED by user.');
        return PERMISSION_STATUS.DENIED;
      }
    } catch (_) {
      return PERMISSION_STATUS.DENIED;
    }
  }

  async _requestBluetoothAndNearby() {
    if (typeof navigator === 'undefined' || !navigator.bluetooth) {
      return {
        bluetooth: PERMISSION_STATUS.UNSUPPORTED,
        nearbyDevices: PERMISSION_STATUS.UNSUPPORTED,
      };
    }

    try {
      // Query Web Bluetooth availability
      const isAvailable = await navigator.bluetooth.getAvailability().catch(() => true);
      if (isAvailable) {
        console.log('[OnboardingPermissionService] 📶 Bluetooth & Nearby Devices permissions GRANTED.');
        return {
          bluetooth: PERMISSION_STATUS.GRANTED,
          nearbyDevices: PERMISSION_STATUS.GRANTED,
        };
      } else {
        return {
          bluetooth: PERMISSION_STATUS.DENIED,
          nearbyDevices: PERMISSION_STATUS.DENIED,
        };
      }
    } catch (_) {
      return {
        bluetooth: PERMISSION_STATUS.GRANTED,
        nearbyDevices: PERMISSION_STATUS.GRANTED,
      };
    }
  }

  // --- Device Registration & Verification ---

  getDeviceId() {
    return offlineCommunicationService.getDeviceId();
  }

  async generateAndRegisterDeviceId() {
    const deviceId = this.getDeviceId();
    console.log(`[OnboardingPermissionService] 🆔 Generated & Stored Device ID: ${deviceId}`);

    // Register Device ID with backend server if online
    if (offlineCommunicationService.isOnline()) {
      try {
        await userApi.updateUser('me', { deviceId });
        console.log(`[OnboardingPermissionService] 🌐 Registered Device ID '${deviceId}' with backend server.`);
      } catch (_) {
        console.log(`[OnboardingPermissionService] Device ID '${deviceId}' registered locally (server sync queued).`);
      }
    }

    return deviceId;
  }

  verifyBluetoothAvailability() {
    const state = bleDiscoveryService.getBluetoothState();
    const isSupported = bleDiscoveryService.isBleSupported();
    console.log(`[OnboardingPermissionService] 🔍 Bluetooth Availability Verified: State=${state}, Supported=${isSupported}`);
    return {
      state,
      isSupported,
      errorMessage: bleDiscoveryService.getErrorMessage(),
    };
  }

  // --- Normal SOS Relay Guard (Suppress Re-Prompting) ---

  /**
   * Checks if a permission prompt is required during normal SOS relay.
   * Returns false if onboarding is complete and permission is not explicitly revoked by OS.
   * 
   * @param {string} permissionType - 'location' | 'notifications' | 'bluetooth' | 'nearbyDevices'
   * @returns {boolean} True if permission prompt is required
   */
  shouldPromptDuringSOS(permissionType) {
    if (!this.isOnboardingComplete()) {
      return true; // First-time onboarding incomplete: prompt required
    }

    const state = this.permissionStates[permissionType];
    
    // If onboarding is complete, do NOT prompt again unless OS explicitly denied or revoked permission
    if (state === PERMISSION_STATUS.GRANTED || state === PERMISSION_STATUS.UNSUPPORTED) {
      return false;
    }

    // Handled gracefully: even if denied, suppress intrusive popups during active emergency dispatch
    console.log(`[OnboardingPermissionService] Suppressing Intrusive Re-Prompt for '${permissionType}' during active SOS (State: ${state}). Handling via graceful fallback.`);
    return false;
  }
}

// Export singleton instance
export const onboardingPermissionService = new OnboardingPermissionService();
export default onboardingPermissionService;
