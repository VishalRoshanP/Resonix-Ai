/**
 * Production-Ready Network Connectivity Monitoring Service for RESONIX AI (Responder Command Center)
 * 
 * Capabilities:
 * - Detects browser online/offline status via navigator.onLine & event listeners
 * - Debounces rapid toggles to handle temporary connection drops gracefully
 * - Uses lightweight HEAD ping verification only on state changes (No excessive polling)
 * - Emits event notifications to all registered UI subscribers
 * - Reusable singleton service across the entire application
import { env } from '../utils/env';

class NetworkConnectivityService {
  constructor() {
    this.online = typeof navigator !== 'undefined' ? navigator.onLine : true;
    this.listeners = new Set();
    this.debounceTimer = null;
    this.stabilityDelayMs = 1500;
    this.lastCheckedAt = new Date().toISOString();
    this.isVerifying = false;

    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleBrowserOnline.bind(this));
      window.addEventListener('offline', this.handleBrowserOffline.bind(this));
    }
  }

  handleBrowserOnline() {
    this.scheduleStateEvaluation(true);
  }

  handleBrowserOffline() {
    this.scheduleStateEvaluation(false);
  }

  scheduleStateEvaluation(targetState) {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(async () => {
      if (targetState) {
        const hasInternet = await this.verifyActualInternetConnection();
        this.updateState(hasInternet);
      } else {
        this.updateState(false);
      }
    }, this.stabilityDelayMs);
  }

  async verifyActualInternetConnection() {
    if (typeof fetch === 'undefined') return navigator.onLine;

    try {
      this.isVerifying = true;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const healthUrl = `${env.apiBaseUrl}/health`;
      const response = await fetch(healthUrl, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      this.isVerifying = false;
      return response.ok || response.status === 200 || response.status === 404;
    } catch (_) {
      this.isVerifying = false;
      return typeof navigator !== 'undefined' ? navigator.onLine : false;
    }
  }

  updateState(newState) {
    const stateChanged = this.online !== newState;
    this.online = newState;
    this.lastCheckedAt = new Date().toISOString();

    if (stateChanged) {
      this.notifyListeners();
    }
  }

  subscribe(listener) {
    if (typeof listener === 'function') {
      this.listeners.add(listener);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

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

  isOnline() {
    return this.online;
  }

  getStatus() {
    return {
      isOnline: this.online,
      networkMode: this.online ? 'ONLINE' : 'OFFLINE_MESH',
      lastCheckedAt: this.lastCheckedAt,
      isVerifying: this.isVerifying,
    };
  }

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
