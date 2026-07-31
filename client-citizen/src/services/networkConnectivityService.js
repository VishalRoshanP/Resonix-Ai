/**
 * Production-Ready Network Connectivity Monitoring Service for RESONIX AI
 * 
 * Capabilities:
 * - Detects browser online/offline status via navigator.onLine & event listeners
 * - Debounces rapid toggles to handle temporary connection drops gracefully
 * - Uses lightweight HEAD ping verification only on state changes (No excessive polling)
 * - Emits event notifications to all registered UI subscribers
 * - Reusable singleton service across the entire application
 */

import { resolveApiUrl } from '../utils/env';

class NetworkConnectivityService {
  constructor() {
    this.online = typeof navigator !== 'undefined' ? navigator.onLine : true;
    this.listeners = new Set();
    this.debounceTimer = null;
    this.stabilityDelayMs = 1500; // 1.5s debouncing to smooth temporary drops
    this.lastCheckedAt = new Date().toISOString();
    this.isVerifying = false;

    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleBrowserOnline.bind(this));
      window.addEventListener('offline', this.handleBrowserOffline.bind(this));
    }
  }

  /**
   * Browser online event handler
   * @private
   */
  handleBrowserOnline() {
    this.scheduleStateEvaluation(true);
  }

  /**
   * Browser offline event handler
   * @private
   */
  handleBrowserOffline() {
    this.scheduleStateEvaluation(false);
  }

  /**
   * Schedules debounced state evaluation to handle momentary connection drops
   * @private
   */
  scheduleStateEvaluation(targetState) {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      if (targetState) {
        // Verify real internet connectivity before declaring ONLINE
        const hasInternet = await this.verifyActualInternetConnection();
        this.updateState(hasInternet);
      } else {
        this.updateState(false);
      }
    }, this.stabilityDelayMs);
  }

  /**
   * Verifies actual WAN connectivity using a low-overhead fetch request (No continuous polling)
   */
  async verifyActualInternetConnection() {
    if (typeof fetch === 'undefined') return navigator.onLine;

    try {
      this.isVerifying = true;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      // Lightweight HEAD ping to backend health or root status endpoint
      const response = await fetch(resolveApiUrl('/api/health'), {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      this.isVerifying = false;
      return response.ok || response.status === 200 || response.status === 404;
    } catch (_) {
      this.isVerifying = false;
      // Fallback to navigator.onLine if ping endpoint is unreachable
      return typeof navigator !== 'undefined' ? navigator.onLine : false;
    }
  }

  /**
   * Updates state and notifies all subscribed listeners
   * @private
   */
  updateState(newState) {
    const stateChanged = this.online !== newState;
    this.online = newState;
    this.lastCheckedAt = new Date().toISOString();

    if (stateChanged) {
      this.notifyListeners();
    }
  }

  /**
   * Subscribes a callback listener to network connectivity change events
   * @param {Function} listener - Callback receiving { isOnline, timestamp }
   * @returns {Function} Unsubscribe function
   */
  subscribe(listener) {
    if (typeof listener === 'function') {
      this.listeners.add(listener);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notifies all registered listeners of current connectivity status
   * @private
   */
  notifyListeners() {
    const payload = {
      isOnline: this.online,
      timestamp: this.lastCheckedAt,
      networkMode: this.online ? 'ONLINE' : 'OFFLINE_MESH',
    };

    this.listeners.forEach((listener) => {
      try {
        listener(payload);
      } catch (err) {
        console.warn('[NetworkConnectivityService] Listener callback error:', err.message);
      }
    });
  }

  /**
   * Gets current online status
   * @returns {boolean}
   */
  isOnline() {
    return this.online;
  }

  /**
   * Gets complete current connectivity status object
   */
  getStatus() {
    return {
      isOnline: this.online,
      networkMode: this.online ? 'ONLINE' : 'OFFLINE_MESH',
      lastCheckedAt: this.lastCheckedAt,
      isVerifying: this.isVerifying,
    };
  }

  /**
   * Manually triggers immediate connectivity re-check and listener notification
   */
  async forceRecheck() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.updateState(false);
      return false;
    }

    const hasInternet = await this.verifyActualInternetConnection();
    this.updateState(hasInternet);
    return hasInternet;
  }
}

const networkConnectivityService = new NetworkConnectivityService();
export default networkConnectivityService;
export { networkConnectivityService };
