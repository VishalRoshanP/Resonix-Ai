const mongoose = require('mongoose');
const Resource = require('../models/Resource');
const Incident = require('../models/Incident');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const socketService = require('../services/socketService');
const logger = require('../utils/logger');

/**
 * Helper to normalize and format resource response
 */
const formatResourceDoc = (doc) => {
  const obj = doc.toObject ? doc.toObject() : doc;
  const id = String(obj._id || obj.id);
  const status = (obj.status || 'AVAILABLE').toUpperCase();

  // Status Badge CSS for Responder Client
  let statusBadge = 'bg-success/15 border-success text-success';
  if (status === 'ALLOCATED') {
    statusBadge = 'bg-amber-500/15 border-amber-500 text-amber-500 font-bold';
  } else if (status === 'EN ROUTE') {
    statusBadge = 'bg-sky-500/15 border-sky-500 text-sky-500 font-bold';
  } else if (status === 'ON SCENE' || status === 'BUSY') {
    statusBadge = 'bg-purple-500/15 border-purple-500 text-purple-500 font-bold';
  } else if (status === 'OFFLINE') {
    statusBadge = 'bg-slate-500/15 border-slate-500 text-slate-400 font-medium';
  }

  // Icon based on type
  let icon = 'shield';
  const t = (obj.type || obj.category || '').toUpperCase();
  if (t.includes('FIRE')) icon = 'local_fire_department';
  else if (t.includes('MEDIC') || t.includes('AMBULANCE')) icon = 'medical_services';
  else if (t.includes('WATER') || t.includes('BOAT')) icon = 'sailing';
  else if (t.includes('SEARCH') || t.includes('RESCUE')) icon = 'person_search';
  else if (t.includes('EQUIP') || t.includes('PUMP')) icon = 'handyman';

  return {
    ...obj,
    id,
    _id: id,
    status,
    statusBadge,
    icon,
    capacity: obj.capacity || null,
    location: obj.location || null,
    gpsCoordinates: obj.gpsCoordinates || null,
    currentMission: obj.currentMission || null,
  };
};

/**
 * @route   GET /api/v1/resources
 * @desc    Get real operational resources from MongoDB with search and status filtering
 * @access  Public / Private
 */
const getResources = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 50;
    const search = req.query.search ? String(req.query.search).trim() : '';
    const statusFilter = req.query.status ? String(req.query.status).trim().toUpperCase() : '';
    const incidentFilter = req.query.assignedIncidentId || req.query.incidentId;

    const filterQuery = {};

    // Filter by assigned incident if requested
    if (incidentFilter) {
      const incStr = String(incidentFilter).trim();
      const incTag = incStr.slice(-4);
      filterQuery.$or = [
        { assignedIncidentId: mongoose.Types.ObjectId.isValid(incStr) ? incStr : undefined },
        { currentMission: { $regex: incTag, $options: 'i' } },
      ].filter((clause) => clause.assignedIncidentId !== undefined || clause.currentMission !== undefined);
    }

    // Status filtering
    if (statusFilter && statusFilter !== 'ALL') {
      filterQuery.status = statusFilter;
    }

    // Search query matching across name, type, category, location, status
    if (search) {
      const searchRegex = new RegExp(search, 'i');
      filterQuery.$or = [
        { name: searchRegex },
        { type: searchRegex },
        { category: searchRegex },
        { location: searchRegex },
        { status: searchRegex },
        { currentMission: searchRegex },
        { notes: searchRegex },
      ];
    }

    const skip = (page - 1) * limit;

    let dbItems = [];
    let total = 0;

    if (mongoose.connection.readyState === 1) {
      [dbItems, total] = await Promise.all([
        Resource.find(filterQuery).sort({ createdAt: -1 }).skip(skip).limit(limit),
        Resource.countDocuments(filterQuery),
      ]);
    }

    const resources = dbItems.map(formatResourceDoc);

    return ApiResponse.success(res, 200, 'Real operational resources retrieved', {
      resources,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    logger.error('[ResourceController] Failed to retrieve resources:', error);
    next(error);
  }
};

/**
 * @route   GET /api/v1/resources/:id
 * @desc    Get detailed operational resource by ID
 * @access  Public / Private
 */
const getResourceById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const byCustomId = await Resource.findOne({ $or: [{ id }, { name: id }] });
      if (!byCustomId) {
        return next(new ApiError(404, `Resource with ID '${id}' not found`));
      }
      return ApiResponse.success(res, 200, 'Resource details retrieved', {
        resource: formatResourceDoc(byCustomId),
      });
    }

    const resource = await Resource.findById(id);
    if (!resource) {
      return next(new ApiError(404, `Resource with ID '${id}' not found`));
    }

    return ApiResponse.success(res, 200, 'Resource details retrieved', {
      resource: formatResourceDoc(resource),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/resources
 * @desc    Register a new real emergency resource in MongoDB
 * @access  Private (Commander / Responder)
 */
const createResource = async (req, res, next) => {
  try {
    const { name, type, category, status, capacity, location, notes } = req.body;

    const resource = await Resource.create({
      name: name.trim(),
      type: (type || category || 'GENERAL').toUpperCase(),
      category: (category || type || 'GENERAL').toUpperCase(),
      status: (status || 'AVAILABLE').toUpperCase(),
      capacity: capacity ? String(capacity).trim() : null,
      location: location ? String(location).trim() : null,
      notes: notes || '',
    });

    const formatted = formatResourceDoc(resource);
    socketService.broadcastResourceUpdated(formatted);

    return ApiResponse.success(res, 201, 'Resource added successfully to database', {
      resource: formatted,
    });
  } catch (error) {
    logger.error('[ResourceController] Failed to create resource:', error);
    next(error);
  }
};

/**
 * @route   PUT /api/v1/resources/:id
 * @desc    Update resource details or operational status
 * @access  Private (Commander / Responder)
 */
const updateResource = async (req, res, next) => {
  try {
    const { id } = req.params;

    const query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { id };
    const updateData = { ...req.body };

    if (updateData.status) {
      updateData.status = updateData.status.toUpperCase();
    }
    if (updateData.type) {
      updateData.type = updateData.type.toUpperCase();
    }

    const updated = await Resource.findOneAndUpdate(query, updateData, { new: true });
    if (!updated) {
      return next(new ApiError(404, `Resource with ID '${id}' not found`));
    }

    const formatted = formatResourceDoc(updated);
    socketService.broadcastResourceUpdated(formatted);

    return ApiResponse.success(res, 200, 'Resource updated successfully', {
      resource: formatted,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/resources/assign (or /api/v1/resources/:id/assign)
 * @desc    Assign a real available emergency resource to an active incident
 * @access  Private (Responder / Commander)
 */
const assignResource = async (req, res, next) => {
  try {
    const resourceId = req.params.id || req.body.resourceId || req.body.id;
    const incidentId = req.body.incidentId || req.body.targetIncident;
    const etaMinutes = req.body.etaMinutes ? Number(req.body.etaMinutes) : null;
    const notes = req.body.notes || req.body.dispatchNotes || '';
    const assignedBy = req.user?.email || req.body.assignedBy || 'Commander';

    if (!resourceId) {
      return next(new ApiError(400, 'Resource ID is required for assignment'));
    }
    if (!incidentId) {
      return next(new ApiError(400, 'Target incident ID is required for assignment'));
    }

    // 1. Fetch Resource
    const resQuery = mongoose.Types.ObjectId.isValid(resourceId)
      ? { _id: resourceId }
      : { $or: [{ _id: resourceId }, { id: resourceId }, { name: resourceId }] };

    const resource = await Resource.findOne(resQuery);
    if (!resource) {
      return next(new ApiError(404, `Resource with ID '${resourceId}' not found in database`));
    }

    // 2. Strict Backend Status Validation (Do NOT allow OFFLINE, ALLOCATED, or BUSY)
    const currentStatus = (resource.status || 'AVAILABLE').toUpperCase();
    if (currentStatus !== 'AVAILABLE') {
      return next(
        new ApiError(
          400,
          `Cannot assign resource '${resource.name}': current status is ${currentStatus}. Only AVAILABLE units can be dispatched.`
        )
      );
    }

    // 3. Fetch Target Incident
    let incident = null;
    if (mongoose.Types.ObjectId.isValid(incidentId)) {
      incident = await Incident.findById(incidentId);
    }
    if (!incident) {
      incident = await Incident.findOne({
        $or: [{ packetId: incidentId }, { clientRequestId: incidentId }, { title: incidentId }],
      });
    }

    if (!incident) {
      return next(new ApiError(404, `Target incident with ID '${incidentId}' not found in database`));
    }

    // 4. Validate Incident Status
    const incStatus = (incident.status || '').toUpperCase();
    if (['RESOLVED', 'CLOSED', 'COMPLETED', 'CANCELLED'].includes(incStatus)) {
      return next(
        new ApiError(400, `Cannot assign resource to a ${incStatus} incident (${incidentId}).`)
      );
    }

    // 5. Compute Tactical Mission & Location
    const rawIncId = String(incident._id || incident.id || incident.packetId);
    const missionDisplayId = rawIncId.length > 8 ? `INC-${rawIncId.slice(-4).toUpperCase()}` : `INC-${rawIncId}`;
    const incidentLocation = incident.sector || incident.location?.address || (incident.location?.lat && incident.location?.lng ? `GPS: ${incident.location.lat.toFixed(4)}, ${incident.location.lng.toFixed(4)}` : 'Live Telemetry Location');

    // 6. Update Resource Atomically
    resource.status = 'ALLOCATED';
    resource.assignedIncidentId = incident._id;
    resource.currentMission = missionDisplayId;
    resource.location = incidentLocation;
    resource.assignedAt = new Date();
    resource.assignedBy = assignedBy;
    resource.etaMinutes = etaMinutes;
    if (notes) {
      resource.notes = notes;
    }

    await resource.save();

    // 7. Update Incident with assigned unit info
    if (!incident.notes) incident.notes = [];
    incident.notes.push({
      text: `Unit '${resource.name}' (${resource.type}) dispatched to incident by ${assignedBy}. ETA: ${etaMinutes ? `${etaMinutes}m` : 'Immediate'}.`,
      author: assignedBy,
      createdAt: new Date(),
    });
    incident.assignedUnit = resource.name;

    await incident.save();

    // 8. Real-Time Socket.IO Broadcast
    const formattedResource = formatResourceDoc(resource);
    socketService.broadcastResourceAssigned({
      resourceId: formattedResource.id,
      incidentId: String(incident._id || incident.id),
      resource: formattedResource,
      incident: {
        id: String(incident._id || incident.id),
        _id: String(incident._id || incident.id),
        status: incident.status,
        category: incident.category || incident.type,
        location: incidentLocation,
        mission: missionDisplayId,
        assignedUnit: resource.name,
      },
      assignedBy,
      etaMinutes,
      timestamp: new Date().toISOString(),
    });
    socketService.broadcastResourceUpdated(formattedResource);
    socketService.broadcastIncidentUpdated(incident);

    logger.info(`[ResourceController] 🚀 Dispatched '${resource.name}' to mission '${missionDisplayId}' (${incidentLocation})`);

    return ApiResponse.success(res, 200, `Resource '${resource.name}' successfully allocated to mission ${missionDisplayId}`, {
      resource: formattedResource,
      incident: {
        id: String(incident._id),
        status: incident.status,
        category: incident.category || incident.type,
        location: incidentLocation,
        mission: missionDisplayId,
      },
    });
  } catch (error) {
    logger.error('[ResourceController] Assignment failed:', error);
    next(error);
  }
};

/**
 * @route   POST /api/v1/resources/release (or /api/v1/resources/:id/release)
 * @desc    Release an allocated resource back to AVAILABLE
 * @access  Private (Responder / Commander)
 */
const releaseResource = async (req, res, next) => {
  try {
    const resourceId = req.params.id || req.body.resourceId || req.body.id;

    if (!resourceId) {
      return next(new ApiError(400, 'Resource ID is required for release'));
    }

    const resQuery = mongoose.Types.ObjectId.isValid(resourceId)
      ? { _id: resourceId }
      : { $or: [{ _id: resourceId }, { id: resourceId }] };

    const resource = await Resource.findOne(resQuery);
    if (!resource) {
      return next(new ApiError(404, `Resource with ID '${resourceId}' not found`));
    }

    const previousMission = resource.currentMission;
    resource.status = 'AVAILABLE';
    resource.assignedIncidentId = null;
    resource.currentMission = null;
    resource.etaMinutes = null;
    resource.assignedAt = null;
    resource.assignedBy = null;

    await resource.save();

    const formattedResource = formatResourceDoc(resource);
    socketService.broadcastResourceUpdated(formattedResource);

    logger.info(`[ResourceController] 🔄 Released resource '${resource.name}' from mission '${previousMission || 'N/A'}' back to AVAILABLE`);

    return ApiResponse.success(res, 200, `Resource '${resource.name}' returned to AVAILABLE status`, {
      resource: formattedResource,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/v1/resources/:id
 * @desc    Decommission a resource record from MongoDB
 * @access  Private (Admin / Commander)
 */
const deleteResource = async (req, res, next) => {
  try {
    const { id } = req.params;
    const query = mongoose.Types.ObjectId.isValid(id) ? { _id: id } : { id };

    const deleted = await Resource.findOneAndDelete(query);
    if (!deleted) {
      return next(new ApiError(404, `Resource with ID '${id}' not found`));
    }

    return ApiResponse.success(res, 200, `Resource '${id}' decommissioned from database`, { id });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getResources,
  getResourceById,
  createResource,
  updateResource,
  assignResource,
  releaseResource,
  deleteResource,
};
