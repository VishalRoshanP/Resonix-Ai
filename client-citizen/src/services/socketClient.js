/**
 * RESONIX AI — Client-Citizen Real-Time Socket Client
 * 
 * Responsibilities:
 * - Real-time Socket.IO connection management for Citizen portal.
 * - Joins user-specific room (`user:${userId}`).
 * - Automatic reconnection with exponential backoff on network drop.
 * - Subscribes to `sos:confirmed` and `incident:updated` real-time events.
 * - Event deduplication prevents duplicate notifications.
 * 
 * ISOLATED MODULE — Does NOT alter existing UI or APIs.
 */

import { io } from 'socket.io-client';
import { tokenManager } from './tokenManager';
import { getApiBaseUrl } from './api';

function getSocketServerUrl() {
  const apiBaseUrl = getApiBaseUrl();
  return apiBaseUrl.replace(/\/api\/v1\/?$/, '').replace(/\/api\/?$/, '');
}

class CitizenSocketClient {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.subscribers = new Set();
    this.processedEventIds = new Set();
    this.currentUserId = null;
  }

  /**
   * Initializes and connects Socket.IO client instance
   * @param {string} [userId] - Current citizen user ID
   */
  connect(userId = 'usr_guest') {
    if (this.socket && this.isConnected && this.currentUserId === userId) {
      return this.socket;
    }

    this.currentUserId = userId;

    if (this.socket) {
      this.socket.disconnect();
    }

    const token = tokenManager.getToken();
    const serverUrl = getSocketServerUrl();

    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      auth: { token },
    });

    console.log(`[CitizenSocketClient] ⚡ Connecting to Real-Time server: ${serverUrl}`);

    this.socket.on('connect', () => {
      this.isConnected = true;
      console.log(`[CitizenSocketClient] 🟢 Connected to Real-Time server (Socket ID: ${this.socket.id})`);

      // Join citizen user channel
      this.socket.emit('join:citizen', { userId: this.currentUserId });

      this._notifySubscribers({ type: 'SOCKET_CONNECTED', isConnected: true, socketId: this.socket.id });
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      console.log(`[CitizenSocketClient] 🔴 Disconnected from Real-Time server (Reason: ${reason})`);
      this._notifySubscribers({ type: 'SOCKET_DISCONNECTED', isConnected: false, reason });
    });

    this.socket.on('connect_error', (error) => {
      console.warn('[CitizenSocketClient] ⚠️ Connection error:', error.message);
      this._notifySubscribers({ type: 'SOCKET_ERROR', error: error.message });
    });

    // 1. SOS Processed / Confirmed Real-Time Broadcast
    this.socket.on('sos:confirmed', (data) => {
      const eventId = `confirm_${data.packetId}_${data.timestamp}`;
      if (this._isDuplicate(eventId)) return;

      console.log(`[CitizenSocketClient] ✅ Real-Time SOS Confirmation received for packet '${data.packetId}'`);
      this._notifySubscribers({ type: 'SOS_CONFIRMED', ...data });
    });

    // 2. Incident Status Update Real-Time Broadcast
    this.socket.on('incident:updated', (data) => {
      const eventId = `upd_${data.incidentId}_${data.status}_${data.timestamp}`;
      if (this._isDuplicate(eventId)) return;

      console.log(`[CitizenSocketClient] 🔄 Real-Time Status Update received for incident '${data.incidentId}': ${data.status}`);
      this._notifySubscribers({ type: 'INCIDENT_UPDATED', ...data });
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      console.log('[CitizenSocketClient] Disconnected cleanly.');
    }
  }

  _isDuplicate(eventId) {
    if (!eventId) return false;
    if (this.processedEventIds.has(eventId)) return true;
    this.processedEventIds.add(eventId);
    if (this.processedEventIds.size > 200) {
      const first = this.processedEventIds.values().next().value;
      this.processedEventIds.delete(first);
    }
    return false;
  }

  onEvent(callback) {
    if (typeof callback === 'function') {
      this.subscribers.add(callback);
      callback({ type: 'SOCKET_STATUS', isConnected: this.isConnected });
    }
    return () => this.subscribers.delete(callback);
  }

  _notifySubscribers(eventData) {
    this.subscribers.forEach((cb) => {
      try {
        cb(eventData);
      } catch (_) {}
    });
  }
}

export const citizenSocketClient = new CitizenSocketClient();
export default citizenSocketClient;
