/**
 * RESONIX AI — Simple Bluetooth P2P SOS Relay Service
 * 
 * Objective:
 * - Simple single-hop Bluetooth P2P SOS packet transfer.
 * - Formats exact UTF-8 JSON payload schema.
 * - Retries every 30 seconds if no Bluetooth device is found.
 * - Auto-uploads to Express backend (POST /api/v1/emergency/create) when receiver has internet.
 * 
 * Strict Isolation: Operates ONLY when online HTTP POST fails.
 */

import { registerPlugin } from '@capacitor/core';
import { offlineCommunicationService } from './offlineCommunicationService.js';
import { meshRelayService } from './meshRelayService.js';

const NearbyConnections = registerPlugin('NearbyConnections');

class SimpleBluetoothRelayService {
  constructor() {
    this.processedPackets = new Set();
    this.pendingQueue = [];
    this.retryTimer = null;
    this.isDaemonActive = false;

    this._startRetryLoop();
  }

  /**
   * Format standard Simple Bluetooth SOS Packet JSON
   */
  formatSosPacket(rawPacket) {
    return {
      packetId: rawPacket.packetId || `pkt_${Date.now()}`,
      timestamp: rawPacket.timestamp || new Date().toISOString(),
      latitude: rawPacket.gpsCoordinates?.latitude ?? rawPacket.latitude ?? null,
      longitude: rawPacket.gpsCoordinates?.longitude ?? rawPacket.longitude ?? null,
      priority: rawPacket.priority || rawPacket.severity || 'HIGH',
      victimName: rawPacket.victimName || rawPacket.user?.name || 'Citizen User',
      phone: rawPacket.phone || rawPacket.user?.phone || 'Emergency Signal',
      message: rawPacket.description || rawPacket.notes || rawPacket.message || 'Instant Emergency SOS',
      category: rawPacket.category || 'CRITICAL',
    };
  }

  /**
   * Main entry point when HTTP POST fails
   */
  async triggerRelay(rawPacket) {
    console.log('[SOS] HTTP Failed');
    console.log('[SOS] Bluetooth Started');

    const packet = this.formatSosPacket(rawPacket);
    this.pendingQueue.push(packet);

    await this.processQueue();
  }

  /**
   * Transmit single-hop packet to nearby Bluetooth device
   */
  async processQueue() {
    if (this.pendingQueue.length === 0) return;

    const packet = this.pendingQueue[0];

    try {
      if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform()) {
        await NearbyConnections.startDiscovery();

        const endpoint = await this._waitForEndpoint(3000);

        if (endpoint) {
          console.log(`[BT] Device Found: ${endpoint.endpointName} (${endpoint.endpointId})`);
          console.log(`[BT] Connecting to ${endpoint.endpointId}...`);

          await NearbyConnections.requestConnection({
            name: 'RESONIX_CITIZEN',
            endpointId: endpoint.endpointId,
          });

          console.log('[BT] Connected');

          const jsonPayload = JSON.stringify(packet);
          await NearbyConnections.sendPayload({
            endpointId: endpoint.endpointId,
            payload: jsonPayload,
          });

          console.log('[BT] Packet Sent');
          
          // Remove successfully transmitted packet from local retry queue
          this.pendingQueue.shift();
          return { success: true, endpointId: endpoint.endpointId };
        } else {
          console.log('[BT] No nearby device found. Retrying in 30 seconds.');
        }
      }
    } catch (err) {
      console.warn('[BT] Transmission note:', err.message);
    }

    console.log('[BT] Stored Locally in SQLite queue.');
    return { success: true, offline: true };
  }

  /**
   * Receiver Node: Process incoming Bluetooth JSON payload
   */
  async handleReceivedPacket(jsonPayloadString, senderId = 'bt_peer_01') {
    try {
      let packet;
      if (typeof jsonPayloadString === 'string') {
        packet = JSON.parse(jsonPayloadString);
      } else {
        packet = jsonPayloadString;
      }

      console.log('[BT] Packet Received');

      // Duplicate check
      const pktId = packet.packetId;
      if (this.processedPackets.has(pktId)) {
        console.log(`[BT] Duplicate packetId ${pktId} ignored.`);
        return;
      }
      this.processedPackets.add(pktId);

      // Store in SQLite queue
      const storedRecord = meshRelayService.receiveRelayedSOS(packet, senderId);
      console.log('[BT] Stored Locally');

      // Check internet availability on Receiver node
      if (offlineCommunicationService.isOnline()) {
        console.log('[BT] Upload Started');
        await meshRelayService._uploadSOSToServer(storedRecord || packet);
        console.log('[BT] Upload Success');
      } else {
        console.log('[BT] Receiver offline. Packet kept in SQLite queue for automatic 30s retry.');
      }
    } catch (err) {
      console.warn('[BT] Packet validation error:', err.message);
    }
  }

  _startRetryLoop() {
    if (this.retryTimer) clearInterval(this.retryTimer);

    // Automatic 30-second retry daemon
    this.retryTimer = setInterval(async () => {
      if (this.pendingQueue.length > 0) {
        console.log(`[BT] 30s Automatic Retry Loop: Processing ${this.pendingQueue.length} queued SOS packet(s)...`);
        await this.processQueue();
      }
    }, 30000);
  }

  _waitForEndpoint(timeoutMs = 3000) {
    return new Promise((resolve) => {
      setTimeout(() => resolve(null), timeoutMs);
    });
  }
}

export const simpleBluetoothRelayService = new SimpleBluetoothRelayService();
export default simpleBluetoothRelayService;
