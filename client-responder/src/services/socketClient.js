/**
 * RESONIX AI — Responder Command Center Real-Time Socket Client
 * 
 * Responsibilities:
 * - Real-time Socket.IO connection management for Responder Dashboard.
 * - Joins 'responders' room for multi-responder broadcast reception.
 * - Automatic reconnection with exponential backoff on network drop.
 * - Subscribes to:
 *   • `incident:created`: New citizen SOS / offline sync incident.
 *   • `incident:updated`: Status changes (reported -> active -> resolved).
 *   • `relay:updated`: Multi-hop mesh relay count & relay history updates.
 * - Event deduplication prevents duplicate notifications & UI re-renders.
 * - Emits `incident:update_status` for instant status changes.
 * 
 * ISOLATED MODULE — Does NOT alter existing UI design or components.
 */

import { io } from 'socket.io-client';
import { tokenManager } from './tokenManager';
import { env } from '../utils/env';
import { invalidateApiCache } from './api';

const getSocketServerUrl = () => {
  return env.backendUrl;
};

class ResponderSocketClient {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.isConnecting = false;
    this.hasConnectedOnce = false;
    this.reconnectAttempt = 0;
    this.subscribers = new Set();
    this.processedEventIds = new Set();
    this.currentServerUrl = null;
  }

  /**
   * Connects to backend Socket.IO server and joins responders room.
   * Idempotent: ensures ONE persistent connection is maintained.
   */
  connect() {
    const serverUrl = getSocketServerUrl();

    // 1. If socket instance already exists
    if (this.socket) {
      // If the backend URL genuinely changed, cleanly tear down the previous socket
      if (this.currentServerUrl && this.currentServerUrl !== serverUrl) {
        console.log(`[ResponderSocketClient] Backend URL changed from ${this.currentServerUrl} to ${serverUrl}. Reconnecting...`);
        this.disconnect();
      } else {
        // If already connected, ensure joined to responders room and return
        if (this.socket.connected) {
          this.socket.emit('join:responders', { role: 'responder' });
          return this.socket;
        }
        // If in-flight connecting or Socket.IO manager is actively reconnecting, preserve it
        if (this.isConnecting || this.socket.active) {
          return this.socket;
        }
        // If manually disconnected, re-trigger connect on the existing socket
        if (this.socket.disconnected) {
          this.isConnecting = true;
          this.socket.connect();
          return this.socket;
        }
        return this.socket;
      }
    }

    // 2. Create ONE persistent Socket.IO instance
    const token = tokenManager.getToken();
    this.currentServerUrl = serverUrl;
    this.isConnecting = true;

    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      randomizationFactor: 0.5,
      auth: { token },
    });

    console.log(`[ResponderSocketClient] ⚡ Connecting to Real-Time Command Center Server: ${serverUrl}`);

    this._setupSocketListeners();
    return this.socket;
  }

  _setupSocketListeners() {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      const wasReconnected = Boolean(this.hasConnectedOnce && !this.isConnected);
      this.isConnected = true;
      this.isConnecting = false;
      this.hasConnectedOnce = true;
      this.reconnectAttempt = 0;
      console.log(`[ResponderSocketClient] 🟢 Connected to Command Center Server (Socket ID: ${this.socket.id}, Reconnected: ${wasReconnected})`);

      // Join responders room
      this.socket.emit('join:responders', { role: 'responder' });

      this._notifySubscribers({
        type: 'SOCKET_CONNECTED',
        isConnected: true,
        isReconnect: wasReconnected,
        socketId: this.socket.id,
      });

      if (wasReconnected) {
        console.log(`[ResponderSocketClient] 🔄 Socket RECONNECTED. Signaling subscribers to fetch latest state.`);
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
      this.isConnecting = false;
      console.log(`[ResponderSocketClient] 🔴 Disconnected from Command Center Server (Reason: ${reason})`);
      this._notifySubscribers({
        type: 'SOCKET_DISCONNECTED',
        isConnected: false,
        reason,
        timestamp: new Date().toISOString(),
      });

      // Socket.IO auto-reconnects on transport errors/ping timeout when reconnection: true.
      // If server explicitly disconnected socket, trigger manual reconnect:
      if (reason === 'io server disconnect' && this.socket) {
        this.socket.connect();
      }
    });

    this.socket.on('connect_error', (error) => {
      this.isConnecting = false;
      console.debug('[ResponderSocketClient] ⚠️ Connection error (auto-retrying):', error.message);
      this._notifySubscribers({ type: 'SOCKET_ERROR', error: error.message });
    });

    if (this.socket.io) {
      this.socket.io.on('reconnect_attempt', (attempt) => {
        this.reconnectAttempt = attempt;
        console.debug(`[ResponderSocketClient] 🔄 Auto-reconnection attempt #${attempt}...`);
        this._notifySubscribers({
          type: 'SOCKET_RECONNECTING',
          attempt,
        });
      });
    }

    // 1. New Incident Created / Synced Broadcast
    this.socket.on('incident:created', (data) => {
      invalidateApiCache('/incidents');
      const pKey = data.packetId || data.clientRequestId || data._id || data.id;
      const eventId = `created_${pKey}`;
      if (this._isDuplicate(eventId)) return;
      this._isDuplicate(`new_emergency_${pKey}`); // Cross-suppress alternate event name

      console.log(`[ResponderSocketClient] 🚨 Real-Time NEW INCIDENT received: ${pKey}`);
      this._notifySubscribers({ type: 'INCIDENT_CREATED', ...data });
    });

    // 1b. Offline Mesh New Emergency Broadcast
    this.socket.on('newEmergency', (data) => {
      invalidateApiCache('/incidents');
      const pKey = data.packetId || data.emergency?.packetId || data.clientRequestId || data._id;
      if (this._isDuplicate(`created_${pKey}`) || this._isDuplicate(`new_emergency_${pKey}`)) return;

      console.log(`[ResponderSocketClient] 🚨 Real-Time NEW EMERGENCY received over mesh: ${pKey}`);
      this._notifySubscribers({ type: 'NEW_EMERGENCY', type_fallback: 'INCIDENT_CREATED', ...data });
    });

    // 2. Incident Status Update Broadcast
    this.socket.on('incident:updated', (data) => {
      invalidateApiCache('/incidents');
      const pKey = data.incidentId || data.packetId || data.clientRequestId || data._id;
      const versionKey = data.updatedAt || data.timestamp || data.incident?.updatedAt || data.category || Date.now();
      const eventId = `updated_${pKey}_${data.status}_${versionKey}`;
      if (this._isDuplicate(eventId)) return;

      console.log(`[ResponderSocketClient] 🔄 Real-Time INCIDENT UPDATED: ${pKey} (Status: ${data.status})`);
      this._notifySubscribers({ type: 'INCIDENT_UPDATED', ...data });
    });

    // 3. Relay Mesh Telemetry Update Broadcast
    this.socket.on('relay:updated', (data) => {
      const pKey = data.packetId || data.clientRequestId || data._id;
      const eventId = `relay_${pKey}_${data.relayCount}`;
      if (this._isDuplicate(eventId)) return;

      console.log(`[ResponderSocketClient] 📡 Real-Time RELAY UPDATED: ${pKey} (Hops: ${data.relayCount})`);
      this._notifySubscribers({ type: 'RELAY_UPDATED', ...data });
    });

    // 4. Incident Fusion Cluster Updated Broadcast
    this.socket.on('fusion:updated', (data) => {
      invalidateApiCache('/incidents');
      const clusterId = data.clusterId || data.cluster?.clusterId || `fusion_${Date.now()}`;
      const reportCount = data.reportCount || data.cluster?.reportCount || 1;
      const eventId = `fusion_${clusterId}_${reportCount}_${data.priority || ''}`;
      if (this._isDuplicate(eventId)) return;

      console.log(`[ResponderSocketClient] 🔮 Real-Time INCIDENT FUSION UPDATED: ${clusterId} (Reports: ${reportCount}, Priority: ${data.priority || 'HIGH'})`);
      this._notifySubscribers({ type: 'FUSION_UPDATED', ...data });
    });

    // 5. Emergency Resource Allocation & Status Update Broadcast
    this.socket.on('resource:updated', (data) => {
      invalidateApiCache('/resources');
      const resId = data.resourceId || data.resource?.id || data.resource?._id || `res_${Date.now()}`;
      const status = (data.status || data.resource?.status || 'AVAILABLE').toUpperCase();
      const eventId = `resource_${resId}_${status}_${data.resource?.currentMission || ''}`;
      if (this._isDuplicate(eventId)) return;

      console.log(`[ResponderSocketClient] 🛡️ Real-Time RESOURCE UPDATED: ${resId} (Status: ${status})`);
      this._notifySubscribers({ type: 'RESOURCE_UPDATED', ...data });
    });

    // 5b. Responder Assignment Broadcast
    this.socket.on('resource:assigned', (data) => {
      invalidateApiCache('/resources');
      invalidateApiCache('/incidents');
      const resId = data.resourceId || data.resource?.id || data.resource?._id || 'res';
      const incId = data.incidentId || data.incident?.id || data.incident?._id || 'inc';
      const eventId = `assigned_${resId}_${incId}_${data.timestamp || Date.now()}`;
      if (this._isDuplicate(eventId)) return;

      console.log(`[ResponderSocketClient] 🎯 Real-Time RESOURCE ASSIGNED: Unit ${resId} -> Incident ${incId}`);
      this._notifySubscribers({ type: 'RESOURCE_ASSIGNED', ...data });
    });

    // 6. Real-Time Meteorological Ingestion Update (SIH26068)
    this.socket.on('weather:updated', (data) => {
      invalidateApiCache('/weather');
      console.log(`[ResponderSocketClient] ⛅ Live Weather Ingestion Update: ${data?.location?.name || data?.gridKey}`);
      this._notifySubscribers({ type: 'WEATHER_UPDATED', ...data });
    });

    // 6b. Meteorological Forecast Updated Broadcast
    this.socket.on('weather:forecast_updated', (data) => {
      invalidateApiCache('/weather');
      console.log(`[ResponderSocketClient] ⛅ Live Forecast Updated: ${data?.location?.name || data?.gridKey}`);
      this._notifySubscribers({ type: 'FORECAST_UPDATED', ...data });
    });

    // 7. Severe Meteorological Hazard Warning Broadcast
    this.socket.on('weather:warning', (data) => {
      invalidateApiCache('/weather');
      console.log(`[ResponderSocketClient] ⚠️ Meteorological Warning: ${data?.warning?.headline || data?.warning?.event}`);
      this._notifySubscribers({ type: 'WEATHER_WARNING', ...data });
    });

    // 7b. Extreme Weather Alert Broadcast
    this.socket.on('weather:alert', (data) => {
      invalidateApiCache('/weather');
      console.log(`[ResponderSocketClient] 🚨 Extreme Weather Alert: ${data?.headline || data?.alertId}`);
      this._notifySubscribers({ type: 'WEATHER_ALERT', ...data });
    });

    // 8. Offline Synchronization Completion Broadcast
    this.socket.on('sync:completed', (data) => {
      invalidateApiCache('/incidents');
      const eventId = `sync_${data.syncId || data.timestamp}_${data.count}`;
      if (this._isDuplicate(eventId)) return;

      console.log(`[ResponderSocketClient] 🔄 Offline Sync Completed: ${data?.count || 0} items processed`);
      this._notifySubscribers({ type: 'SYNC_COMPLETED', ...data });
    });
  }

  /**
   * Emits status update event directly over websocket
   * @param {string} incidentId
   * @param {string} status - 'reported' | 'active' | 'resolved'
   */
  updateIncidentStatus(incidentId, status) {
    if (this.socket && this.isConnected) {
      console.log(`[ResponderSocketClient] Emitting status update for ${incidentId}: ${status}`);
      this.socket.emit('incident:update_status', {
        incidentId,
        status,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.isConnecting = false;
      this.currentServerUrl = null;
      console.log('[ResponderSocketClient] Disconnected cleanly.');
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
      callback({
        type: 'SOCKET_STATUS',
        isConnected: this.isConnected,
        isConnecting: this.isConnecting,
      });
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

export const responderSocketClient = new ResponderSocketClient();
export default responderSocketClient;
