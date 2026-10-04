/**
 * RESONIX AI — Citizen Mobile Real-Time Socket Client
 * 
 * Responsibilities:
 * - Real-time Socket.IO connection management for Citizen Mobile application.
 * - Subscribes to real emergency events:
 *   - `sos:confirmed`
 *   - `incident:acknowledged`
 *   - `incident:updated`
 * - Automatic reconnection with exponential backoff.
 * - Joins user-specific channel (`user:${userId}`) and packet channel (`packet:${packetId}`).
 * - Decoupled & isolated: Does NOT interfere with existing UI or APIs.
 */

const { io } = require('socket.io-client');
const ENV = require('../config/env');
const storage = require('../utils/storage');

class CitizenSocketClient {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.subscribers = new Set();
    this.processedEventIds = new Set();
    this.currentUserId = null;
    this.currentPacketId = null;
    this.serverUrl = null;
    this.reconnectTimer = null;
  }

  /**
   * Sets dynamic socket server origin discovered by network reachability checks
   */
  setServerUrl(newUrl) {
    if (newUrl && typeof newUrl === 'string') {
      const clean = newUrl.replace(/\/+$/, '');
      if (this.serverUrl !== clean) {
        this.serverUrl = clean;
        console.log(`[CitizenSocketClient] Socket server URL dynamically updated to: ${clean}`);
        if (this.socket && this.isConnected) {
          this.disconnect();
          this.connect(this.currentUserId, this.currentPacketId);
        }
      }
    }
  }

  /**
   * Initializes or updates the Socket.IO client instance
   * @param {string} [userId]
   * @param {string} [packetId]
   */
  connect(userId = 'usr_guest', packetId = null) {
    if (
      this.socket &&
      this.isConnected &&
      this.currentUserId === userId &&
      this.currentPacketId === packetId
    ) {
      return this.socket;
    }

    this.currentUserId = userId;
    this.currentPacketId = packetId;

    if (this.socket) {
      try {
        this.socket.disconnect();
      } catch (_) {}
      this.socket = null;
    }

    const serverUrl = this.serverUrl || ENV.SOCKET_URL;

    try {
      this.socket = io(serverUrl, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: Infinity,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
        timeout: 10000,
      });

      console.log(`[CitizenSocketClient] ⚡ Connecting to Socket server: ${serverUrl}`);

      this.socket.on('connect', () => {
        this.isConnected = true;
        console.log(`[CitizenSocketClient] 🟢 Connected to Socket server (Socket ID: ${this.socket.id})`);

        // Join citizen channel
        this.socket.emit('join:citizen', {
          userId: this.currentUserId,
          packetId: this.currentPacketId,
        });

        this._notifySubscribers({
          type: 'SOCKET_CONNECTED',
          isConnected: true,
          socketId: this.socket.id,
        });
      });

      this.socket.on('disconnect', (reason) => {
        this.isConnected = false;
        console.log(`[CitizenSocketClient] 🔴 Disconnected from Socket server (Reason: ${reason})`);
        this._notifySubscribers({
          type: 'SOCKET_DISCONNECTED',
          isConnected: false,
          reason,
        });
      });

      this.socket.on('connect_error', (error) => {
        this.isConnected = false;
        console.log(`[CitizenSocketClient] ⚠️ Socket connection notice: ${error.message}`);
        this._notifySubscribers({
          type: 'SOCKET_ERROR',
          error: error.message,
        });
      });

      // 1. SOS Processed / Confirmed Broadcast
      this.socket.on('sos:confirmed', (data) => {
        const eventId = `confirm_${data?.packetId || data?.incidentId}_${data?.timestamp || Date.now()}`;
        if (this._isDuplicate(eventId)) return;

        console.log(`[CitizenSocketClient] ✅ Real-Time SOS Confirmation for packet '${data?.packetId}'`);
        this._notifySubscribers({ type: 'SOS_CONFIRMED', ...data });
      });

      // 2. Incident Status Update Broadcast
      this.socket.on('incident:updated', (data) => {
        const incId = data?.incidentId || data?.packetId || data?._id;
        const eventId = `upd_${incId}_${data?.status}_${data?.timestamp || Date.now()}`;
        if (this._isDuplicate(eventId)) return;

        console.log(`[CitizenSocketClient] 🔄 Real-Time Status Update for incident '${incId}': ${data?.status}`);
        this._notifySubscribers({ type: 'INCIDENT_UPDATED', ...data });
      });

      // 3. Responder Acknowledgement Broadcast
      this.socket.on('incident:acknowledged', (data) => {
        const incId = data?.incidentId || data?.packetId || data?.clientRequestId || data?._id;
        const eventId = `ack_${incId}_${data?.timestamp || Date.now()}`;
        if (this._isDuplicate(eventId)) return;

        console.log(`[CitizenSocketClient] 👁️ Responder Acknowledgement for incident '${incId}'`);
        this._notifySubscribers({ type: 'INCIDENT_ACKNOWLEDGED', ...data });
      });

      // 4. Weather Ingestion Update Broadcast (SIH26068)
      this.socket.on('weather:updated', (data) => {
        console.log(`[CitizenSocketClient] ⛅ Weather updated for ${data?.location?.name || data?.gridKey}`);
        this._notifySubscribers({ type: 'WEATHER_UPDATED', ...data });
      });

      // 5. Severe Meteorological Hazard Warning Broadcast
      this.socket.on('weather:warning', (data) => {
        console.log(`[CitizenSocketClient] ⚠️ Weather warning: ${data?.warning?.headline || data?.warning?.event}`);
        this._notifySubscribers({ type: 'WEATHER_WARNING', ...data });
      });
    } catch (err) {
      console.warn('[CitizenSocketClient] Socket initialization failed:', err.message);
    }

    return this.socket;
  }

  /**
   * Updates room join when active packet/incident ID changes
   */
  updateTrackingPacket(packetId) {
    this.currentPacketId = packetId;
    if (this.socket && this.isConnected && packetId) {
      this.socket.emit('join:citizen', {
        userId: this.currentUserId || 'usr_guest',
        packetId,
      });
    }
  }

  disconnect() {
    if (this.socket) {
      try {
        this.socket.disconnect();
      } catch (_) {}
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

  _notifySubscribers(event) {
    this.subscribers.forEach((callback) => {
      try {
        callback(event);
      } catch (err) {
        console.warn('[CitizenSocketClient] Subscriber callback error:', err.message);
      }
    });
  }

  subscribe(callback) {
    if (typeof callback === 'function') {
      this.subscribers.add(callback);
      callback({ type: 'SOCKET_STATUS', isConnected: this.isConnected });
    }
    return () => {
      this.subscribers.delete(callback);
    };
  }
}

const citizenSocketClient = new CitizenSocketClient();
module.exports = citizenSocketClient;
