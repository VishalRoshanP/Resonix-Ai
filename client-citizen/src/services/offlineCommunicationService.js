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

export const SYNC_STATUS = {
  QUEUED: 'QUEUED',
  SYNCING: 'SYNCING',
  SYNCED: 'SYNCED',
  RETRYING: 'RETRYING',
  FAILED: 'FAILED',
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
  SYNCING: 'SYNCING',
  SYNCED: 'DELIVERED',
  RETRYING: 'RETRYING',
  FAILED: 'FAILED',
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
   * Generates a globally unique Client Event ID for every emergency report
   * @returns {string} Unique client event ID
   */
  generateClientEventId() {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    return `evt_${timestamp}_${randomSuffix}`;
  }

  /**
   * Generates a globally unique Message ID for every SOS (backward compatibility alias)
   * @returns {string} Unique message ID
   */
  generateMessageId() {
    return this.generateClientEventId();
  }

  // --- SOS Message Telemetry & Persistent Queue ---

  /**
   * Creates a new SOS message record with full required telemetry fields
   * @param {Object} payload
   * @returns {Object} Structured SOS Message object
   */
  createSOSRecord({
    clientEventId = null,
    customMessageId = null,
    clientRequestId = null,
    packetId = null,
    userId = 'usr_guest',
    timestamp = null,
    location = null,
    latitude = null,
    longitude = null,
    accuracy = null,
    address = null,
    category = 'GENERAL_EMERGENCY',
    citizenMessage = '',
    emergencyText = '',
    message = '',
    description = '',
    voiceTranscript = '',
    media = null,
    photoReference = null,
    audioReference = null,
    imagePath = null,
    voicePath = null,
    syncStatus = 'QUEUED',
    deliveryStatus = null,
    retryCount = 0,
    relayCount = 0,
    relayHistory = [],
  } = {}) {
    const eventId = clientEventId || clientRequestId || packetId || customMessageId || this.generateClientEventId();
    const nowIso = timestamp || new Date().toISOString();

    const normalizedLat = (location && location.latitude != null)
      ? Number(location.latitude)
      : (latitude != null && !isNaN(Number(latitude)) ? Number(latitude) : null);
    const normalizedLng = (location && location.longitude != null)
      ? Number(location.longitude)
      : (longitude != null && !isNaN(Number(longitude)) ? Number(longitude) : null);
    const normalizedAcc = (location && location.accuracy != null)
      ? Number(location.accuracy)
      : (accuracy != null && !isNaN(Number(accuracy)) ? Number(accuracy) : null);
    const normalizedAddr = (location && location.address) || address || (normalizedLat != null && normalizedLng != null ? `GPS: ${normalizedLat.toFixed(4)}, ${normalizedLng.toFixed(4)}` : 'GPS Location');

    const msg = citizenMessage || emergencyText || message || description || '';
    const transcript = voiceTranscript || '';

    // Standardized media array
    const mediaArray = Array.isArray(media) ? [...media] : [];
    if (photoReference && !mediaArray.some((m) => m.type === 'image' || m.photoId)) {
      mediaArray.push({ type: 'image', ...photoReference });
    }
    if (audioReference && !mediaArray.some((m) => m.type === 'audio' || m.audioId)) {
      mediaArray.push({ type: 'audio', ...audioReference });
    }
    if (imagePath && !mediaArray.some((m) => m.url === imagePath || m.path === imagePath)) {
      mediaArray.push({ type: 'image', path: imagePath, url: imagePath });
    }
    if (voicePath && !mediaArray.some((m) => m.url === voicePath || m.path === voicePath)) {
      mediaArray.push({ type: 'audio', path: voicePath, url: voicePath });
    }

    const effectiveSyncStatus = syncStatus || deliveryStatus || 'QUEUED';

    return {
      // 1. Target standard fields required by offline-first emergency reporting
      clientEventId: eventId,
      timestamp: nowIso,
      location: {
        latitude: normalizedLat,
        longitude: normalizedLng,
        accuracy: normalizedAcc,
        address: normalizedAddr,
      },
      category: String(category || 'GENERAL_EMERGENCY').trim().toUpperCase(),
      citizenMessage: String(msg).trim(),
      voiceTranscript: String(transcript).trim(),
      media: mediaArray,
      syncStatus: effectiveSyncStatus,

      // Backward-compatibility aliases
      messageId: eventId,
      clientRequestId: eventId,
      packetId: eventId,
      sosId: eventId,
      userId: userId || 'usr_guest',
      deviceId: this.getDeviceId(),
      latitude: normalizedLat,
      longitude: normalizedLng,
      emergencyText: String(msg).trim(),
      description: String(msg).trim(),
      message: String(msg).trim(),
      deliveryStatus: effectiveSyncStatus,
      photoReference: photoReference || null,
      audioReference: audioReference || null,
      imagePath: imagePath || null,
      voicePath: voicePath || null,
      retryCount: Number(retryCount) || 0,
      relayCount: Number(relayCount) || 0,
      relayHistory: Array.isArray(relayHistory) ? relayHistory : [],
      lastAttemptAt: null,
      lastError: null,
      serverAck: null,
    };
  }

  /**
   * Enqueues an SOS message into persistent storage (survives app restarts)
   * @param {Object} sosPayload
   * @returns {Object} Enqueued SOS Record
   */
  enqueueSOS(sosPayload) {
    const queue = this.getPendingQueue();
    const sosRecord = sosPayload.clientEventId && sosPayload.deviceId
      ? sosPayload
      : this.createSOSRecord(sosPayload);

    // Prevent duplicate entries across clientEventId, clientRequestId, messageId, packetId, and sosId
    const targetKey = sosRecord.clientEventId || sosRecord.clientRequestId || sosRecord.messageId || sosRecord.packetId || sosRecord.sosId;
    const existingIndex = queue.findIndex(
      (m) =>
        m &&
        (m.clientEventId === targetKey ||
          m.clientRequestId === targetKey ||
          m.messageId === targetKey ||
          m.sosId === targetKey ||
          m.packetId === targetKey ||
          (sosRecord.clientEventId && m.clientEventId === sosRecord.clientEventId) ||
          (sosRecord.clientRequestId && m.clientRequestId === sosRecord.clientRequestId) ||
          (sosRecord.messageId && m.messageId === sosRecord.messageId) ||
          (sosRecord.packetId && m.packetId === sosRecord.packetId))
    );
    if (existingIndex >= 0) {
      queue[existingIndex] = { ...queue[existingIndex], ...sosRecord };
    } else {
      queue.push(sosRecord);
    }

    this._saveQueue(queue);
    
    // Save to SQLite Storage Engine asynchronously
    try {
      sqliteStorageEngine.saveSOS({
        sosId: sosRecord.clientEventId || sosRecord.messageId || sosRecord.sosId,
        packetId: sosRecord.clientEventId || sosRecord.messageId || sosRecord.sosId,
        userId: sosRecord.userId,
        timestamp: sosRecord.timestamp,
        latitude: sosRecord.location?.latitude ?? sosRecord.latitude,
        longitude: sosRecord.location?.longitude ?? sosRecord.longitude,
        address: sosRecord.location?.address || sosRecord.address || 'GPS Location',
        priority: sosRecord.priority || 'HIGH',
        message: sosRecord.citizenMessage || sosRecord.emergencyText || sosRecord.message || '',
        imagePath: sosRecord.imagePath || sosRecord.photoReference?.dataUrl,
        voicePath: sosRecord.voicePath || sosRecord.audioReference?.dataUrl,
        deliveryStatus: sosRecord.syncStatus || sosRecord.deliveryStatus || 'QUEUED',
        retryCount: sosRecord.retryCount || 0,
        relayCount: sosRecord.relayCount || 0,
        relayHistory: sosRecord.relayHistory || [],
      });
    } catch (_) {}

    this._notifyQueueChange(queue);

    console.log(`[OfflineCommunicationService] 📥 Enqueued SOS message ${sosRecord.clientEventId} (Status: ${sosRecord.syncStatus}, Queue size: ${queue.length})`);
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
          if (Array.isArray(parsed)) {
            const activeQueue = parsed.filter((item) => {
              if (!item) return false;
              if (item.syncStatus === 'SYNCED' || item.deliveryStatus === 'DELIVERED' || item.deliveryStatus === 'CANCELLED') return false;
              return true;
            });
            if (activeQueue.length !== parsed.length) {
              this._saveQueue(activeQueue);
            }
            return activeQueue;
          }
        }
      }
    } catch (err) {
      console.warn('[OfflineCommunicationService] Failed to read SOS queue from storage:', err.message);
    }
    return [];
  }

  /**
   * Returns all pending emergency reports that have not yet been synced
   * @returns {Array<Object>}
   */
  getPendingReports() {
    return this.getPendingQueue().filter(
      (item) => item && item.syncStatus !== 'SYNCED' && item.deliveryStatus !== 'DELIVERED'
    );
  }

  /**
   * Returns count of pending emergency reports
   * @returns {number}
   */
  getPendingCount() {
    return this.getPendingReports().length;
  }

  /**
   * Updates delivery status or relay metadata for a specific SOS message
   * @param {string} messageId
   * @param {string} deliveryStatus
   * @param {Object} [relayData] - Optional relay node metadata
   */
  updateMessageStatus(messageId, deliveryStatus, relayData = null) {
    const queue = this.getPendingQueue();
    const target = queue.find(
      (m) =>
        m.clientEventId === messageId ||
        m.clientRequestId === messageId ||
        m.messageId === messageId ||
        m.packetId === messageId ||
        m.sosId === messageId
    );

    if (target) {
      if (Object.values(DELIVERY_STATUS).includes(deliveryStatus)) {
        target.deliveryStatus = deliveryStatus;
        if (deliveryStatus === 'DELIVERED') {
          target.syncStatus = 'SYNCED';
        }
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
   * Updates sync status, error, or server acknowledgement for a specific report
   * @param {string} clientEventId
   * @param {string} syncStatus - 'QUEUED' | 'SYNCING' | 'SYNCED' | 'RETRYING' | 'FAILED'
   * @param {string|null} [error]
   * @param {Object|null} [serverAck]
   * @returns {Object|null} Updated report record
   */
  updateReportSyncStatus(clientEventId, syncStatus, error = null, serverAck = null) {
    const queue = this.getPendingQueue();
    const target = queue.find(
      (m) =>
        m.clientEventId === clientEventId ||
        m.clientRequestId === clientEventId ||
        m.messageId === clientEventId ||
        m.packetId === clientEventId ||
        m.sosId === clientEventId
    );

    if (target) {
      target.syncStatus = syncStatus;
      target.deliveryStatus = syncStatus === 'SYNCED' ? 'DELIVERED' : (syncStatus === 'SYNCING' ? 'UPLOADED' : syncStatus);
      if (error) {
        target.lastError = String(error);
      }
      if (serverAck) {
        target.serverAck = serverAck;
      }
      if (syncStatus === 'RETRYING') {
        target.retryCount = (target.retryCount || 0) + 1;
        target.lastAttemptAt = new Date().toISOString();
      }
      this._saveQueue(queue);
      this._notifyQueueChange(queue);
      return target;
    }
    return null;
  }

  /**
   * Confirms successful server synchronization and removes report safely from pending queue
   * @param {string} clientEventId
   * @param {Object} [serverAck]
   * @returns {boolean} True if report was found and synced
   */
  markReportSynced(clientEventId, serverAck = null) {
    this.updateReportSyncStatus(clientEventId, 'SYNCED', null, serverAck);
    return this.removeReport(clientEventId);
  }

  /**
   * Removes a report from persistent queue upon delivery confirmation
   * @param {string} clientEventId
   * @returns {boolean} True if removed
   */
  removeReport(clientEventId) {
    const queue = this.getPendingQueue();
    const filtered = queue.filter(
      (m) =>
        m.clientEventId !== clientEventId &&
        m.clientRequestId !== clientEventId &&
        m.messageId !== clientEventId &&
        m.packetId !== clientEventId &&
        m.sosId !== clientEventId
    );
    if (filtered.length !== queue.length) {
      this._saveQueue(filtered);
      this._notifyQueueChange(filtered);
      console.log(`[OfflineCommunicationService] 🗑️ Removed report ${clientEventId} from persistent queue.`);
      return true;
    }
    return false;
  }

  /**
   * Removes a specific SOS message from persistent queue upon delivery confirmation (backward compatibility)
   * @param {string} messageId
   * @returns {boolean} True if removed
   */
  removeMessage(messageId) {
    return this.removeReport(messageId);
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
