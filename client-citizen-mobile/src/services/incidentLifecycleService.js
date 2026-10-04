/**
 * RESONIX AI — Citizen Mobile Incident Response Lifecycle & Notification Engine
 * 
 * Responsibilities:
 * - Listens to real-time incident lifecycle events via Socket.IO and REST fallback.
 * - Enforces SAME INCIDENT ONLY isolation (never processes events from other incidents).
 * - Enforces persistent event deduplication (incidentId + status) to prevent duplicate notifications.
 * - Fires real Android system notifications via nativeNotificationService.
 * - Respects Foreground vs Background UX rules (SOS confirmation always notified; updates notify when backgrounded).
 * - ZERO MOCK DATA: Driven 100% by genuine backend states and events.
 */

let AppState = null;
try {
  const RN = require('react-native');
  AppState = RN.AppState;
} catch (_) {
  AppState = {
    currentState: 'active',
    addEventListener: () => ({ remove: () => {} }),
  };
}
const storage = require('../utils/storage');
const ENV = require('../config/env');
const nativeNotificationService = require('./nativeNotificationService');
const citizenSocketClient = require('./citizenSocketClient');
const apiService = require('./apiService');

const NOTIFIED_EVENTS_KEY = '@resonix_citizen_notified_events';

// Canonical Notification Content Templates
const NOTIFICATION_TEMPLATES = {
  SOS_SENT: {
    title: '🚨 SOS Sent Successfully',
    message: 'Your emergency alert has been received by the Resonix AI Command Center.',
  },
  ACKNOWLEDGED: {
    title: '👁️ Alert Acknowledged',
    message: 'The response team has seen your emergency alert. Help is being coordinated.',
  },
  DISPATCHED: {
    title: '🚑 Rescue Dispatched',
    message: 'Emergency services have been dispatched to your location.',
  },
  IN_PROGRESS: {
    title: '🚑 Rescue In Progress',
    message: 'Responders are currently working on your emergency.',
  },
  COMPLETED: {
    title: '✅ Rescue Completed',
    message: 'Your emergency response has been marked complete.',
  },
  CANCELLED: {
    title: '✓ Emergency Cancelled',
    message: 'Your emergency alert has been cancelled successfully.',
  },
};

class IncidentLifecycleService {
  constructor() {
    this.activeIncident = null;
    this.activeIncidentId = null;
    this.activePacketId = null;
    this.notifiedKeys = new Set();
    this.subscribers = new Set();
    this.pollInterval = null;
    this.isInitialized = false;
    this.appState = AppState ? AppState.currentState : 'active';

    if (AppState) {
      AppState.addEventListener('change', (nextAppState) => {
        console.log(`[IncidentLifecycleService] AppState changed: ${this.appState} -> ${nextAppState}`);
        this.appState = nextAppState;
        if (nextAppState === 'active' && this.activeIncidentId) {
          // Reconcile status immediately upon returning to foreground
          this.reconcileStatus().catch(() => {});
        }
      });
    }
  }

  /**
   * Initializes the lifecycle service and loads persistent deduplication history
   */
  async init() {
    if (this.isInitialized) return;
    this.isInitialized = true;

    try {
      // 1. Initialize native notification bridge
      await nativeNotificationService.init();

      // 2. Load persisted notification deduplication keys
      const savedNotified = await storage.getItem(NOTIFIED_EVENTS_KEY);
      if (Array.isArray(savedNotified)) {
        this.notifiedKeys = new Set(savedNotified);
      } else if (savedNotified && typeof savedNotified === 'object') {
        this.notifiedKeys = new Set(Object.keys(savedNotified));
      }

      // 3. Connect to real-time socket
      citizenSocketClient.connect();
      citizenSocketClient.subscribe(this._handleSocketEvent.bind(this));

      // 4. Restore active incident if one was persisted
      const savedIncident = await storage.getItem(ENV.STORAGE_KEYS.ACTIVE_INCIDENT);
      if (savedIncident) {
        const s = String(savedIncident.status || '').toUpperCase();
        if (s !== 'RESOLVED' && s !== 'COMPLETED' && s !== 'CLOSED' && s !== 'CANCELLED') {
          this.trackIncident(savedIncident);
        }
      }
    } catch (err) {
      console.warn('[IncidentLifecycleService] Init warning:', err.message);
    }
  }

  /**
   * Begins tracking an active incident
   * @param {Object} incidentPayload
   */
  trackIncident(incidentPayload) {
    if (!incidentPayload) return;

    this.activeIncident = incidentPayload;
    this.activeIncidentId = incidentPayload.incident_id || incidentPayload._id || incidentPayload.packetId;
    this.activePacketId = incidentPayload.packetId || incidentPayload.clientRequestId || this.activeIncidentId;

    console.log(`[IncidentLifecycleService] 🎯 Tracking incident: ID='${this.activeIncidentId}', Packet='${this.activePacketId}'`);

    // Update socket room subscriptions
    citizenSocketClient.updateTrackingPacket(this.activePacketId);

    // Start gentle reconciliation polling (every 10s)
    this._startReconciliationPolling();
  }

  /**
   * Clears active tracking (e.g. upon terminal state or explicit cancellation)
   */
  stopTracking() {
    console.log('[IncidentLifecycleService] Stopped tracking incident.');
    this.activeIncident = null;
    this.activeIncidentId = null;
    this.activePacketId = null;
    this._stopReconciliationPolling();
  }

  /**
   * Called when citizen SOS is confirmed by backend
   */
  async onSosConfirmed(payload) {
    const id = payload?.incident_id || payload?.packetId || this.activeIncidentId;
    if (!id) return;

    this.trackIncident(payload);

    // SOS Sent notification is ALWAYS shown (Requirements 1 & 19)
    await this._triggerNotification(id, 'SOS_SENT');
    this._notifySubscribers({ type: 'SOS_CONFIRMED', incident: payload });
  }

  /**
   * Called when citizen explicitly cancels an incident
   */
  async onIncidentCancelled(payload) {
    const id = payload?.incident_id || payload?.packetId || this.activeIncidentId;
    if (!id) return;

    await this._triggerNotification(id, 'CANCELLED');
    this._notifySubscribers({ type: 'INCIDENT_CANCELLED', incidentId: id });
    this.stopTracking();
  }

  /**
   * Handles real-time Socket.IO broadcasts
   */
  async _handleSocketEvent(event) {
    if (!event || !this.activeIncidentId) return;

    // 1. SOS Confirmed Event
    if (event.type === 'SOS_CONFIRMED') {
      if (this._isMatchingIncident(event.packetId || event.incidentId)) {
        await this.onSosConfirmed(event);
      }
      return;
    }

    // 2. Responder Acknowledged Event
    if (event.type === 'INCIDENT_ACKNOWLEDGED') {
      const incId = event.incidentId || event.packetId || event.clientRequestId || event._id;
      if (this._isMatchingIncident(incId)) {
        await this._handleStatusTransition('ACKNOWLEDGED', event);
      }
      return;
    }

    // 3. Status Update Event
    if (event.type === 'INCIDENT_UPDATED') {
      const incId = event.incidentId || event.packetId || event.clientRequestId || event._id;
      if (this._isMatchingIncident(incId)) {
        const statusUpper = (event.status || event.incident?.status || '').toUpperCase();
        await this._mapAndHandleStatus(statusUpper, event);
      }
      return;
    }
  }

  /**
   * REST Status Reconciliation (runs every 10s or upon reconnect)
   */
  async reconcileStatus() {
    if (!this.activeIncidentId) return;

    try {
      const lookupId = this.activeIncidentId || this.activePacketId;
      const res = await apiService.getEmergencyStatus(lookupId);
      const data = res?.data?.packet || res?.data?.incident || res?.packet || res?.incident || (res?.data?.status ? res.data : null);
      if (!data) return;

      // 1. Check Acknowledgement
      if (data.acknowledgement && data.acknowledgement.status === 'ACKNOWLEDGED') {
        await this._handleStatusTransition('ACKNOWLEDGED', data);
      }

      // 2. Check Operational Status
      const statusUpper = (data.status || '').toUpperCase();
      await this._mapAndHandleStatus(statusUpper, data);

      // Check deployed resources/timestamp (indicates dispatch)
      if (data.deployedAt || data.deployedResources?.length > 0) {
        await this._handleStatusTransition('DISPATCHED', data);
      }
    } catch (err) {
      // Gentle polling note - network drops are handled silently
    }
  }

  /**
   * Maps backend status strings to canonical lifecycle states
   */
  async _mapAndHandleStatus(statusUpper, eventData) {
    if (!statusUpper) return;

    if (statusUpper === 'ACKNOWLEDGED' || statusUpper === 'VERIFIED') {
      await this._handleStatusTransition('ACKNOWLEDGED', eventData);
    } else if (statusUpper === 'DISPATCHED' || statusUpper === 'EN_ROUTE') {
      await this._handleStatusTransition('DISPATCHED', eventData);
    } else if (statusUpper === 'IN_PROGRESS' || statusUpper === 'ON_SCENE') {
      await this._handleStatusTransition('IN_PROGRESS', eventData);
    } else if (
      statusUpper === 'RESOLVED' ||
      statusUpper === 'COMPLETED' ||
      statusUpper === 'CLOSED'
    ) {
      await this._handleStatusTransition('COMPLETED', eventData);
      this.stopTracking();
    } else if (statusUpper === 'CANCELLED' || statusUpper === 'WITHDRAWN') {
      await this._handleStatusTransition('CANCELLED', eventData);
      this.stopTracking();
    }
  }

  /**
   * Handles a verified status transition for the active incident
   */
  async _handleStatusTransition(statusKey, eventData) {
    const id = this.activeIncidentId || this.activePacketId;
    if (!id) return;

    // Requirement 19 & 20: In background, ALWAYS fire notification.
    // In foreground, SOS_SENT always notifies; for other events, only notify if app is in background or not active.
    const isBackground = this.appState !== 'active';
    const shouldShowNotification = isBackground || statusKey === 'SOS_SENT';

    if (shouldShowNotification) {
      await this._triggerNotification(id, statusKey);
    } else {
      // Still mark as notified so transitioning to background immediately after doesn't replay
      await this._markAsNotified(id, statusKey);
    }

    this._notifySubscribers({
      type: 'INCIDENT_STATUS_CHANGED',
      status: statusKey,
      incidentId: id,
      data: eventData,
    });
  }

  /**
   * Verifies if an ID matches our currently tracked incident (SAME INCIDENT ONLY)
   */
  _isMatchingIncident(targetId) {
    if (!targetId || !this.activeIncidentId) return false;
    const t = String(targetId).toLowerCase();
    const actId = String(this.activeIncidentId).toLowerCase();
    const pktId = this.activePacketId ? String(this.activePacketId).toLowerCase() : '';

    return t === actId || (pktId && t === pktId);
  }

  /**
   * Displays an Android notification with deduplication protection
   */
  async _triggerNotification(incidentId, statusKey) {
    const dedupeKey = `${incidentId}:${statusKey}`;

    // Prevent duplicate notifications (Requirement 9)
    if (this.notifiedKeys.has(dedupeKey)) {
      return false;
    }

    const template = NOTIFICATION_TEMPLATES[statusKey];
    if (!template) return false;

    // Record deduplication key before firing
    await this._markAsNotified(incidentId, statusKey);

    console.log(`[IncidentLifecycleService] 🔔 Posting Notification: '${template.title}' for incident '${incidentId}'`);

    return await nativeNotificationService.showNotification({
      title: template.title,
      message: template.message,
      data: {
        incidentId: String(incidentId),
        status: statusKey,
        screen: 'STATUS',
      },
    });
  }

  async _markAsNotified(incidentId, statusKey) {
    const dedupeKey = `${incidentId}:${statusKey}`;
    this.notifiedKeys.add(dedupeKey);

    try {
      const arr = Array.from(this.notifiedKeys);
      // Keep last 100 entries to prevent unbounded storage growth
      const trimmed = arr.slice(-100);
      await storage.setItem(NOTIFIED_EVENTS_KEY, trimmed);
    } catch (_) {}
  }

  _startReconciliationPolling() {
    if (this.pollInterval) return;
    this.pollInterval = setInterval(() => {
      this.reconcileStatus().catch(() => {});
    }, 10000);
  }

  _stopReconciliationPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  _notifySubscribers(event) {
    this.subscribers.forEach((callback) => {
      try {
        callback(event);
      } catch (err) {
        console.warn('[IncidentLifecycleService] Subscriber callback error:', err.message);
      }
    });
  }

  subscribe(callback) {
    if (typeof callback === 'function') {
      this.subscribers.add(callback);
    }
    return () => {
      this.subscribers.delete(callback);
    };
  }
}

const incidentLifecycleService = new IncidentLifecycleService();
module.exports = incidentLifecycleService;
