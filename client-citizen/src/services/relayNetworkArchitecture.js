/**
 * Relay Network Architecture Specification for RESONIX AI
 * Prepared for future offline peer-to-peer mesh network communications.
 * (Architecture definition only — active mesh transmission is deferred to future phase).
 */

export const RELAY_STATES = {
  IDLE: 'IDLE',
  SEARCHING_FOR_RELAY: 'Searching for Relay...',
  RELAY_CONNECTED: 'Relay Connected',
  RELAY_SYNCED: 'Relay Synced',
  RELAY_DISCONNECTED: 'Relay Disconnected',
};

export const MESH_PROTOCOLS = {
  BLE_BEACON: 'BLE_BEACON_V1',
  WEBRTC_DATA: 'WEBRTC_DATACHANNEL_V1',
  WIFI_DIRECT: 'WIFI_DIRECT_P2P',
};

/**
 * Creates a mesh relay node descriptor
 */
export function createRelayNodeDescriptor({
  nodeId = `NODE-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
  nodeType = 'MOBILE_CITIZEN_RELAY',
  signalStrengthDbm = -68,
  batteryLevelPercent = 88,
} = {}) {
  return {
    nodeId,
    nodeType,
    signalStrengthDbm,
    batteryLevelPercent,
    protocol: MESH_PROTOCOLS.BLE_BEACON,
    lastSeenAt: new Date().toISOString(),
    status: 'ACTIVE',
  };
}

/**
 * Wraps a standard Emergency Packet into a P2P Mesh Relay Envelope
 */
export function wrapInRelayEnvelope(emergencyPacket, targetRelayId = 'NODE-ALPHA-DISPATCH') {
  if (!emergencyPacket) return null;

  return {
    relayEnvelopeId: `rly_env_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    hopCount: 0,
    maxHops: 5,
    originNodeId: emergencyPacket.userId || 'NODE-LOCAL',
    targetRelayId,
    payload: emergencyPacket,
    createdAt: new Date().toISOString(),
    protocolVersion: MESH_PROTOCOLS.BLE_BEACON,
    architectureReady: true,
  };
}
