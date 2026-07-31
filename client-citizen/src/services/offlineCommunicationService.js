/**
 * RESONIX AI — Offline Communication Service (Phase 2, Step 1)
 * 
 * Responsibilities:
 * - Detect network availability & automatically switch between Online / Offline states.
 * - Maintain an Offline Mode state with pub/sub event listeners.
 * - Generate persistent, unique Device ID and globally unique Message ID for every SOS.
 * - Manage a local, persistent queue of pending SOS messages surviving app restarts.
 * - Record all required telemetry: Message ID, User ID, Device ID, Timestamp, Latitude, Longitude,
 *   Emergency Text, Voice Transcript, Delivery Status, Relay Count (0), and Relay History ([]).
 * 
 * ISOLATED MODULE — Does NOT alter existing APIs, Gemma AI, Authentication, or MongoDB architecture.
 */

import { sqliteStorageEngine } from './sqliteStorageEngine.js';

const STORAGE_KEYS = {
  DEVICE_ID: 'resonix_device_id',
  SOS_QUEUE: 'resonix_offline_sos_messages',
  LAST_KNOWN_GPS: 'resonix_last_known_gps',
};

export const DELIVERY_STATUS = {
  QUEUED: 'QUEUED',
  PENDING_QUEUED: 'QUEUED',
  DISCOVERING: 'DISCOVERING',
  FORWARDED: 'FORWARDED',
  TRANSMITTING: 'UPLOADED',
  UPLOADED: 'UPLOADED',
  DELIVERED: 'DELIVERED',
  RELAYED: 'FORWARDED',
};

class OfflineCommunicationService {
  constructor() {
    this.networkSubscribers = new Set();
    this.queueSubscribers = new Set();

    this._isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    this._deviceId = this._initDeviceId();

    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this._handleNetworkChange(true));
      window.addEventListener('offline', () => this._handleNetworkChange(false));
    }
  }

  // --- Network Availability & Offline Mode State ---

  isOnline() {
    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
      return navigator.onLine;
    }
    return Boolean(this._isOnline);
  }

  isOffline() {
    return !this.isOnline();
  }

  getNetworkStatus() {
    return this.isOnline() ? 'ONLINE' : 'OFFLINE';
  }

  /**
   * Subscribe to network state changes (online/offline)
   * @param {Function} callback - Called with boolean isOnline
   * @returns {Function} Unsubscribe function
   */
  onNetworkStateChange(callback) {
    if (typeof callback === 'function') {
      this.networkSubscribers.add(callback);
      // Immediately emit current state
      callback(this.isOnline());
    }
    return () => this.networkSubscribers.delete(callback);
  }

  _handleNetworkChange(onlineStatus) {
    const previousState = this._isOnline;
    this._isOnline = onlineStatus;

    if (previousState !== onlineStatus) {
      console.log(`[OfflineCommunicationService] 📡 Network state switched: ${previousState ? 'ONLINE' : 'OFFLINE'} -> ${onlineStatus ? 'ONLINE' : 'OFFLINE'}`);
      this.networkSubscribers.forEach((cb) => {
        try {
          cb(this._isOnline);
        } catch (err) {
          console.warn('[OfflineCommunicationService] Subscriber callback error:', err.message);
        }
      });
    }
  }

  // --- Device ID & Message ID Generation ---

  _initDeviceId() {
    try {
      if (typeof localStorage !== 'undefined') {
        let existingId = localStorage.getItem(STORAGE_KEYS.DEVICE_ID);
        if (!existingId) {
          existingId = `dev_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
          localStorage.setItem(STORAGE_KEYS.DEVICE_ID, existingId);
        }
        return existingId;
      }
    } catch (_) {}
    return `dev_session_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  }

  getDeviceId() {
    return this._deviceId;
  }

  /**
   * Generates a globally unique Message ID for every SOS
   * @returns {string} Unique message ID
   */
  generateMessageId() {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    return `sos_msg_${timestamp}_${randomSuffix}`;
  }

  // --- SOS Message Telemetry & Persistent Queue ---

  /**
   * Creates a new SOS message record with full required telemetry fields
   * @param {Object} payload
   * @returns {Object} Structured SOS Message object
   */
  createSOSRecord({
    userId = 'usr_guest',
    latitude = null,
    longitude = null,
    emergencyText = '',
    voiceTranscript = '',
    customMessageId = null,
  } = {}) {
    const messageId = customMessageId || this.generateMessageId();
    const timestamp = new Date().toISOString();

    return {
      messageId,
      userId: userId || 'usr_guest',
      deviceId: this.getDeviceId(),
      timestamp,
      latitude: latitude !== null && !isNaN(Number(latitude)) ? Number(latitude) : null,
      longitude: longitude !== null && !isNaN(Number(longitude)) ? Number(longitude) : null,
      emergencyText: String(emergencyText || '').trim(),
      voiceTranscript: String(voiceTranscript || '').trim(),
      deliveryStatus: DELIVERY_STATUS.PENDING_QUEUED,
      relayCount: 0,
      relayHistory: [],
    };
  }

  /**
   * Enqueues an SOS message into persistent storage (survives app restarts)
   * @param {Object} sosPayload
   * @returns {Object} Enqueued SOS Record
   */
  enqueueSOS(sosPayload) {
    const sosRecord = sosPayload.messageId && sosPayload.deviceId
      ? sosPayload
      : this.createSOSRecord(sosPayload);

    const queue = this.getPendingQueue();

    // Prevent duplicate entries
    const existingIndex = queue.findIndex((m) => m.messageId === sosRecord.messageId || m.sosId === sosRecord.messageId);
    if (existingIndex >= 0) {
      queue[existingIndex] = sosRecord;
    } else {
      queue.push(sosRecord);
    }

    this._saveQueue(queue);
    
    // Save to SQLite Storage Engine asynchronously
    try {
      sqliteStorageEngine.saveSOS({
        sosId: sosRecord.messageId || sosRecord.sosId,
        packetId: sosRecord.messageId || sosRecord.sosId,
        userId: sosRecord.userId,
        timestamp: sosRecord.timestamp,
        latitude: sosRecord.latitude,
        longitude: sosRecord.longitude,
        address: sosRecord.address || 'GPS Location',
        priority: sosRecord.priority || 'HIGH',
        message: sosRecord.emergencyText || sosRecord.message || '',
        imagePath: sosRecord.imagePath || sosRecord.photoReference?.dataUrl,
        voicePath: sosRecord.voicePath || sosRecord.audioReference?.dataUrl,
        deliveryStatus: sosRecord.deliveryStatus || 'QUEUED',
        retryCount: sosRecord.retryCount || 0,
        relayCount: sosRecord.relayCount || 0,
        relayHistory: sosRecord.relayHistory || [],
      });
    } catch (_) {}

    this._notifyQueueChange(queue);

    console.log(`[OfflineCommunicationService] 📥 Enqueued SOS message ${sosRecord.messageId} (Status: ${sosRecord.deliveryStatus}, Queue size: ${queue.length})`);
    return sosRecord;
  }

  /**
   * Retrieves all pending SOS messages from persistent storage
   * @returns {Array<Object>} List of stored SOS Records
   */
  getPendingQueue() {
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(STORAGE_KEYS.SOS_QUEUE);
        if (raw) {
          const parsed = JSON.parse(raw);
          return Array.isArray(parsed) ? parsed : [];
        }
      }
    } catch (err) {
      console.warn('[OfflineCommunicationService] Failed to read SOS queue from storage:', err.message);
    }
    return [];
  }

  /**
   * Updates delivery status or relay metadata for a specific SOS message
   * @param {string} messageId
   * @param {string} deliveryStatus
   * @param {Object} [relayData] - Optional relay node metadata
   */
  updateMessageStatus(messageId, deliveryStatus, relayData = null) {
    const queue = this.getPendingQueue();
    const target = queue.find((m) => m.messageId === messageId);

    if (target) {
      if (Object.values(DELIVERY_STATUS).includes(deliveryStatus)) {
        target.deliveryStatus = deliveryStatus;
      }

      if (relayData) {
        target.relayCount = (target.relayCount || 0) + 1;
        target.relayHistory = target.relayHistory || [];
        target.relayHistory.push({
          relayedAt: new Date().toISOString(),
          relayNodeId: relayData.relayNodeId || 'node_unknown',
          rssi: relayData.rssi || null,
        });
      }

      this._saveQueue(queue);
      this._notifyQueueChange(queue);
      return target;
    }
    return null;
  }

  /**
   * Removes a specific SOS message from persistent queue upon delivery confirmation
   * @param {string} messageId
   * @returns {boolean} True if removed
   */
  removeMessage(messageId) {
    const queue = this.getPendingQueue();
    const filtered = queue.filter((m) => m.messageId !== messageId);
    if (filtered.length !== queue.length) {
      this._saveQueue(filtered);
      this._notifyQueueChange(filtered);
      console.log(`[OfflineCommunicationService] 🗑️ Removed SOS message ${messageId} from persistent queue.`);
      return true;
    }
    return false;
  }

  /**
   * Clears the entire local offline queue
   */
  clearQueue() {
    this._saveQueue([]);
    this._notifyQueueChange([]);
    console.log('[OfflineCommunicationService] 🧹 Offline queue cleared.');
    return [];
  }

  /**
   * Subscribe to queue state updates
   * @param {Function} callback - Called with updated queue array
   * @returns {Function} Unsubscribe function
   */
  onQueueChange(callback) {
    if (typeof callback === 'function') {
      this.queueSubscribers.add(callback);
      callback(this.getPendingQueue());
    }
    return () => this.queueSubscribers.delete(callback);
  }

  // --- Private Helpers ---

  _saveQueue(queue) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.SOS_QUEUE, JSON.stringify(queue));
      }
    } catch (err) {
      console.warn('[OfflineCommunicationService] Failed to persist SOS queue:', err.message);
    }
  }

  _notifyQueueChange(queue) {
    this.queueSubscribers.forEach((cb) => {
      try {
        cb(queue);
      } catch (err) {
        console.warn('[OfflineCommunicationService] Queue subscriber callback error:', err.message);
      }
    });
  }
}

// Export singleton instance
export const offlineCommunicationService = new OfflineCommunicationService();
export default offlineCommunicationService;
