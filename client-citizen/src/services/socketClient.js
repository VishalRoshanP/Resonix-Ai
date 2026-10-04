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
import { getBackendUrl } from './api';

function getSocketServerUrl() {
  return getBackendUrl();
}

class CitizenSocketClient {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.hasConnectedOnce = false;
    this.reconnectAttempt = 0;
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
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      auth: { token },
    });

    console.log(`[CitizenSocketClient] ⚡ Connecting to Real-Time server: ${serverUrl}`);

    this.socket.on('connect', () => {
      const wasReconnected = Boolean(this.hasConnectedOnce && !this.isConnected);
      this.isConnected = true;
      this.hasConnectedOnce = true;
      this.reconnectAttempt = 0;
      console.log(`[CitizenSocketClient] 🟢 Connected to Real-Time server (Socket ID: ${this.socket.id}, Reconnected: ${wasReconnected})`);

      // Join citizen user channel
      this.socket.emit('join:citizen', { userId: this.currentUserId });

      this._notifySubscribers({
        type: 'SOCKET_CONNECTED',
        isConnected: true,
        isReconnect: wasReconnected,
        socketId: this.socket.id,
      });

      // On reconnection, emit a dedicated SOCKET_RECONNECTED event so pages can fetch latest state
      if (wasReconnected) {
        console.log(`[CitizenSocketClient] 🔄 Socket RECONNECTED. Signaling subscribers to fetch latest state.`);
        this._notifySubscribers({
          type: 'SOCKET_RECONNECTED',
          isConnected: true,
          socketId: this.socket.id,
          timestamp: new Date().toISOString(),
        });
      }
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      console.log(`[CitizenSocketClient] 🔴 Disconnected from Real-Time server (Reason: ${reason})`);
      this._notifySubscribers({ type: 'SOCKET_DISCONNECTED', isConnected: false, reason });
    });

    this.socket.on('connect_error', (error) => {
      console.debug('[CitizenSocketClient] ⚠️ Connection error (auto-retrying):', error.message);
      this._notifySubscribers({ type: 'SOCKET_ERROR', error: error.message });
    });

    if (this.socket.io) {
      this.socket.io.on('reconnect_attempt', (attempt) => {
        this.reconnectAttempt = attempt;
        console.debug(`[CitizenSocketClient] 🔄 Auto-reconnection attempt #${attempt}...`);
        this._notifySubscribers({
          type: 'SOCKET_RECONNECTING',
          attempt,
        });
      });
    }

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

    // 3. Responder Acknowledgement Real-Time Broadcast
    this.socket.on('incident:acknowledged', (data) => {
      const incId = data?.clientRequestId || data?.packetId || data?.incidentId || data?._id;
      const eventId = `ack_${incId}_${data?.timestamp || Date.now()}`;
      if (this._isDuplicate(eventId)) return;

      console.log('CITIZEN: ACK RECEIVED', incId);
      console.log(`[CitizenSocketClient] 👁️ Responder Acknowledgement received for incident '${incId}'`);
      this._notifySubscribers({ type: 'INCIDENT_ACKNOWLEDGED', ...data });
    });

    // 4. Weather Live Ingestion Update Broadcast (SIH26068)
    this.socket.on('weather:updated', (data) => {
      console.log('[CitizenSocketClient] ⛅ Live Weather Ingestion Update received:', data?.location?.name || data?.gridKey);
      this._notifySubscribers({ type: 'WEATHER_UPDATED', ...data });
    });

    // 4b. Meteorological Forecast Updated Broadcast
    this.socket.on('weather:forecast_updated', (data) => {
      console.log('[CitizenSocketClient] ⛅ Live Forecast Updated:', data?.location?.name || data?.gridKey);
      this._notifySubscribers({ type: 'FORECAST_UPDATED', ...data });
    });

    // 5. Severe Meteorological Hazard Warning Broadcast
    this.socket.on('weather:warning', (data) => {
      console.log('[CitizenSocketClient] ⚠️ Meteorological Warning received:', data?.warning?.headline || data?.warning?.event);
      this._notifySubscribers({ type: 'WEATHER_WARNING', ...data });
    });

    // 6. Extreme Weather Alert Broadcast (Engine SIH26068)
    this.socket.on('weather:alert', (data) => {
      const eventId = `weather_alert_${data?.alert?.fingerprint || data?.fingerprint || data?.alert?.id || Date.now()}`;
      if (this._isDuplicate(eventId)) return;

      console.log('[CitizenSocketClient] 🚨 Extreme Weather Alert Broadcast received:', data?.alert?.alertType || data?.alert?.headline);
      this._notifySubscribers({ type: 'WEATHER_ALERT', ...data });
    });

    // 7. Responder Assignment Broadcast
    this.socket.on('resource:assigned', (data) => {
      const resId = data.resourceId || data.resource?.id || data.resource?._id || 'res';
      const incId = data.incidentId || data.incident?.id || data.incident?._id || 'inc';
      const eventId = `assigned_${resId}_${incId}_${data.timestamp || Date.now()}`;
      if (this._isDuplicate(eventId)) return;

      console.log(`[CitizenSocketClient] 🛡️ Responder Assignment received: Unit ${resId} -> Incident ${incId}`);
      this._notifySubscribers({ type: 'RESOURCE_ASSIGNED', ...data });
    });

    // 8. Offline Synchronization Completion Broadcast
    this.socket.on('sync:completed', (data) => {
      const eventId = `sync_${data.syncId || data.timestamp}_${data.count}`;
      if (this._isDuplicate(eventId)) return;

      console.log(`[CitizenSocketClient] 🔄 Offline Sync Completed: ${data?.count || 0} items processed`);
      this._notifySubscribers({ type: 'SYNC_COMPLETED', ...data });
    });

    // 9. Incident Fusion Cluster Updated Broadcast
    this.socket.on('fusion:updated', (data) => {
      const clusterId = data.clusterId || data.cluster?.clusterId || `fusion_${Date.now()}`;
      const reportCount = data.reportCount || data.cluster?.reportCount || 1;
      const eventId = `fusion_${clusterId}_${reportCount}_${data.priority || ''}`;
      if (this._isDuplicate(eventId)) return;

      console.log(`[CitizenSocketClient] 🔮 Incident Fusion Updated: ${clusterId} (Reports: ${reportCount})`);
      this._notifySubscribers({ type: 'FUSION_UPDATED', ...data });
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

  subscribe(callback) {
    return this.onEvent(callback);
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
