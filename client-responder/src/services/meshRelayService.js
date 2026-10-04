/**
 * Production-Ready Mesh Relay Service for RESONIX AI (Responder Command Center)
 * 
 * Capabilities:
 * - Integrates directly with existing Offline Emergency Queue (emergencyPacketManager.js)
 * - Wraps real emergency packets into multi-hop mesh envelopes (No mock data)
 * - Prepares packet forwarding infrastructure (hopCount tracking, peer routing, TTL enforcement)
 * - Modular design preserving all existing backend API contracts and system architecture
 */

import {
  getLocalPackets,
  savePacketToLocalQueue,
  removeLocalPacket,
} from './emergencyPacketManager';
import { env } from '../utils/env';

export const MESH_PROTOCOLS = {
  BLE_BEACON: 'BLE_BEACON_V1',
  WEBRTC_DATACHANNEL: 'WEBRTC_DATACHANNEL_V1',
  WIFI_DIRECT: 'WIFI_DIRECT_P2P',
};

const RELAY_HISTORY_KEY = 'resonix_relay_history';

class MeshRelayService {
  constructor() {
    this.currentNodeId = this.getOrCreateNodeId();
    this.maxHops = 5;
    this.activePeers = new Set();
    this.forwardedEnvelopeIds = new Set();
    this.isForwarding = false;
  }

  getOrCreateNodeId() {
    if (typeof window === 'undefined' || !window.localStorage) {
      return 'NODE-COMMAND-CENTER';
    }
    try {
      let nodeId = localStorage.getItem('resonix_mesh_node_id');
      if (!nodeId) {
        nodeId = `NODE-COMMAND-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        localStorage.setItem('resonix_mesh_node_id', nodeId);
      }
      return nodeId;
    } catch (_) {
      return 'NODE-COMMAND-CENTER';
    }
  }

  logRelayEvent({ type, packetId, envelopeId, details, status }) {
    const entry = {
      historyId: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type,
      packetId,
      envelopeId,
      currentNodeId: this.currentNodeId,
      status,
      details,
      timestamp: new Date().toISOString(),
    };

    try {
      if (typeof localStorage !== 'undefined') {
        const existing = this.getRelayHistory();
        const updated = [entry, ...existing].slice(0, 50);
        localStorage.setItem(RELAY_HISTORY_KEY, JSON.stringify(updated));
      }
    } catch (_) {}

    return entry;
  }

  getRelayHistory() {
    try {
      if (typeof localStorage === 'undefined') return [];
      const raw = localStorage.getItem(RELAY_HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (_) {
      return [];
    }
  }

  wrapInRelayEnvelope(emergencyPacket, targetRelayId = 'GATEWAY-COMMAND-CENTER') {
    if (!emergencyPacket || !emergencyPacket.packetId) return null;

    return {
      relayEnvelopeId: `rly_env_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      hopCount: emergencyPacket.hopCount || 0,
      maxHops: this.maxHops,
      originNodeId: emergencyPacket.userId || this.currentNodeId,
      lastForwardedBy: this.currentNodeId,
      hopHistory: emergencyPacket.hopHistory || [this.currentNodeId],
      targetRelayId,
      payload: emergencyPacket,
      protocolVersion: MESH_PROTOCOLS.BLE_BEACON,
      createdAt: new Date().toISOString(),
      routingStatus: 'CARRYING',
    };
  }

  receiveAndCarryPacket(emergencyPacket, destinationNodeId = 'GATEWAY-COMMAND-CENTER') {
    if (!emergencyPacket || !emergencyPacket.packetId) {
      return { success: false, reason: 'INVALID_PACKET_PAYLOAD' };
    }

    if (this.forwardedEnvelopeIds.has(emergencyPacket.packetId)) {
      this.logRelayEvent({
        type: 'DUPLICATE_IGNORED',
        packetId: emergencyPacket.packetId,
        details: 'Packet already forwarded previously. Duplicate delivery prevented.',
        status: 'IGNORED',
      });
      return { success: false, reason: 'DUPLICATE_FORWARDING_PREVENTED' };
    }

    const envelope = this.wrapInRelayEnvelope(emergencyPacket, destinationNodeId);
    savePacketToLocalQueue(emergencyPacket);

    this.logRelayEvent({
      type: 'STORED_CARRYING',
      packetId: emergencyPacket.packetId,
      envelopeId: envelope.relayEnvelopeId,
      details: `Stored temporarily for carrying. Origin: '${envelope.originNodeId}', Target: '${destinationNodeId}'.`,
      status: 'CARRYING',
    });

    return {
      success: true,
      envelope,
      status: 'CARRYING',
      message: 'Packet received and stored temporarily in Store-Carry-Forward queue.',
    };
  }

  async autoForwardCarriedPackets(transportSendFn = null) {
    const queue = getLocalPackets();
    if (!queue || queue.length === 0) {
      return { forwardedCount: 0, remainingCount: 0 };
    }

    let forwardedCount = 0;

    for (const packet of queue) {
      if (this.forwardedEnvelopeIds.has(packet.packetId)) {
        continue;
      }

      const envelope = this.wrapInRelayEnvelope(packet);
      const result = await this.forwardRelayPacket(envelope, 'GATEWAY-COMMAND-CENTER', transportSendFn);

      if (result && result.success) {
        forwardedCount++;
        this.forwardedEnvelopeIds.add(packet.packetId);
      }
    }

    const remainingQueue = getLocalPackets();
    return {
      forwardedCount,
      remainingCount: remainingQueue.length,
      timestamp: new Date().toISOString(),
    };
  }

  async forwardRelayPacket(envelope, peerNodeId = 'GATEWAY-COMMAND-CENTER', transportSendFn = null) {
    if (!envelope || !envelope.payload) {
      return { success: false, reason: 'Invalid envelope payload' };
    }

    if (envelope.hopCount >= this.maxHops) {
      this.logRelayEvent({
        type: 'TTL_EXPIRED',
        packetId: envelope.payload.packetId,
        envelopeId: envelope.relayEnvelopeId,
        details: `Max hops limit reached (${envelope.hopCount}/${this.maxHops}). Dropped by TTL guard.`,
        status: 'DROPPED',
      });
      return { success: false, reason: 'TTL_EXCEEDED', maxHops: this.maxHops };
    }

    const updatedHopCount = envelope.hopCount + 1;
    const updatedHistory = [...(envelope.hopHistory || []), this.currentNodeId];

    const forwardingEnvelope = {
      ...envelope,
      hopCount: updatedHopCount,
      lastForwardedBy: this.currentNodeId,
      hopHistory: updatedHistory,
      forwardedAt: new Date().toISOString(),
    };

    try {
      this.isForwarding = true;
      let result;

      if (transportSendFn) {
        result = await transportSendFn(forwardingEnvelope);
      } else {
        const relayUrl = `${env.apiBaseUrl}/relay/packet`;
        const res = await fetch(relayUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(forwardingEnvelope.payload),
        });
        result = await res.json();
      }

      this.isForwarding = false;

      if (result && (result.status === 'success' || result.statusCode === 200)) {
        removeLocalPacket(envelope.payload.packetId);
        this.forwardedEnvelopeIds.add(envelope.payload.packetId);

        this.logRelayEvent({
          type: 'FORWARDED',
          packetId: envelope.payload.packetId,
          envelopeId: envelope.relayEnvelopeId,
          details: `Forwarded to '${peerNodeId}' at hop ${updatedHopCount}/${this.maxHops}. Removed from temporary store.`,
          status: 'FORWARDED',
        });

        return {
          success: true,
          forwardedTo: peerNodeId,
          hopCount: updatedHopCount,
          envelope: forwardingEnvelope,
        };
      } else {
        return { success: false, reason: 'UNCONFIRMED_BY_PEER', envelope: forwardingEnvelope };
      }
    } catch (err) {
      this.isForwarding = false;
      return { success: false, reason: err.message, envelope: forwardingEnvelope };
    }
  }

  sortQueueByPriority(queue) {
    if (!Array.isArray(queue)) return [];

    const priorityWeight = {
      CRITICAL: 1,
      P1_CRITICAL: 1,
      HIGH: 2,
      P2_HIGH: 2,
      MEDIUM: 3,
      P3_MEDIUM: 3,
      LOW: 4,
      P4_LOW: 4,
    };

    return [...queue].sort((a, b) => {
      const pA = priorityWeight[a.incidentMetadata?.priority || a.priority || 'HIGH'] || 2;
      const pB = priorityWeight[b.incidentMetadata?.priority || b.priority || 'HIGH'] || 2;

      if (pA !== pB) {
        return pA - pB;
      }

      return new Date(a.timestamp || 0) - new Date(b.timestamp || 0);
    });
  }

  isPacketExpired(packet, ttlMs = 86400000) {
    if (!packet || !packet.timestamp) return false;
    const age = Date.now() - new Date(packet.timestamp).getTime();
    return age > ttlMs;
  }

  pruneExpiredPackets(ttlMs = 86400000) {
    const currentQueue = getLocalPackets();
    const activeQueue = [];
    let prunedCount = 0;

    for (const packet of currentQueue) {
      if (this.isPacketExpired(packet, ttlMs)) {
        prunedCount++;
        removeLocalPacket(packet.packetId);
        this.logRelayEvent({
          type: 'TTL_EXPIRED',
          packetId: packet.packetId,
          details: `Packet expired post-TTL window (${Math.round((Date.now() - new Date(packet.timestamp).getTime()) / 3600000)}h > 24h). Purged.`,
          status: 'EXPIRED',
        });
      } else {
        activeQueue.push(packet);
      }
    }

    return {
      prunedCount,
      activeQueue: this.sortQueueByPriority(activeQueue),
    };
  }

  getRoutingStatistics() {
    const history = this.getRelayHistory();
    const currentQueue = getLocalPackets();

    const deliveredCount = history.filter((h) => h.type === 'FORWARDED').length;
    const droppedTtlCount = history.filter((h) => h.type === 'TTL_EXPIRED').length;
    const duplicatesPrevented = history.filter((h) => h.type === 'DUPLICATE_IGNORED').length;
    const totalProcessed = history.length || 1;

    const deliverySuccessRate = Math.round((deliveredCount / Math.max(totalProcessed, 1)) * 100);

    return {
      currentNodeId: this.currentNodeId,
      maxHopsAllowed: this.maxHops,
      ttlWindowHours: 24,
      totalProcessedEvents: history.length,
      carryingQueueSize: currentQueue.length,
      deliveredCount,
      droppedTtlCount,
      duplicatesPrevented,
      deliverySuccessRatePercent: deliverySuccessRate,
      activeConnectedPeers: this.activePeers.size,
      timestamp: new Date().toISOString(),
    };
  }

  getConnectedPeers() {
    return Array.from(this.activePeers);
  }

  registerPeerNode(peerId) {
    if (peerId) {
      this.activePeers.add(peerId);
    }
  }

  getPendingRelayTasks() {
    const rawQueue = getLocalPackets();
    const sortedQueue = this.sortQueueByPriority(rawQueue);
    return sortedQueue.map((pkt) => this.wrapInRelayEnvelope(pkt));
  }
}

const meshRelayService = new MeshRelayService();
export default meshRelayService;
export { meshRelayService };
