// Relay Service — Placeholder for Express backend integration
import { api } from './api';

export const relayService = {
  async getRelayStatus() {
    // GET /api/relay/status
    // return api.get('/relay/status');
    return {
      mode: 'offline',
      meshNodes: 47,
      totalNodes: 50,
      signalStrength: 4,
      lastBroadcast: '2 min ago',
      pendingMessages: 3,
    };
  },

  async getNetworkNodes() {
    // GET /api/relay/nodes
    // return api.get('/relay/nodes');
    return [
      { id: 'node_alpha', name: 'Node Alpha', status: 'active', signal: 5, location: 'Sector 4', hops: 1 },
      { id: 'node_bravo', name: 'Node Bravo', status: 'active', signal: 4, location: 'Sector 7', hops: 2 },
      { id: 'node_charlie', name: 'Node Charlie', status: 'degraded', signal: 2, location: 'Sector 2', hops: 3 },
      { id: 'node_delta', name: 'Node Delta', status: 'offline', signal: 0, location: 'Sector 9', hops: null },
    ];
  },

  async broadcastMessage(message) {
    // POST /api/relay/broadcast
    // return api.post('/relay/broadcast', { message });
    return { success: true, deliveredTo: 45, timestamp: new Date().toISOString() };
  },

  async getRelayHistory() {
    // GET /api/relay/history
    // return api.get('/relay/history');
    return [
      { id: 'relay_001', type: 'packet_received', source: 'Sector 4', message: 'Sensor data logged. Temperature nominal.', time: 'Now' },
      { id: 'relay_002', type: 'relay_transmit', source: 'Node Alpha', message: 'Broadcasting evacuation protocols.', time: '-2m' },
      { id: 'relay_003', type: 'voice_command', source: 'Commander', message: '"Gemma, analyze structural integrity of Bridge 9."', time: '-15m' },
      { id: 'relay_004', type: 'system_boot', source: 'Mainframe', message: 'Local reasoning engaged.', time: '-2h' },
    ];
  },
};
