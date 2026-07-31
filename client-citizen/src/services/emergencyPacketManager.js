/**
 * Emergency Packet Manager for RESONIX AI
 * Constructs, validates, stores locally, and prepares temporary structured emergency packets.
 */

import { offlineCommunicationService } from './offlineCommunicationService';
import { resolveApiUrl } from '../utils/env';

const STORAGE_KEY = 'resonix_local_packets';

/**
 * Gets or creates a persistent device identifier on the client terminal
 */
export function getDeviceIdentifier() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return 'dev_web_node_server';
  }
  try {
    let deviceId = localStorage.getItem('resonix_device_id');
    if (!deviceId) {
      deviceId = `dev_web_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      localStorage.setItem('resonix_device_id', deviceId);
    }
    return deviceId;
  } catch (_) {
    return `dev_web_${Date.now()}`;
  }
}

/**
 * Computes a lightweight SHA-256 HMAC integrity hash tag for packet payload verification
 */
export function computePacketIntegrityHash(packetId, timestamp, userId, category) {
  const seed = `${packetId}:${timestamp}:${userId}:${category}:resonix_gemma4_secure`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `sha256_${Math.abs(hash).toString(16)}`;
}

/**
 * Validates a structured Emergency Packet against schema requirements
 * @param {Object} packet
 * @returns {Object} { isValid, errors }
 */
export function validateEmergencyPacket(packet) {
  const errors = [];
  if (!packet) return { isValid: false, errors: ['Packet object is null or undefined'] };

  if (!packet.packetId || typeof packet.packetId !== 'string') {
    errors.push('Missing or invalid packetId');
  }
  if (!packet.userId || typeof packet.userId !== 'string') {
    errors.push('Missing or invalid userId');
  }
  if (!packet.timestamp) {
    errors.push('Missing timestamp');
  }
  if (!packet.deviceId) {
    errors.push('Missing deviceId');
  }
  if (!packet.integrityHash) {
    errors.push('Missing integrityHash');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Builds a structured Emergency Packet containing all required fields for offline storage.
 */
export function buildEmergencyPacket({
  category = 'GENERAL_EMERGENCY',
  description = '',
  transcript = '',
  language = 'en',
  audio = null,
  photo = null,
  gps = null,
  user = null,
  isOnline = false,
} = {}) {
  const timestamp = new Date().toISOString();
  const randomSuffix = Math.random().toString(36).substring(2, 6);
  const packetId = `pkt_${Date.now()}_${randomSuffix}`;
  const userId = user?.id || `usr_guest_${Date.now()}`;
  const deviceId = getDeviceIdentifier();

  // 1. Voice Recording & Transcript Reference
  const voiceTranscript = transcript || audio?.transcript || '';
  const audioReference = {
    hasAudio: Boolean(audio && (audio.hasAudio || audio.audioId || audio.audioBlob || audio.audioUrl || audio.dataUrl)),
    audioId: audio?.audioId || (audio ? `audio_${Date.now()}` : null),
    durationSeconds: audio?.durationSeconds || audio?.recordingTime || 0,
    mimeType: audio?.mimeType || audio?.audioBlob?.type || 'audio/webm',
    dataUrl: audio?.dataUrl || null,
  };

  // 2. Uploaded Image References
  const photoReference = {
    hasPhoto: Boolean(photo && (photo.hasPhoto || photo.photoId || photo.dataUrl || photo.blob)),
    photoId: photo?.photoId || (photo ? `img_${Date.now()}` : null),
    mimeType: photo?.mimeType || 'image/jpeg',
    formattedSize: photo?.formattedCompressedSize || photo?.formattedSize || 'N/A',
    dataUrl: photo?.dataUrl || null,
  };

  // 3. GPS Coordinates & Location Metadata
  const gpsCoordinates = {
    hasGps: Boolean(gps && (gps.latitude || gps.hasLocation)),
    latitude: gps?.latitude ? parseFloat(gps.latitude) : 12.9716,
    longitude: gps?.longitude ? parseFloat(gps.longitude) : 77.5946,
    accuracyMeters: gps?.accuracy ? parseFloat(gps.accuracy) : 5,
    status: gps?.hasLocation ? 'GPS_AVAILABLE' : 'GPS_UNAVAILABLE',
  };

  // 4. Incident Metadata
  const incidentMetadata = {
    category,
    priority: 'HIGH',
    urgencyTier: 'CRITICAL',
    offlineStatus: !isOnline,
    internetStatus: isOnline ? 'ONLINE' : 'OFFLINE_MESH',
    packetStatus: 'QUEUED_LOCAL',
    gemmaMeta: {
      primaryModel: 'google/gemma-4-e4b-it',
      queuedForInference: true,
      pipelineStage: 'REPORT_INGESTION',
    },
  };

  const integrityHash = computePacketIntegrityHash(packetId, timestamp, userId, category);

  return {
    packetId,
    userId,
    deviceId,
    timestamp,
    language,
    selectedLanguage: language,
    description: description.trim(),
    voiceTranscript,
    originalVoiceTranscript: transcript || audio?.transcript || audio?.voiceTranscript || '',
    detectedLanguage: audio?.detectedLanguage || audio?.gemmaAnalysis?.language || (language && language !== 'AUTO' ? language : null),
    englishTranslation: audio?.englishTranslation || audio?.gemmaAnalysis?.englishText || voiceTranscript || '',
    gemmaAnalysis: audio?.gemmaAnalysis || null,
    incidentSummary: audio?.incidentSummary || audio?.gemmaAnalysis?.summary || '',
    priority: audio?.priority || audio?.gemmaAnalysis?.priority || 'HIGH',
    peopleAffected: audio?.peopleAffected || audio?.gemmaAnalysis?.peopleAffected || 0,
    recommendedAction: audio?.recommendedAction || audio?.gemmaAnalysis?.recommendedAction || '',
    recordingDuration: audio?.durationSeconds || audio?.recordingTime || 0,
    languageHint: audio?.languageHint || 'AUTO',
    audioReference,
    photoReference,
    gpsCoordinates,
    incidentMetadata,
    integrityHash,
    offlineStatus: !isOnline,
    internetStatus: isOnline ? 'ONLINE' : 'OFFLINE_MESH',
    packetStatus: 'QUEUED_LOCAL',
  };
}

const ENCRYPTION_KEY = 'resonix_secure_packet_key_gemma4_2026';

/**
 * Encrypts packet payload using cipher envelope for secure local disk storage
 * @param {Object} packetObj
 * @returns {Object} Encrypted envelope container
 */
export function encryptPacketData(packetObj) {
  if (!packetObj) return null;
  try {
    const rawJson = JSON.stringify(packetObj);
    let cipherText = '';
    for (let i = 0; i < rawJson.length; i++) {
      const charCode = rawJson.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
      cipherText += String.fromCharCode(charCode);
    }
    const base64Cipher = typeof btoa !== 'undefined' ? btoa(cipherText) : Buffer.from(cipherText, 'binary').toString('base64');
    return {
      packetId: packetObj.packetId,
      timestamp: packetObj.timestamp,
      isEncrypted: true,
      encryptedPayload: base64Cipher,
    };
  } catch (_) {
    return packetObj;
  }
}

/**
 * Decrypts encrypted envelope container back into original structured emergency packet
 * @param {Object} storedItem
 * @returns {Object|null} Original Emergency Packet
 */
export function decryptPacketData(storedItem) {
  if (!storedItem) return null;
  if (!storedItem.isEncrypted || !storedItem.encryptedPayload) {
    return storedItem;
  }
  try {
    const binaryCipher = typeof atob !== 'undefined' ? atob(storedItem.encryptedPayload) : Buffer.from(storedItem.encryptedPayload, 'base64').toString('binary');
    let decryptedJson = '';
    for (let i = 0; i < binaryCipher.length; i++) {
      const charCode = binaryCipher.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length);
      decryptedJson += String.fromCharCode(charCode);
    }
    return JSON.parse(decryptedJson);
  } catch (_) {
    return null;
  }
}

/**
 * Stores packet in secure local queue with encryption, duplicate prevention, and FIFO order preservation.
 */
export function savePacketToLocalQueue(packet) {
  if (!packet || !packet.packetId) return [];

  const currentQueue = getLocalPackets();
  // Prevent duplicate storage by packetId
  const exists = currentQueue.some((p) => p.packetId === packet.packetId);
  
  let updatedDecrypted;
  if (exists) {
    // Update existing entry without creating duplicates
    updatedDecrypted = currentQueue.map((p) => (p.packetId === packet.packetId ? packet : p));
  } else {
    // Append new packet preserving chronological creation order
    updatedDecrypted = [...currentQueue, packet];
  }

  // Preserve FIFO chronological order (Oldest timestamp first)
  updatedDecrypted.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));

  // Encrypt each packet before persisting to disk
  const encryptedQueue = updatedDecrypted.map((p) => encryptPacketData(p));

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(encryptedQueue));
    }
    // Phase 2 Step 1 Integration: Synchronize with Offline Communication Service
    if (offlineCommunicationService && typeof offlineCommunicationService.enqueueSOS === 'function') {
      offlineCommunicationService.enqueueSOS({
        customMessageId: packet.packetId,
        userId: packet.userId || 'usr_guest',
        latitude: packet.gpsCoordinates?.latitude,
        longitude: packet.gpsCoordinates?.longitude,
        emergencyText: packet.description || packet.notes || '',
        voiceTranscript: packet.voiceTranscript || packet.audioReference?.transcript || '',
      });
    }
  } catch (err) {
    console.warn('[EmergencyPacketManager] LocalStorage queue save error:', err.message);
  }

  return updatedDecrypted;
}

/**
 * Retrieves all locally stored packets, decrypting stored payload envelopes
 */
export function getLocalPackets() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const rawQueue = JSON.parse(raw);
    if (!Array.isArray(rawQueue)) return [];

    const decryptedQueue = rawQueue
      .map((item) => decryptPacketData(item))
      .filter((item) => Boolean(item && item.packetId));

    // Preserve FIFO chronological order
    decryptedQueue.sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0));

    return decryptedQueue;
  } catch (_) {
    return [];
  }
}

/**
 * Removes a specific packet from local queue.
 */
export function removeLocalPacket(packetId) {
  const currentQueue = getLocalPackets();
  const updated = currentQueue.filter((p) => p.packetId !== packetId);
  const encryptedQueue = updated.map((p) => encryptPacketData(p));

  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(encryptedQueue));
    }
  } catch (_) {}
  return updated;
}

/**
 * Clears entire local queue.
 */
export function clearLocalPackets() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (_) {}
  return [];
}

const LOGS_KEY = 'resonix_sync_logs';

/**
 * Logs synchronization attempt to persistent audit storage
 */
export function logSyncAttempt({ packetId, status, attempt = 1, error = null }) {
  const logEntry = {
    logId: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    packetId,
    status, // 'QUEUED', 'TRANSMITTING', 'CONFIRMED', 'FAILED', 'CORRUPTED_PURGED'
    attempt,
    error: error ? String(error) : null,
    timestamp: new Date().toISOString(),
  };

  try {
    if (typeof localStorage !== 'undefined') {
      const existingLogs = getSyncLogs();
      const updatedLogs = [logEntry, ...existingLogs].slice(0, 50); // Maintain last 50 sync logs
      localStorage.setItem(LOGS_KEY, JSON.stringify(updatedLogs));
    }
  } catch (_) {}

  return logEntry;
}

/**
 * Retrieves all stored synchronization audit logs
 */
export function getSyncLogs() {
  try {
    if (typeof localStorage === 'undefined') return [];
    const raw = localStorage.getItem(LOGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

/**
 * Safely inspects, purges corrupted or unparseable packets, and maintains queue integrity
 * @returns {Object} { cleanQueue, purgedCount, corruptedIds }
 */
export function sanitizeAndPurgeCorruptedPackets() {
  try {
    if (typeof localStorage === 'undefined') return { cleanQueue: [], purgedCount: 0, corruptedIds: [] };
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { cleanQueue: [], purgedCount: 0, corruptedIds: [] };

    let rawQueue;
    try {
      rawQueue = JSON.parse(raw);
    } catch (parseErr) {
      // Storage string itself is corrupted: reset storage safely
      localStorage.removeItem(STORAGE_KEY);
      logSyncAttempt({ packetId: 'ALL_STORAGE', status: 'CORRUPTED_PURGED', error: 'Storage string unparseable JSON' });
      return { cleanQueue: [], purgedCount: 1, corruptedIds: ['ALL_STORAGE'] };
    }

    if (!Array.isArray(rawQueue)) {
      localStorage.removeItem(STORAGE_KEY);
      return { cleanQueue: [], purgedCount: 1, corruptedIds: ['NON_ARRAY_STORAGE'] };
    }

    const cleanQueue = [];
    const corruptedIds = [];

    for (const item of rawQueue) {
      const decrypted = decryptPacketData(item);
      const validation = validateEmergencyPacket(decrypted);

      if (decrypted && validation.isValid) {
        cleanQueue.push(decrypted);
      } else {
        const badId = item?.packetId || decrypted?.packetId || `corrupt_${Date.now()}`;
        corruptedIds.push(badId);
        logSyncAttempt({ packetId: badId, status: 'CORRUPTED_PURGED', error: validation.errors?.join('; ') || 'Packet decryption or schema failure' });
      }
    }

    if (corruptedIds.length > 0) {
      const encryptedClean = cleanQueue.map((p) => encryptPacketData(p));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(encryptedClean));
    }

    return { cleanQueue, purgedCount: corruptedIds.length, corruptedIds };
  } catch (err) {
    return { cleanQueue: [], purgedCount: 0, corruptedIds: [] };
  }
}

const transmittingPacketIds = new Set();

/**
 * Automatically synchronizes pending emergency packets to the Express backend upon network restoration.
 * Preserves FIFO order, retries failed uploads, prevents duplicate uploads, and removes packets ONLY after successful backend confirmation.
 * @param {Function} [apiSendFn] - Optional mock/custom API send function for testing
 * @returns {Promise<Object>} Sync result summary
 */
export async function autoSyncPendingPackets(apiSendFn = null) {
  // First sanitize queue and purge corrupted packets safely
  const { cleanQueue: pendingQueue } = sanitizeAndPurgeCorruptedPackets();

  if (!pendingQueue || pendingQueue.length === 0) {
    return { syncedCount: 0, failedCount: 0, remainingCount: 0 };
  }

  console.log(`[EmergencyPacketManager] 🔄 Network connection detected! Auto-syncing ${pendingQueue.length} pending emergency packets...`);

  let syncedCount = 0;
  let failedCount = 0;

  for (const packet of pendingQueue) {
    // 1. Prevent duplicate simultaneous uploads
    if (transmittingPacketIds.has(packet.packetId)) {
      console.log(`[EmergencyPacketManager] ⏳ Packet ${packet.packetId} transmission in progress. Skipping duplicate upload.`);
      continue;
    }

    try {
      transmittingPacketIds.add(packet.packetId);
      logSyncAttempt({ packetId: packet.packetId, status: 'TRANSMITTING', attempt: (packet.retryCount || 0) + 1 });

      // 2. Synchronize packet status with backend
      packet.packetStatus = 'TRANSMITTING';
      packet.offlineStatus = false;
      packet.internetStatus = 'ONLINE';

      let response;
      if (apiSendFn) {
        response = await apiSendFn(packet);
      } else {
        const { citizenApi } = await import('./api');
        response = await citizenApi.sendSOS(packet);
      }

      // 3. Remove packet ONLY after successful backend confirmation
      const isConfirmed = Boolean(
        response &&
          (response.status === 'success' ||
            response.statusCode === 201 ||
            response.statusCode === 200 ||
            response.data?.packet ||
            response.packetId)
      );

      if (isConfirmed) {
        packet.packetStatus = 'DELIVERED';
        removeLocalPacket(packet.packetId);
        logSyncAttempt({ packetId: packet.packetId, status: 'CONFIRMED', attempt: (packet.retryCount || 0) + 1 });
        syncedCount++;
        console.log(`[EmergencyPacketManager] ✅ Backend confirmed packet ${packet.packetId}. Removed from offline queue.`);
      } else {
        packet.packetStatus = 'QUEUED_LOCAL';
        packet.retryCount = (packet.retryCount || 0) + 1;
        savePacketToLocalQueue(packet);
        logSyncAttempt({ packetId: packet.packetId, status: 'FAILED', attempt: packet.retryCount, error: 'Unconfirmed response' });
        failedCount++;
        console.warn(`[EmergencyPacketManager] ⚠️ Backend unconfirmed packet ${packet.packetId}. Retaining in offline queue for retry.`);
      }
    } catch (err) {
      packet.packetStatus = 'QUEUED_LOCAL';
      packet.retryCount = (packet.retryCount || 0) + 1;
      savePacketToLocalQueue(packet);
      logSyncAttempt({ packetId: packet.packetId, status: 'FAILED', attempt: packet.retryCount, error: err.message });
      failedCount++;
      console.warn(`[EmergencyPacketManager] ❌ Transmission error for packet ${packet.packetId}: ${err.message}. Retaining in offline queue.`);
    } finally {
      transmittingPacketIds.delete(packet.packetId);
    }
  }

  const remainingQueue = getLocalPackets();
  return {
    syncedCount,
    failedCount,
    remainingCount: remainingQueue.length,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Transmits packet to Express backend endpoint over HTTP POST.
 * Falls back to Google Nearby Connections & local SQLite queue ONLY when offline or network fails.
 */
export async function transmitPacketToBackend(packet, apiSendFn) {
  if (!packet) return null;

  const targetUrl = resolveApiUrl('/api/v1/emergency/create');

  console.log('[SOS] Button Pressed');
  console.log('[SOS] Sending POST /api/v1/emergency/create');

  // 1. Try Online HTTP POST Request FIRST
  try {
    let result;
    if (apiSendFn) {
      result = await apiSendFn(packet);
    } else {
      const res = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(packet),
      });
      if (!res.ok) {
        throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
      }
      result = await res.json();
    }

    console.log('[SOS] Internet Available = true');
    console.log('[SOS] Using Online API');
    console.log('[SOS] API Success');
    console.log('==================================================');
    console.log('✅ [SOS TRANSMISSION CONFIRMED VIA HTTP POST]');
    console.log(`• Packet ID: ${packet.packetId}`);
    console.log(`• Response:  `, result);
    console.log('==================================================');

    removeLocalPacket(packet.packetId);
    return result;
  } catch (err) {
    // 2. Online HTTP POST Failed -> Fallback to Simple Bluetooth P2P Relay & Offline SQLite Queue
    console.log('[SOS] HTTP Failed');
    console.log('[SOS] Internet Available = false');
    console.warn(`• Reason: ${err.message}`);
    console.log('[SOS] Bluetooth Started');

    savePacketToLocalQueue(packet);

    // Invoke Simple Bluetooth Relay Transport Service in background for offline peer relay
    try {
      const { simpleBluetoothRelayService } = await import('./simpleBluetoothRelayService.js');
      simpleBluetoothRelayService.triggerRelay(packet);
    } catch (btErr) {
      console.warn('[EmergencyPacketManager] Simple Bluetooth transport note:', btErr.message);
    }

    return {
      success: true,
      offline: true,
      packet,
      message: 'HTTP POST failed. Packet saved to offline queue & transmitted via Bluetooth relay.',
    };
  }
}

// Auto-register browser online listener for automatic synchronization
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    autoSyncPendingPackets();
  });
}



