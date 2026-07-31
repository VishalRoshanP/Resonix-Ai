/**
 * RESONIX AI — Automatic Synchronization Service (Phase 2, Step 4)
 * 
 * Responsibilities:
 * - Continuously monitor network connectivity transitions (Offline -> Online).
 * - When internet becomes available:
 *   • Upload all pending SOS messages.
 *   • Upload relay history array.
 *   • Upload relay count integer.
 *   • Upload GPS coordinates (latitude, longitude).
 *   • Upload ISO timestamps.
 *   • Mark messages as Delivered ('DELIVERED').
 *   • Remove uploaded messages from persistent storage queue.
 * - If upload fails:
 *   • Schedule automatic retry with exponential backoff (3s, 6s, 12s, 24s).
 *   • NEVER lose an SOS message (Retain in persistent storage until confirmed).
 * - Generate structured debugging logs for observability.
 * 
 * ISOLATED MODULE — Does NOT alter existing APIs, Gemma AI, Authentication, or MongoDB architecture.
 */

import { offlineCommunicationService, DELIVERY_STATUS } from './offlineCommunicationService.js';
import { citizenApi } from './api.js';

export const MAX_SYNC_LOGS = 50;
export const INITIAL_RETRY_DELAY_MS = 3000;
export const MAX_RETRY_DELAY_MS = 30000;

class AutoSyncService {
  constructor() {
    this.isSyncing = false;
    this.lastSyncTimestamp = null;
    this.syncSubscribers = new Set();
    this.syncLogs = [];
    this.retryAttemptsMap = new Map();
    this.retryTimersMap = new Map();

    this.startAutoSyncMonitoring();
  }

  // --- Network Monitoring & Event Initialization ---

  /**
   * Starts continuous network monitoring for automatic background synchronization
   */
  startAutoSyncMonitoring() {
    console.log('[AutoSyncService] 🔄 Automatic Synchronization Service monitoring initialized.');

    // Listen to network state transitions (Offline -> Online)
    offlineCommunicationService.onNetworkStateChange((isOnline) => {
      this._addLog(`Network state changed: ${isOnline ? 'ONLINE 🌐' : 'OFFLINE 📴'}`);
      if (isOnline) {
        console.log('[AutoSyncService] 🌐 Internet connectivity detected! Triggering automatic pending SOS batch sync...');
        this.triggerSyncNow();
      }
    });

    // Also trigger initial sync check on service startup if online
    if (offlineCommunicationService.isOnline()) {
      setTimeout(() => this.triggerSyncNow(), 1000);
    }
  }

  /**
   * Subscribe to sync state & log updates
   * @param {Function} callback
   * @returns {Function} Unsubscribe function
   */
  onSyncEvent(callback) {
    if (typeof callback === 'function') {
      this.syncSubscribers.add(callback);
      callback(this.getSyncState());
    }
    return () => this.syncSubscribers.delete(callback);
  }

  getSyncState() {
    return {
      isSyncing: this.isSyncing,
      lastSyncTimestamp: this.lastSyncTimestamp,
      pendingCount: offlineCommunicationService.getPendingQueue().length,
      syncLogs: [...this.syncLogs],
    };
  }

  _notifySubscribers() {
    const state = this.getSyncState();
    this.syncSubscribers.forEach((cb) => {
      try {
        cb(state);
      } catch (_) {}
    });
  }

  _addLog(message, level = 'INFO') {
    const logEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString(),
      message,
      level,
    };

    this.syncLogs.unshift(logEntry);
    if (this.syncLogs.length > MAX_SYNC_LOGS) {
      this.syncLogs = this.syncLogs.slice(0, MAX_SYNC_LOGS);
    }

    if (level === 'ERROR') {
      console.error(`[AutoSyncService] ❌ ${message}`);
    } else if (level === 'WARN') {
      console.warn(`[AutoSyncService] ⚠️ ${message}`);
    } else {
      console.log(`[AutoSyncService] ℹ️ ${message}`);
    }

    this._notifySubscribers();
  }

  // --- Core Automatic Batch Sync Implementation ---

  /**
   * Triggers an immediate synchronization run for all pending SOS messages
   */
  async triggerSyncNow() {
    if (this.isSyncing) {
      console.log('[AutoSyncService] Synchronization run already in progress. Skipping.');
      return;
    }

    if (offlineCommunicationService.isOffline()) {
      this._addLog('Sync trigger requested, but terminal is OFFLINE. Postponing until internet is available.', 'WARN');
      return;
    }

    const pendingQueue = offlineCommunicationService.getPendingQueue();
    const syncCandidates = pendingQueue.filter(
      (msg) => msg.deliveryStatus !== DELIVERY_STATUS.DELIVERED
    );

    if (syncCandidates.length === 0) {
      this._addLog('No pending SOS messages requiring synchronization.');
      return;
    }

    this.isSyncing = true;
    this._addLog(`Starting batch sync for ${syncCandidates.length} pending SOS message(s)...`);

    let successCount = 0;
    let failureCount = 0;

    for (const sosRecord of syncCandidates) {
      const syncSuccess = await this._syncSingleSOSMessage(sosRecord);
      if (syncSuccess) {
        successCount++;
      } else {
        failureCount++;
      }
    }

    this.isSyncing = false;
    this.lastSyncTimestamp = new Date().toISOString();

    this._addLog(`Batch sync cycle completed. Success: ${successCount}, Failures: ${failureCount}. Remaining in queue: ${offlineCommunicationService.getPendingQueue().length}`);
  }

  /**
   * Synchronizes a single SOS message with full telemetry payload to Express backend
   * @private
   * @param {Object} sosRecord
   * @returns {Promise<boolean>} True if server acknowledged delivery
   */
  async _syncSingleSOSMessage(sosRecord) {
    const messageId = sosRecord.messageId;

    try {
      this._addLog(`Synchronizing SOS ${messageId} (Relay Count: ${sosRecord.relayCount || 0}, History Hops: ${sosRecord.relayHistory?.length || 0})...`);

      // Construct comprehensive payload preserving all telemetry fields
      const syncPayload = {
        packetId: messageId,
        userId: sosRecord.userId || 'usr_guest',
        deviceId: sosRecord.deviceId,
        timestamp: sosRecord.timestamp,
        description: sosRecord.emergencyText || '',
        voiceTranscript: sosRecord.voiceTranscript || '',
        category: 'FLOOD',
        selectedLanguage: 'en',
        gpsCoordinates: {
          latitude: sosRecord.latitude,
          longitude: sosRecord.longitude,
          status: sosRecord.latitude !== null ? 'GPS_AVAILABLE' : 'GPS_UNAVAILABLE',
        },
        relayMetadata: {
          relayCount: sosRecord.relayCount || 0,
          relayHistory: sosRecord.relayHistory || [],
        },
        deliveryStatus: sosRecord.deliveryStatus,
      };

      // Transmit to Express backend API endpoint
      const response = await citizenApi.sendSOS(syncPayload);

      // Verify server acknowledgement
      const isAcknowledged = Boolean(
        response &&
          (response.status === 'success' ||
            response.statusCode === 201 ||
            response.statusCode === 200 ||
            response.data?.packet ||
            response.packetId)
      );

      if (isAcknowledged) {
        // Mark message as DELIVERED in status
        offlineCommunicationService.updateMessageStatus(messageId, DELIVERY_STATUS.DELIVERED);

        // Remove confirmed message from local persistent storage
        const removed = offlineCommunicationService.removeMessage(messageId);

        // Clear retry count tracking
        this.retryAttemptsMap.delete(messageId);
        if (this.retryTimersMap.has(messageId)) {
          clearTimeout(this.retryTimersMap.get(messageId));
          this.retryTimersMap.delete(messageId);
        }

        this._addLog(`✅ Server confirmed delivery for SOS ${messageId}. Status updated to DELIVERED and removed from local queue.`);
        return true;
      } else {
        throw new Error('Server returned unconfirmed response status');
      }
    } catch (err) {
      this._addLog(`❌ Sync failed for SOS ${messageId}: ${err.message}. Retaining in persistent queue for auto-retry.`, 'ERROR');
      
      // Schedule automatic retry with exponential backoff (Never lose an SOS)
      this._scheduleAutoRetry(sosRecord);
      return false;
    }
  }

  // --- Exponential Backoff Auto-Retry Handling ---

  _scheduleAutoRetry(sosRecord) {
    const messageId = sosRecord.messageId;
    const currentAttempts = (this.retryAttemptsMap.get(messageId) || 0) + 1;
    this.retryAttemptsMap.set(messageId, currentAttempts);

    // Clear existing timer if any
    if (this.retryTimersMap.has(messageId)) {
      clearTimeout(this.retryTimersMap.get(messageId));
    }

    // Calculate delay with exponential backoff: 3s, 6s, 12s, 24s (capped at 30s)
    const delayMs = Math.min(
      INITIAL_RETRY_DELAY_MS * Math.pow(2, currentAttempts - 1),
      MAX_RETRY_DELAY_MS
    );

    this._addLog(`🔄 Scheduled auto-retry for SOS ${messageId} in ${delayMs / 1000}s (Attempt #${currentAttempts})...`, 'WARN');

    const timer = setTimeout(() => {
      this.retryTimersMap.delete(messageId);
      if (offlineCommunicationService.isOnline()) {
        const queue = offlineCommunicationService.getPendingQueue();
        const target = queue.find((m) => m.messageId === messageId);
        if (target && target.deliveryStatus !== DELIVERY_STATUS.DELIVERED) {
          this._syncSingleSOSMessage(target);
        }
      }
    }, delayMs);

    this.retryTimersMap.set(messageId, timer);
  }
}

// Export singleton instance
export const autoSyncService = new AutoSyncService();
export default autoSyncService;
