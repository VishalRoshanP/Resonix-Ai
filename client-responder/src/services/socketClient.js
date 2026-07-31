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

const SOCKET_SERVER_URL = typeof window !== 'undefined' && window.location.port === '5000'
  ? window.location.origin
  : 'http://localhost:5000';

class ResponderSocketClient {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.subscribers = new Set();
    this.processedEventIds = new Set();
  }

  /**
   * Connects to backend Socket.IO server and joins responders room
   */
  connect() {
    if (this.socket && this.isConnected) {
      return this.socket;
    }

    if (this.socket) {
      this.socket.disconnect();
    }

    const token = tokenManager.getToken();

    this.socket = io(SOCKET_SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
      auth: { token },
    });

    console.log(`[ResponderSocketClient] ⚡ Connecting to Real-Time Command Center Server: ${SOCKET_SERVER_URL}`);

    this.socket.on('connect', () => {
      this.isConnected = true;
      console.log(`[ResponderSocketClient] 🟢 Connected to Command Center Server (Socket ID: ${this.socket.id})`);

      // Join responders room
      this.socket.emit('join:responders', { role: 'responder' });

      this._notifySubscribers({ type: 'SOCKET_CONNECTED', isConnected: true, socketId: this.socket.id });
    });

    this.socket.on('disconnect', (reason) => {
      this.isConnected = false;
      console.log(`[ResponderSocketClient] 🔴 Disconnected from Command Center Server (Reason: ${reason})`);
      this._notifySubscribers({ type: 'SOCKET_DISCONNECTED', isConnected: false, reason });
    });

    this.socket.on('connect_error', (error) => {
      console.warn('[ResponderSocketClient] ⚠️ Connection error:', error.message);
      this._notifySubscribers({ type: 'SOCKET_ERROR', error: error.message });
    });

    // 1. New Incident Created / Synced Broadcast
    this.socket.on('incident:created', (data) => {
      const eventId = `created_${data.packetId}_${data.timestamp}`;
      if (this._isDuplicate(eventId)) return;

      console.log(`[ResponderSocketClient] 🚨 Real-Time NEW INCIDENT received: ${data.packetId}`);
      this._notifySubscribers({ type: 'INCIDENT_CREATED', ...data });
    });

    // 1b. Offline Mesh New Emergency Broadcast
    this.socket.on('newEmergency', (data) => {
      const eventId = `new_emergency_${data.packetId || data.emergency?.packetId}_${data.timestamp}`;
      if (this._isDuplicate(eventId)) return;

      console.log(`[ResponderSocketClient] 🚨 Real-Time NEW EMERGENCY received over mesh: ${data.packetId || data.emergency?.packetId}`);
      this._notifySubscribers({ type: 'NEW_EMERGENCY', type_fallback: 'INCIDENT_CREATED', ...data });
    });

    // 2. Incident Status Update Broadcast
    this.socket.on('incident:updated', (data) => {
      const eventId = `updated_${data.incidentId}_${data.status}_${data.timestamp}`;
      if (this._isDuplicate(eventId)) return;

      console.log(`[ResponderSocketClient] 🔄 Real-Time INCIDENT UPDATED: ${data.incidentId} (Status: ${data.status})`);
      this._notifySubscribers({ type: 'INCIDENT_UPDATED', ...data });
    });

    // 3. Relay Mesh Telemetry Update Broadcast
    this.socket.on('relay:updated', (data) => {
      const eventId = `relay_${data.packetId}_${data.relayCount}_${data.timestamp}`;
      if (this._isDuplicate(eventId)) return;

      console.log(`[ResponderSocketClient] 📡 Real-Time RELAY UPDATED: ${data.packetId} (Hops: ${data.relayCount})`);
      this._notifySubscribers({ type: 'RELAY_UPDATED', ...data });
    });

    return this.socket;
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
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
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

export const responderSocketClient = new ResponderSocketClient();
export default responderSocketClient;
