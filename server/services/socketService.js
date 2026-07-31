/**
 * RESONIX AI — Socket.IO Real-Time Synchronization Engine
 * 
 * Responsibilities:
 * - Single source of truth backend Socket.IO event server.
 * - Bidirectional real-time communication between Citizen Client & Responder Command Center.
 * - Room management:
 *   • 'responders' room for connected responder dashboards.
 *   • 'user:${userId}' / 'packet:${packetId}' room for citizen clients.
 * - Outbound Event Broadcasters:
 *   • `incident:created`: Emitted when Citizen submits SOS or syncs offline queue.
 *   • `incident:updated`: Emitted when Responder updates incident status.
 *   • `relay:updated`: Emitted when relay count or relay history changes.
 *   • `sos:confirmed`: Direct confirmation sent to Citizen client.
 * - Event Deduplication:
 *   • Sliding window cache (`processedEventIds`) prevents duplicate events.
 * - Automatic Reconnection & Multi-Responder Room Management.
 * 
 * ISOLATED MODULE — Preserves existing APIs, Gemma 4 AI, and MongoDB architecture.
 */

const { Server } = require('socket.io');
const logger = require('../utils/logger');

class SocketService {
  constructor() {
    this.io = null;
    this.processedEventIds = new Set();
    this.maxCacheSize = 500;
  }

  /**
   * Initializes Socket.IO server attached to Express HTTP server instance
   * @param {Object} httpServer - Node.js HTTP Server instance
   */
  init(httpServer) {
    if (this.io) return this.io;

    this.io = new Server(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        credentials: true,
      },
      pingTimeout: 30000,
      pingInterval: 10000,
    });

    console.log('[SocketService] ⚡ Socket.IO Real-Time Server initialized.');

    this.io.on('connection', (socket) => {
      logger.info(`[SocketService] 🔌 Socket client connected: ${socket.id}`);

      // 1. Responder Join Room Handler
      socket.on('join:responders', (data = {}) => {
        socket.join('responders');
        logger.info(`[SocketService] 🛡️ Responder socket ${socket.id} joined 'responders' room.`);
        socket.emit('room:joined', { room: 'responders', socketId: socket.id });
      });

      // 2. Citizen Join Room Handler
      socket.on('join:citizen', (data = {}) => {
        const userId = data.userId || 'usr_guest';
        const packetId = data.packetId;
        
        socket.join(`user:${userId}`);
        if (packetId) {
          socket.join(`packet:${packetId}`);
        }
        logger.info(`[SocketService] 👤 Citizen socket ${socket.id} joined rooms 'user:${userId}' / 'packet:${packetId || 'none'}'`);
        socket.emit('room:joined', { room: `user:${userId}`, socketId: socket.id });
      });

      // 3. Status Update Client Request Handler
      socket.on('incident:update_status', async (data = {}) => {
        const { incidentId, status, updatedBy } = data;
        if (!incidentId || !status) return;

        logger.info(`[SocketService] Real-time status update request received for incident '${incidentId}': ${status}`);
        this.broadcastIncidentUpdated({
          incidentId,
          status,
          updatedBy: updatedBy || 'Responder',
          updatedAt: new Date().toISOString(),
        });
      });

      // 4. Disconnect Handler
      socket.on('disconnect', (reason) => {
        logger.info(`[SocketService] 🔌 Socket client disconnected: ${socket.id} (Reason: ${reason})`);
      });
    });

    return this.io;
  }

  // --- Event Deduplication Helper ---

  _isDuplicateEvent(eventId) {
    if (!eventId) return false;
    if (this.processedEventIds.has(eventId)) {
      console.log(`[SocketService] 🛡️ Duplicate socket event ignored: ${eventId}`);
      return true;
    }
    this.processedEventIds.add(eventId);
    if (this.processedEventIds.size > this.maxCacheSize) {
      const firstItem = this.processedEventIds.values().next().value;
      this.processedEventIds.delete(firstItem);
    }
    return false;
  }

  // --- Outbound Broadcasters ---

  /**
   * Broadcasts newly created or synced citizen SOS incident to all connected responders
   * @param {Object} incidentData
   */
  broadcastIncidentCreated(incidentData) {
    if (!this.io) return;

    const packetId = incidentData.packetId || incidentData.id || incidentData._id;
    const eventId = `created_${packetId}_${incidentData.timestamp || Date.now()}`;

    if (this._isDuplicateEvent(eventId)) return;

    logger.info(`[SocketService] 📢 Broadcasting 'incident:created' and 'newEmergency' to 'responders' room for packet '${packetId}'`);

    this.io.to('responders').emit('incident:created', {
      type: 'INCIDENT_CREATED',
      packetId,
      incident: incidentData,
      timestamp: new Date().toISOString(),
    });

    this.io.to('responders').emit('newEmergency', {
      type: 'NEW_EMERGENCY',
      packetId,
      emergency: incidentData,
      incident: incidentData,
      timestamp: new Date().toISOString(),
    });

    // Notify citizen if user ID is present
    if (incidentData.userId) {
      this.notifyCitizenSOSConfirmed(incidentData.userId, incidentData);
    }
  }

  /**
   * Broadcasts new emergency alert explicitly via 'newEmergency' and 'incident:created' events
   * @param {Object} emergencyData
   */
  broadcastNewEmergency(emergencyData) {
    if (!this.io) return;
    this.broadcastIncidentCreated(emergencyData);
  }


  /**
   * Broadcasts incident status change (reported -> active -> resolved) to responders & citizen
   * @param {Object} updateData
   */
  broadcastIncidentUpdated(updateData) {
    if (!this.io) return;

    const incidentId = updateData.incidentId || updateData.packetId || updateData._id;
    const status = updateData.status;
    const eventId = `updated_${incidentId}_${status}_${updateData.updatedAt || Date.now()}`;

    if (this._isDuplicateEvent(eventId)) return;

    logger.info(`[SocketService] 🔄 Broadcasting 'incident:updated' to all clients for incident '${incidentId}' (Status: ${status})`);

    // Broadcast to all responders
    this.io.to('responders').emit('incident:updated', {
      type: 'INCIDENT_UPDATED',
      incidentId,
      status,
      incident: updateData,
      timestamp: new Date().toISOString(),
    });

    // Broadcast to global channel and specific packet room
    this.io.emit('incident:updated', {
      type: 'INCIDENT_UPDATED',
      incidentId,
      status,
      incident: updateData,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Broadcasts real-time multi-hop relay count or relay history updates
   * @param {Object} relayData
   */
  broadcastRelayUpdated(relayData) {
    if (!this.io) return;

    const packetId = relayData.packetId || relayData.messageId;
    const eventId = `relay_${packetId}_${relayData.relayCount}_${relayData.timestamp || Date.now()}`;

    if (this._isDuplicateEvent(eventId)) return;

    logger.info(`[SocketService] 📡 Broadcasting 'relay:updated' for packet '${packetId}' (Relay Count: ${relayData.relayCount})`);

    this.io.to('responders').emit('relay:updated', {
      type: 'RELAY_UPDATED',
      packetId,
      relayCount: relayData.relayCount,
      relayHistory: relayData.relayHistory,
      relayPath: relayData.relayPath,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Sends direct confirmation to citizen client when SOS is processed / acknowledged
   * @param {string} userId
   * @param {Object} packetData
   */
  notifyCitizenSOSConfirmed(userId, packetData) {
    if (!this.io || !userId) return;

    logger.info(`[SocketService] 👤 Sending 'sos:confirmed' to citizen user '${userId}'`);

    this.io.to(`user:${userId}`).emit('sos:confirmed', {
      type: 'SOS_CONFIRMED',
      packetId: packetData.packetId,
      status: packetData.packetStatus || 'DELIVERED',
      timestamp: new Date().toISOString(),
      packet: packetData,
    });
  }
}

// Export singleton instance
module.exports = new SocketService();
