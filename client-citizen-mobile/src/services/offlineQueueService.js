/**
 * Offline-First Store and Forward Queue Service for RESONIX AI Citizen Mobile
 * 
 * Phase 9 & Final BLE Mesh Transport Architecture:
 * 1. Build immutable emergency packet with stable physical device identity.
 * 2. Persist packet locally immediately in storage BEFORE attempting network transmission.
 * 3. Attempt Laptop B's API transport FIRST.
 * 4. IF API SUCCEEDS:
 *    - Cloud is authoritative transport.
 *    - Stop — DO NOT additionally transmit initial SOS through BLE.
 * 5. IF API FAILS (offline, unreachable, timeout, or server error):
 *    - Automatically fall back to BLE mesh in background.
 *    - Uses the exact SAME packetId, SAME emergency, and SAME source GPS coordinates.
 * 6. Dual-role Mesh Relay & Gateway:
 *    - Inbound packets deduplicated by immutable packetId.
 *    - Loop prevention: sender address & visited relayHistory excluded from peer selection.
 *    - Invariants: forwardHopCount = receivedHopCount + 1, forwardTtl = receivedTtl - 1.
 *    - If device has Internet: acts as GATEWAY and uploads immediately.
 *    - If device is offline: acts as RELAY and forwards over BLE mesh.
 * 7. Opportunistic forwarding & automatic recovery sync when network returns.
 */

const ENV = require('../config/env');
const storage = require('../utils/storage');
const apiService = require('./apiService');
const networkUtil = require('../utils/network');
const deviceIdentity = require('../utils/deviceIdentity');

const peerAddressMap = new Map();

class OfflineQueueService {
  constructor() {
    this._inFlightTransmissions = new Set();
    this._isSyncing = false;
    this._syncInterval = null;
  }

  /**
   * Step 1 & 2: Persist immutable packet locally immediately with PENDING status
   * BEFORE network transmission is attempted.
   */
  async createAndPersistLocalPacket(emergencyPayload) {
    const packetId = emergencyPayload.packetId || `pkt_mob_${Date.now()}`;
    const createdAt = emergencyPayload.timestamp || new Date().toISOString();

    let localDeviceId = 'REACT_NATIVE_ANDROID_CLIENT';
    try {
      localDeviceId = await deviceIdentity.getCanonicalDeviceId();
    } catch (_) {}

    const sourceDeviceId = emergencyPayload.sourceDeviceId || emergencyPayload.originDevice || emergencyPayload.deviceId || localDeviceId;
    const originDevice = sourceDeviceId;
    const deviceId = localDeviceId;
    const hopCount = emergencyPayload.hopCount != null ? Number(emergencyPayload.hopCount) : 0;
    const ttl = emergencyPayload.ttl != null ? Number(emergencyPayload.ttl) : 7;
    const initialRelayHistory = Array.isArray(emergencyPayload.relayHistory) && emergencyPayload.relayHistory.length > 0
      ? [...emergencyPayload.relayHistory]
      : Array.isArray(emergencyPayload.relayMetadata?.relayHistory) && emergencyPayload.relayMetadata.relayHistory.length > 0
      ? [...emergencyPayload.relayMetadata.relayHistory]
      : [sourceDeviceId];

    const initialRelayMetadata = emergencyPayload.relayMetadata || {
      relayCount: hopCount,
      relayHistory: initialRelayHistory,
      originDevice: sourceDeviceId,
    };

    const queueItem = {
      packetId,
      createdAt,
      syncStatus: 'PENDING',
      bleReceived: false,
      cloudDelivered: false,
      meshRelayed: false,
      meshHopAcknowledged: false,
      retryCount: 0,
      lastAttemptAt: null,
      serverId: null,
      payload: {
        ...emergencyPayload,
        packetId,
        incidentId: emergencyPayload.incidentId || packetId,
        timestamp: createdAt,
        sourceDeviceId,
        originDevice,
        deviceId,
        hopCount,
        ttl,
        relayHistory: initialRelayHistory,
        relayMetadata: initialRelayMetadata,
      },
    };

    try {
      const queue = (await storage.getItem(ENV.STORAGE_KEYS.OFFLINE_QUEUE)) || [];
      const updated = [
        ...queue.filter((q) => q.packetId !== packetId),
        queueItem,
      ];
      await storage.setItem(ENV.STORAGE_KEYS.OFFLINE_QUEUE, updated);
      console.log(`[OfflineQueue] Persisted packet '${packetId}' locally as PENDING before network attempt.`);
      return queueItem;
    } catch (err) {
      console.warn('[OfflineQueue] Local persistence warning:', err.message);
      return queueItem;
    }
  }

  /**
   * Step 3, 4, 7, 8: Attempts network transmission for a queue item
   * AUTOMATIC TRANSPORT SELECTION & CONCURRENCY GUARD:
   * - Tries API FIRST.
   * - IF API SUCCEEDS: API is transport. BLE is NOT used.
   * - IF API FAILS (offline, timeout, or server unreachable): automatically falls back to BLE Mesh
   *   with the SAME packetId, SAME payload, and SAME source GPS!
   * - Ensures only ONE active delivery operation per packetId at any time.
   */
  async processItemTransmission(packetId) {
    if (this._inFlightTransmissions.has(packetId)) {
      console.log(`[OfflineQueue] Transmission already in-flight for '${packetId}'. Skipping redundant concurrent call.`);
      return { inFlight: true, packetId };
    }
    this._inFlightTransmissions.add(packetId);

    try {
      const queue = (await storage.getItem(ENV.STORAGE_KEYS.OFFLINE_QUEUE)) || [];
      const itemIndex = queue.findIndex((q) => q.packetId === packetId);

      if (itemIndex === -1) {
        throw new Error(`Queue item '${packetId}' not found.`);
      }

      const item = queue[itemIndex];

      // If already acknowledged by server, skip redundant upload
      if (item.cloudDelivered && item.syncStatus === 'SYNCED') {
        return { success: true, item, alreadySynced: true };
      }

      item.syncStatus = 'SYNCING';
      item.lastAttemptAt = new Date().toISOString();
      item.retryCount += 1;
      await storage.setItem(ENV.STORAGE_KEYS.OFFLINE_QUEUE, queue);

      try {
        // Step 3: Attempt network transmission to Express backend
        const response = await apiService.createEmergency(item.payload);

        // Step 4A: Server acknowledged -> Mark SYNCED and set serverId
        // API SUCCEEDED -> BLE IS NOT USED
        const serverId = response.incident_id || response.masterPacketId || response.packetId || packetId;
        item.syncStatus = 'SYNCED';
        item.cloudDelivered = true;
        item.serverId = serverId;
        item.serverAckAt = new Date().toISOString();

        // Prevent unbounded offline queue growth while keeping recent history
        const activeQueue = queue.slice(-30);
        await storage.setItem(ENV.STORAGE_KEYS.OFFLINE_QUEUE, activeQueue);

        await this.saveLocalIncident({
          ...item.payload,
          incident_id: serverId,
          serverId,
          syncStatus: 'SYNCED',
          cloudDelivered: true,
          uiStatusMessage: 'Emergency received by command center',
          response,
        });

        console.log(`[OfflineQueue] Packet '${packetId}' SYNCED with serverId '${serverId}'. (API upload succeeded; BLE avoided)`);

        // Trigger verified SOS Sent notification
        try {
          const incidentLifecycleService = require('./incidentLifecycleService');
          incidentLifecycleService.onSosConfirmed({
            packetId,
            incident_id: serverId,
            ...item.payload,
          }).catch(() => {});
        } catch (_) {}

        return {
          success: true,
          item,
          response,
          uiStatusMessage: 'Emergency received by command center',
        };
      } catch (err) {
        // Step 4B: Network offline / API request failed -> KEEP IN QUEUE
        // Preserve RELAYING status if hop ACK was already received; otherwise FAILED_RETRYABLE
        console.warn(`[OfflineQueue] API transmission failed for '${packetId}' (Attempt ${item.retryCount}):`, err.message);

        item.syncStatus = item.meshHopAcknowledged ? 'RELAYING' : 'FAILED_RETRYABLE';
        item.cloudDelivered = false;
        item.lastError = err.message;
        await storage.setItem(ENV.STORAGE_KEYS.OFFLINE_QUEUE, queue);

        // Automatically fall back to BLE Mesh if item has remaining TTL
        try {
          const nativeBleMesh = require('./nativeBleMeshService').default || require('./nativeBleMeshService');
          const itemTtl = item.payload?.ttl != null ? Number(item.payload.ttl) : 7;
          if (nativeBleMesh && nativeBleMesh.isSupported && itemTtl > 0) {
            console.log(`[OfflineQueue] API unavailable — attempting Native BLE Mesh broadcast for '${packetId}'...`);
            nativeBleMesh.sendPacket(item.payload)
              .then((relayedId) => {
                console.log(`[OfflineQueue] ✅ BLE Mesh transfer confirmed with ACK_HOP for '${relayedId}'`);
              })
              .catch((bleErr) => {
                console.log(`[OfflineQueue] Background BLE broadcast notice:`, bleErr.message);
              });
          }
        } catch (bleInitErr) {
          console.warn('[OfflineQueue] Notice invoking BLE fallback:', bleInitErr.message);
        }

        const failedIncident = {
          ...item.payload,
          incident_id: packetId,
          syncStatus: item.syncStatus,
          uiStatusMessage: item.meshHopAcknowledged
            ? 'Relayed via BLE mesh — hop acknowledged'
            : 'Saved locally — relaying via BLE Mesh',
          lastError: err.message,
        };

        await this.saveLocalIncident(failedIncident);

        return {
          success: false,
          item,
          error: err.message,
          uiStatusMessage: item.meshHopAcknowledged
            ? 'Relayed via BLE mesh — hop acknowledged'
            : 'Saved locally — relaying via BLE Mesh',
        };
      }
    } finally {
      this._inFlightTransmissions.delete(packetId);
    }
  }

  /**
   * Step 5 & 6: Detects network restoration and automatically synchronizes all pending/failed/relaying items
   * Concurrency mutex and exponential backoff prevent battery drain and tight-loop retries.
   */
  async syncQueue(options = {}) {
    const force = options === true || Boolean(options?.force);
    if (this._isSyncing) {
      return { isSyncing: true, skipped: true };
    }
    this._isSyncing = true;

    try {
      const queue = (await storage.getItem(ENV.STORAGE_KEYS.OFFLINE_QUEUE)) || [];
      const pendingItems = queue.filter(
        (q) => (q.syncStatus === 'PENDING' || q.syncStatus === 'FAILED_RETRYABLE' || q.syncStatus === 'RELAYING') && !q.cloudDelivered
      );

      if (pendingItems.length === 0) {
        return { syncedCount: 0, failedCount: 0, pendingCount: 0 };
      }

      // Step 5: Check network restoration
      const health = await networkUtil.checkServerHealth();
      if (!health.isOnline) {
        console.log(`[OfflineQueue] Server offline. ${pendingItems.length} packet(s) remaining in queue.`);
        return { syncedCount: 0, failedCount: pendingItems.length, isOffline: true };
      }

      let syncedCount = 0;
      let failedCount = 0;

      // Step 6: Automatically synchronize sequentially with exponential backoff protection
      for (const item of pendingItems) {
        try {
          if (!force && item.retryCount > 0 && item.lastAttemptAt) {
            const timeSinceLastAttempt = Date.now() - new Date(item.lastAttemptAt).getTime();
            const backoffDelay = Math.min(30000, 2000 * Math.pow(1.5, Math.min(item.retryCount, 5)));
            if (timeSinceLastAttempt < backoffDelay) {
              console.log(`[OfflineQueue] Skipping packet '${item.packetId}' (Backoff: ${Math.round((backoffDelay - timeSinceLastAttempt) / 1000)}s remaining, retryCount=${item.retryCount})`);
              continue;
            }
          }

          const res = await this.processItemTransmission(item.packetId);
          if (res.success) {
            syncedCount++;
          } else {
            failedCount++;
          }
        } catch (err) {
          failedCount++;
        }
      }

      return { syncedCount, failedCount, isOffline: false };
    } finally {
      this._isSyncing = false;
    }
  }

  /**
   * Retrieves entire queue
   */
  async getQueue() {
    try {
      return (await storage.getItem(ENV.STORAGE_KEYS.OFFLINE_QUEUE)) || [];
    } catch (err) {
      return [];
    }
  }

  /**
   * Clears specific item from queue
   */
  async removeFromQueue(packetId) {
    try {
      const queue = (await storage.getItem(ENV.STORAGE_KEYS.OFFLINE_QUEUE)) || [];
      const updated = queue.filter((p) => p.packetId !== packetId);
      await storage.setItem(ENV.STORAGE_KEYS.OFFLINE_QUEUE, updated);
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Clears all items in the offline queue
   */
  async clearQueue() {
    try {
      await storage.removeItem(ENV.STORAGE_KEYS.OFFLINE_QUEUE);
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Saves local incident history cache
   */
  async saveLocalIncident(incident) {
    try {
      const history = (await storage.getItem(ENV.STORAGE_KEYS.INCIDENT_HISTORY)) || [];
      const packetId = incident.packetId || incident.incident_id;
      const updated = [
        incident,
        ...history.filter((h) => (h.packetId || h.incident_id) !== packetId),
      ].slice(0, 50);
      await storage.setItem(ENV.STORAGE_KEYS.INCIDENT_HISTORY, updated);
    } catch (err) {
      console.warn('[OfflineQueue] Failed to cache local incident:', err.message);
    }
  }

  /**
   * Gets local incident history
   */
  async getLocalIncidentHistory() {
    try {
      return (await storage.getItem(ENV.STORAGE_KEYS.INCIDENT_HISTORY)) || [];
    } catch (err) {
      return [];
    }
  }

  /**
   * Initializes listeners for inbound BLE mesh packets from nearby peers.
   * Handles deduplication, loop prevention, TTL preservation, and dual-role Relay/Gateway routing.
   */
  initBleMeshListener() {
    try {
      const nativeBleMesh = require('./nativeBleMeshService').default || require('./nativeBleMeshService');
      if (!nativeBleMesh || typeof nativeBleMesh.on !== 'function') return;

      nativeBleMesh.on('packetReceived', async (inboundPkt) => {
        try {
          console.log('[OfflineQueue] Handling inbound BLE mesh packet:', inboundPkt?.packetId);
          if (!inboundPkt?.packetId) return;

          const queue = (await storage.getItem(ENV.STORAGE_KEYS.OFFLINE_QUEUE)) || [];
          if (queue.some((q) => q.packetId === inboundPkt.packetId)) {
            console.log('[OfflineQueue] Inbound packet already in local queue. Dropping duplicate.');
            return;
          }

          let payload = {};
          try {
            payload = typeof inboundPkt.payloadJson === 'string' && inboundPkt.payloadJson.length > 0
              ? JSON.parse(inboundPkt.payloadJson)
              : inboundPkt;
          } catch (_) {
            payload = inboundPkt;
          }

          const senderAddress = inboundPkt.senderAddress || inboundPkt.receivedFromAddress || null;
          const receivedHopCount = inboundPkt.hopCount != null ? Number(inboundPkt.hopCount) : (payload.hopCount != null ? Number(payload.hopCount) : 0);
          const receivedTtl = inboundPkt.ttl != null ? Number(inboundPkt.ttl) : (payload.ttl != null ? Number(payload.ttl) : 7);
          const sourceDeviceId = payload.sourceDeviceId || payload.originDevice || payload.deviceId || 'DEV_ORIGIN_A';
          const receivedFromDeviceId = payload.deviceId || payload.currentRelayDeviceId || senderAddress || sourceDeviceId;

          let rawRelayHistory = Array.isArray(payload.relayHistory) && payload.relayHistory.length > 0
            ? [...payload.relayHistory]
            : Array.isArray(payload.relayMetadata?.relayHistory) && payload.relayMetadata.relayHistory.length > 0
            ? [...payload.relayMetadata.relayHistory]
            : [sourceDeviceId];

          // Record peer address mapping for loop prevention
          if (senderAddress && receivedFromDeviceId) {
            peerAddressMap.set(receivedFromDeviceId, senderAddress);
            peerAddressMap.set(senderAddress, receivedFromDeviceId);
          }

          let localDeviceId = 'DEV_RELAY';
          try {
            localDeviceId = await deviceIdentity.getCanonicalDeviceId();
          } catch (_) {}

          // Loop prevention: build exclusion lists
          const excludeAddresses = [];
          if (senderAddress) excludeAddresses.push(senderAddress);
          if (peerAddressMap.get(receivedFromDeviceId)) excludeAddresses.push(peerAddressMap.get(receivedFromDeviceId));
          for (const visitedDev of rawRelayHistory) {
            const mappedAddr = peerAddressMap.get(visitedDev);
            if (mappedAddr && !excludeAddresses.includes(mappedAddr)) {
              excludeAddresses.push(mappedAddr);
            }
          }

          const forwardRelayHistory = [...rawRelayHistory];
          if (!forwardRelayHistory.includes(localDeviceId)) {
            forwardRelayHistory.push(localDeviceId);
          }

          // Invariants: forwardHopCount = receivedHopCount + 1, forwardTtl = receivedTtl - 1
          const canForward = receivedTtl > 0;
          const forwardHopCount = receivedHopCount + 1;
          const forwardTtl = canForward ? receivedTtl - 1 : 0;

          const forwardPayload = {
            ...payload,
            packetId: inboundPkt.packetId,
            incidentId: payload.incidentId || inboundPkt.packetId,
            sourceDeviceId,
            originDevice: sourceDeviceId,
            deviceId: localDeviceId,
            currentRelayDeviceId: localDeviceId,
            receivedFromDeviceId,
            hopCount: forwardHopCount,
            ttl: forwardTtl,
            relayHistory: forwardRelayHistory,
            relayMetadata: {
              relayCount: forwardHopCount,
              relayHistory: forwardRelayHistory,
              originDevice: sourceDeviceId,
            },
            excludeAddresses,
            excludeAddress: senderAddress,
            excludeDeviceIds: forwardRelayHistory,
          };

          const queueItem = {
            packetId: inboundPkt.packetId,
            createdAt: new Date().toISOString(),
            syncStatus: 'PENDING',
            bleReceived: true,
            cloudDelivered: false,
            retryCount: 0,
            lastAttemptAt: null,
            serverId: null,
            receivedFromAddress: senderAddress,
            receivedFromDeviceId,
            receivedHopCount,
            receivedTtl,
            receivedRelayHistory: [...rawRelayHistory],
            canForward,
            payload: forwardPayload,
          };

          queue.push(queueItem);
          await storage.setItem(ENV.STORAGE_KEYS.OFFLINE_QUEUE, queue);
          console.log(`[OfflineQueue] Saved relayed packet '${inboundPkt.packetId}' into local queue (Received Hop: ${receivedHopCount}, TTL: ${receivedTtl}, Forward Hop: ${forwardHopCount}, TTL: ${forwardTtl}, Relays: [${forwardRelayHistory.join(', ')}]).`);

          if (!canForward) {
            console.log(`[OfflineQueue] Packet '${inboundPkt.packetId}' TTL <= 0 (${receivedTtl}). Dropping from forwarding.`);
            return;
          }

          // Attempt immediate gateway upload or BLE mesh relay
          try {
            const health = await networkUtil.checkServerHealth();
            if (health.isOnline) {
              console.log(`[OfflineQueue] Internet available! Uploading relayed packet '${inboundPkt.packetId}' to gateway...`);
              await this.processItemTransmission(inboundPkt.packetId);
            } else {
              console.log(`[OfflineQueue] Internet offline on relay — forwarding '${inboundPkt.packetId}' (Forward Hop: ${forwardHopCount}, TTL: ${forwardTtl}, Relays: [${forwardRelayHistory.join(', ')}], Excluded: [${excludeAddresses.join(', ')}])...`);
              nativeBleMesh.sendPacket(forwardPayload).catch((bleErr) => {
                console.log(`[OfflineQueue] Hop forwarding notice for ${inboundPkt.packetId}:`, bleErr.message);
              });
            }
          } catch (netErr) {
            console.log(`[OfflineQueue] Internet check notice, attempting BLE forward:`, netErr.message);
            nativeBleMesh.sendPacket(forwardPayload).catch((bleErr) => {
              console.log(`[OfflineQueue] Hop forwarding notice for ${inboundPkt.packetId}:`, bleErr.message);
            });
          }
        } catch (inboundErr) {
          console.warn('[OfflineQueue] Error processing inbound BLE packet:', inboundErr.message);
        }
      });

      let isForwarding = false;
      nativeBleMesh.on('peerDiscovered', async (peer) => {
        try {
          if (!peer || !peer.address || isForwarding) return;
          const queue = (await storage.getItem(ENV.STORAGE_KEYS.OFFLINE_QUEUE)) || [];

          let localDeviceId = 'DEV_RELAY';
          try {
            localDeviceId = await deviceIdentity.getCanonicalDeviceId();
          } catch (_) {}

          const pendingRelays = queue.filter((q) => {
            if (q.syncStatus !== 'PENDING' && q.syncStatus !== 'FAILED_RETRYABLE' && q.syncStatus !== 'RELAYING') return false;
            if (q.cloudDelivered) return false;
            const currentTtl = q.payload?.ttl != null ? Number(q.payload.ttl) : 7;
            if (currentTtl <= 0) return false;

            // Loop prevention: exclude peer if peer.address was the inbound sender
            if (q.receivedFromAddress && q.receivedFromAddress.toUpperCase() === peer.address.toUpperCase()) return false;

            // Loop prevention: exclude peer if already in relayHistory
            const history = q.payload?.relayHistory || q.payload?.relayMetadata?.relayHistory || [];
            const peerDevId = peerAddressMap.get(peer.address);
            if (peerDevId && history.includes(peerDevId)) return false;
            if (history.includes(peer.address)) return false;

            return true;
          });

          if (pendingRelays.length > 0) {
            isForwarding = true;
            console.log(`[OfflineQueue] Eligible peer discovered (${peer.address}). Forwarding ${pendingRelays.length} pending packet(s) via BLE mesh...`);
            for (const item of pendingRelays) {
              try {
                if (peer.nodeId) peerAddressMap.set(peer.nodeId, peer.address);

                const currentTtl = item.payload.ttl != null ? Number(item.payload.ttl) : 7;
                if (currentTtl <= 0) continue;

                const excludeAddresses = [];
                if (item.receivedFromAddress) excludeAddresses.push(item.receivedFromAddress);
                const history = item.payload.relayHistory || item.payload.relayMetadata?.relayHistory || [];
                for (const h of history) {
                  const addr = peerAddressMap.get(h);
                  if (addr && !excludeAddresses.includes(addr)) excludeAddresses.push(addr);
                }

                const forwardPayload = {
                  ...item.payload,
                  excludeAddresses,
                  excludeAddress: item.receivedFromAddress || null,
                  excludeDeviceIds: history,
                };

                await nativeBleMesh.sendPacket(forwardPayload);
              } catch (err) {
                console.log(`[OfflineQueue] Opportunistic BLE forward notice for ${item.packetId}:`, err.message);
              }
            }
            isForwarding = false;
          }
        } catch (peerErr) {
          isForwarding = false;
          console.warn('[OfflineQueue] Error during opportunistic peer forwarding:', peerErr.message);
        }
      });

      // Handle Hop-level relay acknowledgement from BLE mesh
      nativeBleMesh.on('packetRelayed', async (relayResult) => {
        try {
          if (!relayResult || !relayResult.packetId) return;
          console.log('[OfflineQueue] 🎯 Verified hop ACK received for relayed packet:', relayResult.packetId, 'target peer:', relayResult.targetAddress);
          const queue = (await storage.getItem(ENV.STORAGE_KEYS.OFFLINE_QUEUE)) || [];
          const idx = queue.findIndex((q) => q.packetId === relayResult.packetId);
          if (idx !== -1 && !queue[idx].cloudDelivered) {
            queue[idx].syncStatus = 'RELAYING';
            queue[idx].meshRelayed = true;
            queue[idx].meshHopAcknowledged = true;
            queue[idx].lastRelayedAt = new Date().toISOString();
            queue[idx].relayedToPeer = relayResult.targetAddress;
            await storage.setItem(ENV.STORAGE_KEYS.OFFLINE_QUEUE, queue);
            await this.saveLocalIncident({
              ...queue[idx].payload,
              syncStatus: 'RELAYING',
              meshRelayed: true,
              meshHopAcknowledged: true,
              uiStatusMessage: 'Relayed via BLE mesh — hop acknowledged',
            });
            console.log(`[OfflineQueue] Packet '${relayResult.packetId}' queued status updated to RELAYING (Hop Acknowledged).`);
          }
        } catch (relayErr) {
          console.warn('[OfflineQueue] Error processing packetRelayed event:', relayErr.message);
        }
      });

      // Handle native network state restoration event for instant auto-upload
      nativeBleMesh.on('networkStatusChanged', async (status) => {
        try {
          if (status?.isOnline) {
            console.log('[OfflineQueue] 🌐 Network restoration detected from native monitor! Triggering immediate sync...');
            await this.syncQueue({ force: true });
          }
        } catch (netStatusErr) {
          console.warn('[OfflineQueue] Error handling networkStatusChanged:', netStatusErr.message);
        }
      });

      nativeBleMesh.on('deliveryAck', async (ack) => {
        try {
          if (!ack || !ack.packetId) return;
          console.log('[OfflineQueue] Cloud delivery ACK received for packet:', ack.packetId);
          const queue = (await storage.getItem(ENV.STORAGE_KEYS.OFFLINE_QUEUE)) || [];
          const idx = queue.findIndex((q) => q.packetId === ack.packetId);
          if (idx !== -1) {
            queue[idx].syncStatus = 'SYNCED';
            queue[idx].cloudDelivered = true;
            queue[idx].serverId = ack.serverId || queue[idx].serverId || ack.packetId;
            queue[idx].serverAckAt = new Date().toISOString();
            await storage.setItem(ENV.STORAGE_KEYS.OFFLINE_QUEUE, queue);
            await this.saveLocalIncident({
              ...queue[idx].payload,
              incident_id: queue[idx].serverId,
              serverId: queue[idx].serverId,
              syncStatus: 'SYNCED',
              cloudDelivered: true,
              uiStatusMessage: 'Emergency delivered to command center via mesh',
            });
          }
        } catch (ackErr) {
          console.warn('[OfflineQueue] Error processing delivery ACK:', ackErr.message);
        }
      });
    } catch (listenerErr) {
      console.warn('[OfflineQueue] Notice initializing BLE mesh listener:', listenerErr.message);
    }
  }

  /**
   * Step 5 & 9: Auto-recovery network watcher.
   * Periodically checks for pending/offline items and automatically flushes them
   * as soon as Internet connectivity is restored.
   */
  startAutoSync(intervalMs = 3000) {
    if (this._syncInterval) return;
    this._syncInterval = setInterval(async () => {
      try {
        const queue = (await storage.getItem(ENV.STORAGE_KEYS.OFFLINE_QUEUE)) || [];
        const hasPending = queue.some(
          (q) => (q.syncStatus === 'PENDING' || q.syncStatus === 'FAILED_RETRYABLE') && !q.cloudDelivered
        );
        if (hasPending) {
          const health = await networkUtil.checkServerHealth();
          if (health.isOnline) {
            console.log('[OfflineQueue] 🌐 Internet connectivity detected! Auto-uploading pending offline queue items...');
            await this.syncQueue();
          }
        }
      } catch (_) {}
    }, intervalMs);
  }
}

const offlineQueueService = new OfflineQueueService();
offlineQueueService.initBleMeshListener();
offlineQueueService.startAutoSync();
module.exports = offlineQueueService;
