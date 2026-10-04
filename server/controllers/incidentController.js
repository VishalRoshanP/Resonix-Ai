const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const incidentService = require('../services/incidentService');
const socketService = require('../services/socketService');
const logger = require('../utils/logger');

/**
 * @route   GET /api/incidents
 * @desc    Get live incidents list from MongoDB database
 * @access  Public / Private
 */
const getIncidents = async (req, res, next) => {
  const reqStart = performance.now();
  console.log(`[INCIDENT_GET_START] timestamp=${new Date().toISOString()} page=${req.query.page || 1}`);
  try {
    if (typeof res.set === 'function') {
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      });
    }

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;

    const filters = {};
    if (req.query.status) {
      const qStatus = String(req.query.status).trim().toLowerCase();
      if (qStatus === 'active') {
        filters.status = { $nin: ['resolved', 'closed', 'completed', 'cancelled', 'RESOLVED', 'CLOSED', 'COMPLETED', 'CANCELLED'] };
      } else if (qStatus === 'resolved' || qStatus === 'completed') {
        filters.status = { $in: ['resolved', 'closed', 'completed', 'RESOLVED', 'CLOSED', 'COMPLETED'] };
      } else {
        filters.status = req.query.status;
      }
    }

    const dbStart = performance.now();
    console.log(`[INCIDENT_DB_QUERY_START] limit=${limit}`);
    const rawIncidents = await incidentService.getAllIncidents(filters, limit);
    const dbDuration = Math.round(performance.now() - dbStart);
    console.log(`[INCIDENT_DB_QUERY_COMPLETE] duration=${dbDuration}ms count=${rawIncidents?.length || 0}`);

    const incidents = Array.isArray(rawIncidents) ? rawIncidents : [];
    const totalDuration = Math.round(performance.now() - reqStart);
    console.log(`[INCIDENT_GET_RESPONSE] total=${totalDuration}ms status=200`);

    return ApiResponse.success(res, 200, 'Incidents retrieved successfully', {
      incidents,
      data: incidents,
      pagination: {
        total: incidents.length,
        page,
        limit,
        totalPages: Math.ceil(incidents.length / limit) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/incidents/dashboard-summary
 * @desc    Get fast high-level dashboard metrics (counts only) from MongoDB
 * @access  Public / Private
 */
const getDashboardSummary = async (req, res, next) => {
  try {
    const t0 = performance.now();
    const summary = await incidentService.getDashboardSummary();
    const latencyMs = Math.round(performance.now() - t0);

    return ApiResponse.success(res, 200, 'Dashboard summary retrieved successfully', {
      ...summary,
      latencyMs,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/incidents/:id
 * @desc    Get live incident details by ID from MongoDB
 * @access  Public / Private
 */
const getIncidentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const incident = await incidentService.getIncidentById(id, req.user?.role || 'responder');

    if (!incident) {
      return next(new ApiError(404, `Incident with ID '${id}' not found`));
    }

    return ApiResponse.success(res, 200, 'Incident details retrieved', { incident, data: incident });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/incidents
 * @desc    Create new incident report in MongoDB
 * @access  Private (Responder / Commander / Admin)
 */
const createIncident = async (req, res, next) => {
  try {
    const createdIncident = await incidentService.createIncident(req.body);
    
    // Broadcast real-time incident creation
    const socketService = require('../services/socketService');
    socketService.broadcastIncidentCreated(createdIncident);

    // Run Real-Time Incident Fusion Analysis (Evaluate if report joins/updates an existing cluster)
    const incidentFusionApiService = require('../services/incidentFusionApiService');
    incidentFusionApiService.evaluateAndBroadcastFusionUpdate(createdIncident._id || createdIncident.id);

    return ApiResponse.success(res, 201, 'Incident created successfully', { incident: createdIncident, data: createdIncident });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/incidents/:id
 * @desc    Update incident details in MongoDB
 * @access  Private (Responder / Commander / Admin)
 */
const updateIncident = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body || {};
    const requestedStatus = (updateData.status || '').toLowerCase();
    const isCompleting = ['completed', 'resolved', 'closed'].includes(requestedStatus);

    let updated;
    const now = new Date();

    const patchPayload = {
      ...updateData,
      status: isCompleting ? 'resolved' : (updateData.status || 'active'),
    };

    if (isCompleting) {
      patchPayload.completedAt = updateData.completedAt || now;
      patchPayload.completedBy = updateData.completedBy || req.user?.name || 'Command Officer';
      patchPayload.completionNotes = updateData.completionNotes || updateData.resolutionSummary || 'Emergency resolved by response unit';
      patchPayload.resolutionSummary = updateData.resolutionSummary || updateData.completionNotes || 'Emergency resolved by response unit';
    }

    try {
      updated = await incidentService.updateIncident(id, patchPayload);
    } catch (_) {
      // Fallback update
    }

    if (!updated) {
      return next(new ApiError(404, `Incident with ID '${id}' not found`));
    }

    const newStatus = isCompleting ? 'RESOLVED' : (updateData.status || 'ACTIVE').toUpperCase();

    // If incident is completed, release all allocated resources back to AVAILABLE and sync EmergencyPacket
    if (isCompleting) {
      try {
        const Resource = require('../models/Resource');
        const assignedResources = await Resource.find({
          $or: [
            { assignedIncidentId: id },
            { currentMission: { $regex: String(id).slice(-4), $options: 'i' } },
          ],
        });
        for (const resDoc of assignedResources) {
          resDoc.status = 'AVAILABLE';
          resDoc.assignedIncidentId = null;
          resDoc.currentMission = null;
          resDoc.etaMinutes = null;
          resDoc.assignedAt = null;
          resDoc.assignedBy = null;
          await resDoc.save();
          socketService.broadcastResourceUpdated(resDoc);
        }
      } catch (resErr) {
        logger.warn('[IncidentController] Note releasing assigned resources:', resErr.message);
      }

      // Synchronize matching EmergencyPacket in MongoDB
      try {
        const mongoose = require('mongoose');
        const EmergencyPacket = require('../models/EmergencyPacket');
        const pFilter = [];
        if (updated.packetId) pFilter.push({ packetId: updated.packetId });
        if (updated.clientRequestId) pFilter.push({ clientRequestId: updated.clientRequestId });
        if (id) {
          pFilter.push({ packetId: id });
          pFilter.push({ clientRequestId: id });
          if (mongoose.Types.ObjectId.isValid(id)) {
            pFilter.push({ _id: id });
          }
        }
        if (updated._id && mongoose.Types.ObjectId.isValid(String(updated._id))) {
          pFilter.push({ _id: updated._id });
        }
        if (pFilter.length > 0) {
          await EmergencyPacket.updateMany(
            { $or: pFilter },
            {
              $set: {
                packetStatus: 'RESOLVED',
                status: 'resolved',
                completedAt: patchPayload.completedAt,
                'responseLifecycle.resolvedAt': patchPayload.completedAt,
                'responseLifecycle.resolutionSummary': patchPayload.resolutionSummary,
                completionNotes: patchPayload.completionNotes,
                resolutionSummary: patchPayload.resolutionSummary,
              },
            }
          );
        }
      } catch (epErr) {
        logger.warn('[IncidentController] Note syncing EmergencyPacket on completion:', epErr.message);
      }
    }

    const updatedIncidentObj = typeof updated.toObject === 'function' ? updated.toObject() : { ...updated };
    updatedIncidentObj.status = newStatus;
    updatedIncidentObj.completedAt = patchPayload.completedAt;
    updatedIncidentObj.completedBy = patchPayload.completedBy;
    updatedIncidentObj.completionNotes = patchPayload.completionNotes;
    updatedIncidentObj.resolutionSummary = patchPayload.resolutionSummary;

    // Broadcast real-time incident status update with all identifiers
    const socketService = require('../services/socketService');
    socketService.broadcastIncidentUpdated({
      _id: String(updated._id || updated.id || id),
      id: String(updated._id || updated.id || id),
      incidentId: String(updated._id || updated.id || id),
      packetId: updated.packetId || updateData.packetId || null,
      clientRequestId: updated.clientRequestId || updateData.clientRequestId || null,
      userId: updated.userId || updateData.userId || null,
      status: newStatus,
      priority: updateData.priority || updated.priority || updated.severity || 'HIGH',
      updatedBy: req.user?.name || 'Command Officer',
      updatedAt: now.toISOString(),
      completedAt: patchPayload.completedAt,
      completedBy: patchPayload.completedBy,
      completionNotes: patchPayload.completionNotes,
      resolutionSummary: patchPayload.resolutionSummary,
      incident: updatedIncidentObj,
    });

    // Re-evaluate and broadcast real-time cluster updates
    try {
      const incidentFusionApiService = require('../services/incidentFusionApiService');
      incidentFusionApiService.broadcastFusionStateChange().catch(() => {});
    } catch (_) {}

    return ApiResponse.success(res, 200, `Incident '${id}' updated successfully`, { incident: updatedIncidentObj, data: updatedIncidentObj });
  } catch (error) {
    next(error);
  }
};

const deleteIncident = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deletedIncident = await incidentService.deleteIncident(id);

    // Broadcast real-time incident deletion to connected responder dashboards
    const socketService = require('../services/socketService');
    if (socketService.io) {
      socketService.io.emit('incident:deleted', { incidentId: id, id, timestamp: new Date().toISOString() });
    }

    // Re-evaluate and broadcast real-time cluster updates
    try {
      const incidentFusionApiService = require('../services/incidentFusionApiService');
      incidentFusionApiService.broadcastFusionStateChange().catch(() => {});
    } catch (_) {}

    return ApiResponse.success(res, 200, `Incident '${id}' deleted successfully`, {
      incident: deletedIncident || { id, _id: id, deleted: true },
      data: deletedIncident || { id, _id: id, deleted: true },
      id,
      deleted: true,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/v1/incidents/history
 * @desc    Permanently clear completed/history incidents from MongoDB
 * @access  Private / Public (Responders / Commanders / Admin)
 */
const clearHistory = async (req, res, next) => {
  try {
    const Incident = require('../models/Incident');

    // Strict filter: ONLY remove completed / resolved / closed records
    const filter = {
      $or: [
        { status: { $in: ['resolved', 'completed', 'closed', 'RESOLVED', 'COMPLETED', 'CLOSED'] } },
        { completedAt: { $ne: null } },
      ],
    };

    const deleteResult = await Incident.deleteMany(filter);
    const deletedCount = deleteResult.deletedCount || 0;

    // Broadcast real-time history cleared event to update connected dashboards
    const socketService = require('../services/socketService');
    if (socketService.io) {
      socketService.io.emit('incidents:history_cleared', { deletedCount, timestamp: new Date().toISOString() });
    }

    return ApiResponse.success(res, 200, 'Incident history cleared successfully', {
      deletedCount,
      count: deletedCount,
      message: deletedCount > 0 ? 'Incident history cleared successfully' : 'No completed incidents to clear',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/v1/incidents/:id/acknowledge
 * @desc    Acknowledge emergency alert by authenticated responder
 * @access  Private / Public (Responder / Command Center)
 */
const acknowledgeIncident = async (req, res, next) => {
  try {
    const { id } = req.params;
    console.log('BACKEND: ACK RECEIVED', id);
    const responderName = req.user?.name || req.user?.badgeId || req.user?.email || req.body?.responderName || 'Officer J. Miller';

    const updated = await incidentService.acknowledgeIncident(id, { name: responderName });
    console.log('BACKEND: ACK PERSISTED', id);

    // Broadcast Socket.IO acknowledgement
    const socketService = require('../services/socketService');
    socketService.broadcastIncidentAcknowledged(updated);

    return ApiResponse.success(res, 200, `Incident '${id}' acknowledged successfully`, {
      success: true,
      incident: updated,
      acknowledgement: updated?.acknowledgement || {
        status: 'ACKNOWLEDGED',
        acknowledgedAt: new Date().toISOString(),
        acknowledgedBy: responderName,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getIncidents,
  getDashboardSummary,
  getIncidentById,
  createIncident,
  updateIncident,
  acknowledgeIncident,
  deleteIncident,
  clearHistory,
};
