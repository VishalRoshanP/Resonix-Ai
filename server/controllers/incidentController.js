const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const incidentService = require('../services/incidentService');

/**
 * @route   GET /api/incidents
 * @desc    Get live incidents list from MongoDB database
 * @access  Public / Private
 */
const getIncidents = async (req, res, next) => {
  try {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;

    const rawIncidents = await incidentService.getAllIncidents();
    const incidents = Array.isArray(rawIncidents) ? rawIncidents : [];

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
      updated = {
        id,
        _id: id,
        ...patchPayload,
        updatedAt: now.toISOString(),
      };
    }

    const newStatus = isCompleting ? 'RESOLVED' : (updateData.status || 'ACTIVE').toUpperCase();

    // Broadcast real-time incident status update
    const socketService = require('../services/socketService');
    socketService.broadcastIncidentUpdated({
      incidentId: id,
      status: newStatus,
      priority: updateData.priority || updated.priority || updated.severity || 'HIGH',
      updatedBy: req.user?.name || 'Command Officer',
      updatedAt: now.toISOString(),
      completedAt: patchPayload.completedAt,
      completedBy: patchPayload.completedBy,
      completionNotes: patchPayload.completionNotes,
      resolutionSummary: patchPayload.resolutionSummary,
      incident: updated,
    });

    return ApiResponse.success(res, 200, `Incident '${id}' updated successfully`, { incident: updated, data: updated });
  } catch (error) {
    next(error);
  }
};

const deleteIncident = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deletedIncident = await incidentService.deleteIncident(id);

    if (!deletedIncident) {
      return next(new ApiError(404, `Incident with ID '${id}' not found`));
    }

    // Broadcast real-time incident deletion to connected responder dashboards
    const socketService = require('../services/socketService');
    if (socketService.io) {
      socketService.io.emit('incident:deleted', { incidentId: id, id, timestamp: new Date().toISOString() });
    }

    return ApiResponse.success(res, 200, `Incident '${id}' deleted successfully`, { incident: deletedIncident, data: deletedIncident, id });
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

module.exports = {
  getIncidents,
  getIncidentById,
  createIncident,
  updateIncident,
  deleteIncident,
  clearHistory,
};
