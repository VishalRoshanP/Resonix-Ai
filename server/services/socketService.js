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
const { isAllowedOrigin } = require('../middlewares/corsMiddleware');

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
        origin: (origin, callback) => {
          if (!origin || isAllowedOrigin(origin)) {
            // Echo back matching origin to safely support credentials: true in production
            callback(null, origin || true);
          } else {
            logger.warn(`[SocketService] ❌ CORS rejected socket origin: ${origin}`);
            callback(new Error('Origin not allowed by CORS'));
          }
        },
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

      // 4. Phase 4: Optional Real-Time Voice Streaming Capabilities (Decoupled & Isolated)
      socket.on('voice:live_transcribe', async (data = {}) => {
        try {
          const aiCapabilityRouter = require('./pipeline/aiCapabilityRouter');
          const aiModelConfig = require('../config/aiModels');
          const result = await aiCapabilityRouter.routeRequest({
            capability: aiModelConfig.capabilities.LIVE_TRANSCRIPTION,
            payload: {
              audioData: data.audioData || data.chunk,
              mimeType: data.mimeType || 'audio/webm',
              sessionState: data.sessionState || {},
            },
          });
          socket.emit('voice:interim_transcript', {
            isInterim: true,
            authoritative: false,
            sourceOfTruth: 'RECORDED_SOS_AUDIO',
            transcript: result.transcript || '',
            model: result.model || aiModelConfig.liveTranscription.model,
            streamId: data.streamId || null,
          });
        } catch (err) {
          logger.warn(`[SocketService] Live transcribe socket error: ${err.message}`);
          socket.emit('voice:error', { capability: 'live_transcription', error: err.message });
        }
      });

      socket.on('voice:live_conversation', async (data = {}) => {
        try {
          const aiCapabilityRouter = require('./pipeline/aiCapabilityRouter');
          const aiModelConfig = require('../config/aiModels');
          const result = await aiCapabilityRouter.routeRequest({
            capability: aiModelConfig.capabilities.LIVE_VOICE,
            payload: {
              text: data.text || data.prompt || '',
              audioData: data.audioData || null,
              sessionState: data.sessionState || {},
            },
          });
          socket.emit('voice:dialogue_reply', {
            success: result.success,
            capability: 'live_voice',
            response: result.response || '',
            model: result.model || aiModelConfig.liveVoice.model,
            sessionState: result.sessionState || {},
            classificationDecoupled: true,
          });
        } catch (err) {
          logger.warn(`[SocketService] Live voice dialogue socket error: ${err.message}`);
          socket.emit('voice:error', { capability: 'live_voice', error: err.message });
        }
      });

      socket.on('voice:live_translate', async (data = {}) => {
        try {
          const aiCapabilityRouter = require('./pipeline/aiCapabilityRouter');
          const aiModelConfig = require('../config/aiModels');
          const result = await aiCapabilityRouter.routeRequest({
            capability: aiModelConfig.capabilities.LIVE_TRANSLATION,
            payload: {
              audioData: data.audioData || null,
              transcript: data.transcript || data.text || '',
              sourceLanguage: data.sourceLanguage || 'auto',
              targetLanguage: data.targetLanguage || 'English',
            },
          });
          socket.emit('voice:translated_transcript', {
            success: result.success,
            capability: 'live_translation',
            translatedText: result.translatedText || '',
            sourceLanguage: data.sourceLanguage || 'auto',
            targetLanguage: data.targetLanguage || 'English',
            model: result.model || aiModelConfig.liveTranslation.model,
            authoritativePipelineIntact: true,
          });
        } catch (err) {
          logger.warn(`[SocketService] Live translate socket error: ${err.message}`);
          socket.emit('voice:error', { capability: 'live_translation', error: err.message });
        }
      });

      socket.on('voice:synthesize_tts', async (data = {}) => {
        try {
          const aiCapabilityRouter = require('./pipeline/aiCapabilityRouter');
          const aiModelConfig = require('../config/aiModels');
          const result = await aiCapabilityRouter.routeRequest({
            capability: aiModelConfig.capabilities.VOICE_RESPONSE,
            payload: {
              text: data.text || data.message || '',
              voice: data.voice || 'Puck',
              language: data.language || 'en',
            },
          });
          socket.emit('voice:tts_audio', {
            success: result.success,
            capability: 'voice_response',
            audioData: result.audioData || null,
            mimeType: result.mimeType || 'audio/wav',
            text: data.text || '',
            model: result.model || aiModelConfig.tts.model,
          });
        } catch (err) {
          logger.warn(`[SocketService] Voice TTS socket error: ${err.message}`);
          socket.emit('voice:error', { capability: 'voice_response', error: err.message });
        }
      });

      // 5. Disconnect Handler
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

    logger.info(`[SocketService] 📢 Broadcasting 'incident:created' to responders for packet '${packetId}'`);

    const createdPayload = {
      type: 'INCIDENT_CREATED',
      packetId,
      incident: incidentData,
      timestamp: new Date().toISOString(),
    };

    // Emit cleanly once to 'responders' room; fallback to global if responders room is empty
    const respondersRoom = this.io.sockets?.adapter?.rooms?.get('responders');
    if (respondersRoom && respondersRoom.size > 0) {
      this.io.to('responders').emit('incident:created', createdPayload);
      this.io.to('responders').emit('newEmergency', { ...createdPayload, emergency: incidentData });
    } else {
      this.io.emit('incident:created', createdPayload);
      this.io.emit('newEmergency', { ...createdPayload, emergency: incidentData });
    }

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

    const packetId = emergencyData.packetId || emergencyData.id || emergencyData._id;
    const eventId = `created_${packetId}_${emergencyData.timestamp || Date.now()}`;

    if (this._isDuplicateEvent(eventId)) return;

    const emergencyPayload = {
      type: 'NEW_EMERGENCY',
      packetId,
      emergency: emergencyData,
      incident: emergencyData,
      timestamp: new Date().toISOString(),
    };

    const respondersRoom = this.io.sockets?.adapter?.rooms?.get('responders');
    if (respondersRoom && respondersRoom.size > 0) {
      this.io.to('responders').emit('newEmergency', emergencyPayload);
    } else {
      this.io.emit('newEmergency', emergencyPayload);
    }
  }


  /**
   * Broadcasts incident status change (reported -> active -> resolved) to responders & citizen
   * @param {Object} updateData
   */
  broadcastIncidentUpdated(updateData) {
    if (!this.io) return;

    const incObj = updateData.incident || {};
    const incidentId = String(updateData.incidentId || updateData.id || updateData._id || incObj.incidentId || incObj.id || incObj._id || '');
    const _id = String(updateData._id || incObj._id || incidentId || '');
    const packetId = updateData.packetId || incObj.packetId || null;
    const clientRequestId = updateData.clientRequestId || incObj.clientRequestId || null;
    const status = updateData.status || incObj.status || 'active';
    const userId = updateData.userId || incObj.userId || null;
    const eventId = `updated_${incidentId || packetId || clientRequestId}_${status}_${updateData.updatedAt || Date.now()}`;

    if (this._isDuplicateEvent(eventId)) return;

    logger.info(`[SocketService] 🔄 Broadcasting 'incident:updated' for incident '${incidentId}' (Status: ${status})`);

    const updatedPayload = {
      type: 'INCIDENT_UPDATED',
      incidentId,
      _id,
      id: incidentId,
      packetId,
      clientRequestId,
      status,
      priority: updateData.priority || incObj.priority || 'HIGH',
      completedAt: updateData.completedAt || incObj.completedAt || null,
      completedBy: updateData.completedBy || incObj.completedBy || null,
      completionNotes: updateData.completionNotes || incObj.completionNotes || null,
      resolutionSummary: updateData.resolutionSummary || incObj.resolutionSummary || null,
      incident: updateData.incident || updateData,
      timestamp: new Date().toISOString(),
    };

    // 1. Broadcast to responders room
    this.io.to('responders').emit('incident:updated', updatedPayload);

    // 2. Broadcast globally to all connected citizen clients
    this.io.emit('incident:updated', updatedPayload);

    // 3. Target specific citizen user/packet rooms if present
    if (userId) {
      this.io.to(`user:${userId}`).emit('incident:updated', updatedPayload);
    }
    const packetKey = packetId || clientRequestId || updateData.packetId || updateData.clientRequestId;
    if (packetKey) {
      this.io.to(`packet:${packetKey}`).emit('incident:updated', updatedPayload);
    }
  }

  /**
   * Broadcasts real-time responder acknowledgement of an emergency incident to citizen and responders
   * @param {Object} incidentData
   */
  broadcastIncidentAcknowledged(incidentData) {
    if (!this.io) return;

    const incidentId = incidentData.clientRequestId || incidentData.packetId || incidentData._id || incidentData.id;
    const eventId = `ack_${incidentId}_${incidentData.acknowledgement?.acknowledgedAt || Date.now()}`;

    if (this._isDuplicateEvent(eventId)) return;

    console.log('SOCKET: ACK EMITTED', incidentId);
    logger.info(`[SocketService] 👁️ Broadcasting 'incident:acknowledged' for incident '${incidentId}'`);

    const payload = {
      type: 'INCIDENT_ACKNOWLEDGED',
      incidentId,
      _id: incidentData._id || incidentData.id,
      clientRequestId: incidentData.clientRequestId,
      packetId: incidentData.packetId,
      acknowledgement: incidentData.acknowledgement,
      incident: incidentData,
      timestamp: new Date().toISOString(),
    };

    // Broadcast to responders
    this.io.to('responders').emit('incident:acknowledged', payload);

    // Broadcast globally to citizen clients
    this.io.emit('incident:acknowledged', payload);
    this.io.emit('incident:updated', {
      type: 'INCIDENT_UPDATED',
      incidentId,
      _id: incidentData._id || incidentData.id,
      clientRequestId: incidentData.clientRequestId,
      packetId: incidentData.packetId,
      status: incidentData.status || 'ACTIVE',
      acknowledgement: incidentData.acknowledgement,
      incident: incidentData,
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

  /**
   * Broadcasts real-time Incident Fusion cluster update to connected responders
   * Emitted when a new report correlates with an existing cluster, changing report count, priority, or area.
   * @param {Object} clusterData - Analytical cluster object matching required schema
   */
  broadcastFusionUpdated(clusterData) {
    if (!this.io || !clusterData) return;

    const clusterId = clusterData.clusterId || `fusion_${Date.now()}`;
    const reportCount = clusterData.reportCount || (Array.isArray(clusterData.incidentIds) ? clusterData.incidentIds.length : 1);
    const eventId = `fusion_${clusterId}_${reportCount}_${clusterData.priority || ''}`;

    if (this._isDuplicateEvent(eventId)) return;

    logger.info(`[SocketService] 🔮 Broadcasting 'fusion:updated' to 'responders' room for cluster '${clusterId}' (${reportCount} reports, Priority: ${clusterData.priority || 'HIGH'})`);

    const payload = {
      type: 'FUSION_UPDATED',
      clusterId,
      cluster: clusterData,
      incidentIds: clusterData.incidentIds || [],
      reportCount,
      dominantHazard: clusterData.dominantHazard || 'GENERAL',
      priority: clusterData.priority || 'HIGH',
      confidence: clusterData.confidence != null ? clusterData.confidence : 0.85,
      center: clusterData.center || { lat: 0, lng: 0 },
      spreadMeters: clusterData.spreadMeters != null ? clusterData.spreadMeters : 0,
      estimatedReportingAreaKm2: clusterData.estimatedReportingAreaKm2 != null ? clusterData.estimatedReportingAreaKm2 : 0,
      timeWindow: clusterData.timeWindow || { first: new Date().toISOString(), last: new Date().toISOString() },
      reasons: clusterData.reasons || [],
      evidenceSummary: clusterData.evidenceSummary || [],
      timestamp: new Date().toISOString(),
    };

    // Broadcast to responders room
    this.io.to('responders').emit('fusion:updated', payload);

    // Also broadcast to global channel for all connected dashboards
    this.io.emit('fusion:updated', payload);
  }

  /**
   * Broadcasts real-time Resource update to connected responders
   * Emitted when a resource status changes (e.g. AVAILABLE -> ALLOCATED -> EN ROUTE -> ON SCENE -> AVAILABLE)
   * @param {Object} resourceData - Resource document or object
   */
  broadcastResourceUpdated(resourceData) {
    if (!this.io || !resourceData) return;

    const resourceId = String(resourceData.id || resourceData._id || `res_${Date.now()}`);
    const status = (resourceData.status || 'AVAILABLE').toUpperCase();
    const eventId = `resource_${resourceId}_${status}_${resourceData.currentMission || ''}`;

    if (this._isDuplicateEvent(eventId)) return;

    logger.info(`[SocketService] 🛡️ Broadcasting 'resource:updated' to 'responders' room for resource '${resourceId}' (Status: ${status})`);

    const payload = {
      type: 'RESOURCE_UPDATED',
      resourceId,
      resource: resourceData,
      status,
      timestamp: new Date().toISOString(),
    };

    this.io.to('responders').emit('resource:updated', payload);
    this.io.emit('resource:updated', payload);
  }

  /**
   * Broadcasts real-time live weather updates to connected responders and citizen clients
   * @param {Object} weatherData - Normalized weather payload
   */
  broadcastWeatherUpdate(weatherData) {
    if (!this.io || !weatherData) return;

    const payload = {
      type: 'WEATHER_UPDATED',
      ...weatherData,
      broadcastTime: new Date().toISOString(),
    };

    // Broadcast to responders room and global channel
    this.io.to('responders').emit('weather:updated', payload);
    this.io.emit('weather:updated', payload);
  }

  /**
   * Broadcasts severe weather warnings and disaster threshold alerts
   * @param {Object} warningData - Warning object with headline, severity, and category
   */
  broadcastWeatherWarning(warningData) {
    if (!this.io || !warningData) return;

    const payload = {
      type: 'WEATHER_WARNING',
      ...warningData,
      broadcastTime: new Date().toISOString(),
    };

    this.io.to('responders').emit('weather:warning', payload);
    this.io.emit('weather:warning', payload);
  }

  /**
   * Broadcasts official extreme weather alerts with affected area and citizen guidance
   * @param {Object} alertData - Verified Alert payload
   */
  broadcastExtremeWeatherAlert(alertData) {
    if (!this.io || !alertData) return;

    const eventId = `alert_${alertData.alertId}_${alertData.status || 'ACTIVE'}_${alertData.severity}`;
    if (this._isDuplicateEvent(eventId)) return;

    const payload = {
      type: 'WEATHER_ALERT',
      ...alertData,
      broadcastTime: new Date().toISOString(),
    };

    this.io.to('responders').emit('weather:alert', payload);
    this.io.emit('weather:alert', payload);
  }

  /**
   * Broadcasts responder assignment to an active incident
   * @param {Object} assignmentData - Contains resource, incident, assignedBy, etaMinutes
   */
  broadcastResourceAssigned(assignmentData) {
    if (!this.io || !assignmentData) return;

    const resId = String(assignmentData.resourceId || assignmentData.resource?.id || assignmentData.resource?._id || 'res');
    const incId = String(assignmentData.incidentId || assignmentData.incident?.id || assignmentData.incident?._id || 'inc');
    const eventId = `assigned_${resId}_${incId}_${assignmentData.timestamp || Date.now()}`;

    if (this._isDuplicateEvent(eventId)) return;

    logger.info(`[SocketService] 🛡️ Broadcasting 'resource:assigned' for resource '${resId}' to incident '${incId}'`);

    const payload = {
      type: 'RESOURCE_ASSIGNED',
      resourceId: resId,
      incidentId: incId,
      resource: assignmentData.resource || null,
      incident: assignmentData.incident || null,
      assignedBy: assignmentData.assignedBy || 'Commander',
      etaMinutes: assignmentData.etaMinutes != null ? assignmentData.etaMinutes : null,
      timestamp: assignmentData.timestamp || new Date().toISOString(),
    };

    this.io.to('responders').emit('resource:assigned', payload);
    this.io.emit('resource:assigned', payload);
  }

  /**
   * Broadcasts updated meteorological forecast to responders and citizens
   * @param {Object} forecastData - Contains location, forecast models, and observation timestamp
   */
  broadcastForecastUpdated(forecastData) {
    if (!this.io || !forecastData) return;

    const locKey = forecastData.locationKey || `${forecastData.location?.lat}_${forecastData.location?.lon}` || 'default';
    const eventId = `forecast_${locKey}_${forecastData.timestamp || Date.now()}`;

    if (this._isDuplicateEvent(eventId)) return;

    logger.info(`[SocketService] ⛅ Broadcasting 'weather:forecast_updated' for sector '${locKey}'`);

    const payload = {
      type: 'FORECAST_UPDATED',
      ...forecastData,
      broadcastTime: new Date().toISOString(),
    };

    this.io.to('responders').emit('weather:forecast_updated', payload);
    this.io.emit('weather:forecast_updated', payload);
  }

  /**
   * Broadcasts offline emergency synchronization completion
   * @param {Object} syncData - Contains count, newCount, timestamp, and source
   */
  broadcastSyncCompleted(syncData) {
    if (!this.io || !syncData) return;

    const syncId = syncData.syncId || `sync_${Date.now()}`;
    const eventId = `sync_${syncId}_${syncData.count || 0}_${syncData.timestamp || Date.now()}`;

    if (this._isDuplicateEvent(eventId)) return;

    logger.info(`[SocketService] 🔄 Broadcasting 'sync:completed' (Packets: ${syncData.count || 0}, New: ${syncData.newCount || 0})`);

    const payload = {
      type: 'SYNC_COMPLETED',
      syncId,
      count: syncData.count || 0,
      newCount: syncData.newCount || 0,
      source: syncData.source || 'offline_queue',
      timestamp: syncData.timestamp || new Date().toISOString(),
    };

    this.io.to('responders').emit('sync:completed', payload);
    this.io.emit('sync:completed', payload);
  }
}

// Export singleton instance
module.exports = new SocketService();

