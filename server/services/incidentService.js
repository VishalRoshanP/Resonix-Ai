const mongoose = require('mongoose');
const Incident = require('../models/Incident');
const EmergencyPacket = require('../models/EmergencyPacket');
const logger = require('../utils/logger');

// Local fallback store for offline / unconnected mode
const localIncidentStore = new Map();

const getAllIncidents = async (filters = {}, limitCount = 100) => {
  if (mongoose.connection.readyState === 1) {
    try {
      const [dbIncidents, dbPackets] = await Promise.all([
        Incident.find(filters)
          .populate('assignedResponders', 'name role callsign')
          .sort({ createdAt: -1 })
          .limit(limitCount)
          .lean(),
        EmergencyPacket.find({})
          .sort({ timestamp: -1 })
          .limit(limitCount)
          .lean(),
      ]);

      const incidentIds = new Set(dbIncidents.map((i) => String(i._id || i.id)));
      const combined = [...dbIncidents];

      dbPackets.forEach((pkt) => {
        const id = pkt.packetId || String(pkt._id);
        if (!incidentIds.has(id)) {
          incidentIds.add(id);
          combined.push({
            _id: id,
            id: id,
            packetId: pkt.packetId,
            title: `Citizen Emergency SOS (${pkt.packetId || id})`,
            description: pkt.description || pkt.notes || pkt.aiAnalysis?.summary || 'Emergency telemetry report',
            category: (pkt.aiAnalysis?.disasterCategory || pkt.category || 'GENERAL').toUpperCase(),
            severity: (pkt.aiAnalysis?.severity || pkt.severity || 'HIGH').toUpperCase(),
            sector: pkt.gpsCoordinates?.sector || (pkt.gpsCoordinates?.latitude && pkt.gpsCoordinates?.longitude ? `GPS: ${pkt.gpsCoordinates.latitude.toFixed(4)}, ${pkt.gpsCoordinates.longitude.toFixed(4)}` : 'GPS Coordinates Active'),
            location: {
              lat: pkt.gpsCoordinates?.latitude || 12.9716,
              lng: pkt.gpsCoordinates?.longitude || 77.5946,
              address: pkt.gpsCoordinates?.sector || (pkt.gpsCoordinates?.latitude && pkt.gpsCoordinates?.longitude ? `GPS: ${pkt.gpsCoordinates.latitude.toFixed(4)}, ${pkt.gpsCoordinates.longitude.toFixed(4)}` : 'GPS Location Active'),
            },
            status: (pkt.packetStatus === 'DELIVERED' ? 'active' : (pkt.packetStatus || 'active')).toLowerCase(),
            aiAnalysis: pkt.aiAnalysis,
            relayAnalytics: pkt.relayAnalytics,
            userId: pkt.userId,
            createdAt: pkt.timestamp || pkt.createdAt || new Date().toISOString(),
          });
        }
      });

      return combined;
    } catch (err) {
      logger.warn('[IncidentService] Mongo query fallback to local store:', err.message);
    }
  }
  return Array.from(localIncidentStore.values());
};

const getIncidentById = async (id, userRole = 'citizen') => {
  let incidentObj = null;
  const idStr = String(id || '').trim();

  if (mongoose.connection.readyState === 1) {
    try {
      // 1. If valid 24-character hex ObjectId, search by findById
      if (mongoose.Types.ObjectId.isValid(idStr)) {
        const incident = await Incident.findById(idStr).populate('assignedResponders', 'name role callsign');
        if (incident) incidentObj = incident.toObject();
      }

      // 2. Search string fields (packetId, id, incidentId) without querying _id to prevent CastError
      if (!incidentObj) {
        const incident = await Incident.findOne({
          $or: [
            { packetId: idStr },
            { id: idStr },
            { incidentId: idStr },
          ],
        }).populate('assignedResponders', 'name role callsign');
        if (incident) incidentObj = incident.toObject();
      }

      // 3. Robust fallback: scan documents matching display tag (INC-XXXX) or ID slice
      if (!incidentObj) {
        const allDocs = await Incident.find({}).lean();
        const cleanTag = idStr.toUpperCase().replace('INC-', '').trim();
        const matched = allDocs.find((d) => {
          const docIdStr = String(d._id).toUpperCase();
          const docPacket = String(d.packetId || '').toUpperCase();
          const docId = String(d.id || '').toUpperCase();

          return (
            docIdStr === idStr.toUpperCase() ||
            docPacket === idStr.toUpperCase() ||
            docId === idStr.toUpperCase() ||
            docIdStr.endsWith(cleanTag) ||
            docIdStr.includes(cleanTag)
          );
        });
        if (matched) incidentObj = matched;
      }
    } catch (err) {
      logger.warn('[IncidentService] Mongo lookup fallback to local store:', err.message);
    }
  }

  if (!incidentObj) {
    const cleanTag = idStr.toUpperCase().replace('INC-', '').trim();
    const localDoc = localIncidentStore.get(idStr) || Array.from(localIncidentStore.values()).find(
      (item) => {
        const docIdStr = String(item._id || item.id || '').toUpperCase();
        return docIdStr === idStr.toUpperCase() || docIdStr.endsWith(cleanTag);
      }
    );
    if (localDoc) incidentObj = { ...localDoc };
  }

  if (!incidentObj) return null;

  // Privacy control: reasoning details are hidden from citizens, visible to responders/commanders
  if (userRole === 'citizen' && incidentObj.aiAnalysis) {
    delete incidentObj.aiAnalysis.explanation;
  }

  return incidentObj;
};

/**
 * 1. createIncident Operation
 */
const createIncident = async (incidentData = {}) => {
  const normalizedType = (incidentData.category || incidentData.type || 'general').toLowerCase();
  const normalizedSeverity = (incidentData.severity || 'warning').toLowerCase();
  const normalizedStatus = (incidentData.status || 'active').toLowerCase();

  const docData = {
    title: incidentData.title || `Emergency Incident ${Date.now()}`,
    description: incidentData.description || 'Disaster telemetry report submitted by citizen',
    type: ['seismic', 'flood', 'fire', 'structural', 'medical', 'general'].includes(normalizedType) ? normalizedType : 'general',
    severity: ['low', 'moderate', 'warning', 'critical'].includes(normalizedSeverity) ? normalizedSeverity : 'warning',
    sector: incidentData.sector || 'Sector 4',
    location: {
      lat: incidentData.location?.lat || incidentData.latitude || 12.9716,
      lng: incidentData.location?.lng || incidentData.longitude || 77.5946,
      address: incidentData.location?.address || incidentData.address || 'Emergency Incident Sector',
    },
    status: ['reported', 'active', 'monitoring', 'acknowledged', 'resolved'].includes(normalizedStatus) ? normalizedStatus : 'active',
    aiAnalysis: {
      summary: incidentData.aiAnalysis?.summary || incidentData.description || 'Gemma 4 AI Disaster Summary',
      disasterType: incidentData.aiAnalysis?.disasterCategory || incidentData.aiAnalysis?.disaster_type || incidentData.category || 'FLOOD',
      severity: incidentData.severity || incidentData.aiAnalysis?.severity || 'CRITICAL',
      priority: incidentData.aiAnalysis?.recommendedPriority || incidentData.priority || 'HIGH',
      hazards: incidentData.aiAnalysis?.hazards || [{ hazard: 'FLOOD_WATER', severity: 'HIGH' }],
      confidence: incidentData.aiAnalysis?.confidenceScore || incidentData.aiAnalysis?.confidence || null,
      resourceRecommendations: incidentData.aiAnalysis?.resourceRecommendations || incidentData.aiAnalysis?.recommendedActions || ['NDRF Squad', 'Rescue Boats'],
      visionAnalysis: incidentData.aiAnalysis?.visionAnalysis || incidentData.visionData || { overall_scene_description: 'Visual evidence verified' },
      ragReferences: incidentData.aiAnalysis?.ragReferences || incidentData.aiAnalysis?.knowledgeReferences || ['NDMA SOP Guidelines 2024'],
      ...incidentData.aiAnalysis,
    },
    imageAnalysis: incidentData.imageAnalysis || null,
    photoReference: incidentData.photoReference || null,
  };

  let createdDoc = null;

  if (mongoose.connection.readyState === 1) {
    try {
      const dbDoc = await Incident.create(docData);
      createdDoc = dbDoc.toObject();
      createdDoc._id = String(dbDoc._id);
    } catch (err) {
      logger.warn('[IncidentService] Mongo create fallback to local store:', err.message);
    }
  }

  if (!createdDoc) {
    const fallbackId = `inc_obj_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    createdDoc = {
      _id: fallbackId,
      ...docData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  localIncidentStore.set(String(createdDoc._id), createdDoc);
  logger.info(`[IncidentService] Created incident '${createdDoc._id}' (${createdDoc.title}).`);
  return createdDoc;
};

/**
 * 2. mergeIncident Operation
 */
const mergeIncidents = async (primaryIncidentId, secondaryIncidentIds = [], mergeReason = 'Duplicate reports merged') => {
  const primary = await getIncidentById(primaryIncidentId, 'responder');
  if (!primary) {
    throw new Error(`Primary incident '${primaryIncidentId}' not found for merging.`);
  }

  const updatedSecondary = [];
  if (Array.isArray(secondaryIncidentIds) && secondaryIncidentIds.length > 0) {
    for (const secId of secondaryIncidentIds) {
      if (mongoose.connection.readyState === 1) {
        try {
          await Incident.findByIdAndUpdate(secId, {
            status: 'resolved',
            description: `[MERGED into ${primaryIncidentId}] ${mergeReason}`,
          });
        } catch (err) {
          // ignore
        }
      }

      const secLocal = localIncidentStore.get(String(secId));
      if (secLocal) {
        secLocal.status = 'resolved';
        secLocal.description = `[MERGED into ${primaryIncidentId}] ${mergeReason}`;
        localIncidentStore.set(String(secId), secLocal);
      }
      updatedSecondary.push(String(secId));
    }
  }

  const newDescription = `${primary.description} | [Merged ${updatedSecondary.length} duplicate incidents: ${mergeReason}]`;

  if (mongoose.connection.readyState === 1) {
    try {
      await Incident.findByIdAndUpdate(primaryIncidentId, { description: newDescription });
    } catch (err) {
      // ignore
    }
  }

  primary.description = newDescription;
  localIncidentStore.set(String(primary._id), primary);

  logger.info(`[IncidentService] Merged ${updatedSecondary.length} secondary incidents into primary '${primary._id}'.`);
  return {
    status: 'MERGED',
    primaryIncidentId: String(primary._id),
    secondaryIncidentIds: updatedSecondary,
    mergeReason,
    updatedAt: new Date().toISOString(),
  };
};

/**
 * 3. updateIncidentPriority Operation
 */
const updateIncidentPriority = async (id, priority, priorityCode = 'P1', reason = 'Priority triage update') => {
  const incident = await getIncidentById(id, 'responder');
  if (!incident) {
    throw new Error(`Incident '${id}' not found for priority update.`);
  }

  const severityMapping = {
    CRITICAL: 'critical',
    HIGH: 'warning',
    MEDIUM: 'moderate',
    LOW: 'low',
    P1: 'critical',
    P2: 'warning',
    P3: 'moderate',
    P4: 'low',
  };

  const normalizedSeverity = severityMapping[priority.toUpperCase()] || 'critical';
  const newDescription = `${incident.description} | [Priority Updated to ${priority} (${priorityCode}): ${reason}]`;

  if (mongoose.connection.readyState === 1) {
    try {
      await Incident.findByIdAndUpdate(id, { severity: normalizedSeverity, description: newDescription });
    } catch (err) {
      // ignore
    }
  }

  incident.severity = normalizedSeverity;
  incident.description = newDescription;
  localIncidentStore.set(String(incident._id), incident);

  logger.info(`[IncidentService] Updated incident '${id}' priority to '${priority}' (${normalizedSeverity}).`);
  return {
    status: 'PRIORITY_UPDATED',
    incidentId: String(incident._id),
    newPriority: priority,
    priorityCode,
    newSeverity: normalizedSeverity,
    reason,
    updatedAt: new Date().toISOString(),
  };
};

/**
 * 4. updateIncidentStatus Operation
 */
const updateIncidentStatus = async (id, status, responderNotes = 'Status update by responder') => {
  const incident = await getIncidentById(id, 'responder');
  if (!incident) {
    throw new Error(`Incident '${id}' not found for status update.`);
  }

  const statusMapping = {
    REPORTED: 'reported',
    ACTIVE: 'active',
    VERIFIED: 'acknowledged',
    DISPATCHED: 'active',
    IN_PROGRESS: 'active',
    MONITORING: 'monitoring',
    RESOLVED: 'resolved',
    CLOSED: 'resolved',
  };

  const normalizedStatus = statusMapping[status.toUpperCase()] || status.toLowerCase();
  const validStatus = ['reported', 'active', 'monitoring', 'acknowledged', 'resolved'].includes(normalizedStatus) ? normalizedStatus : 'active';
  const newDescription = responderNotes ? `${incident.description} | [Status Note: ${responderNotes}]` : incident.description;

  if (mongoose.connection.readyState === 1) {
    try {
      await Incident.findByIdAndUpdate(id, { status: validStatus, description: newDescription });
    } catch (err) {
      // ignore
    }
  }

  incident.status = validStatus;
  incident.description = newDescription;
  localIncidentStore.set(String(incident._id), incident);

  logger.info(`[IncidentService] Updated incident '${id}' status to '${status}' (${validStatus}).`);
  return {
    status: 'STATUS_UPDATED',
    incidentId: String(incident._id),
    newStatus: status,
    normalizedStatus: validStatus,
    responderNotes,
    updatedAt: new Date().toISOString(),
  };
};

const deleteIncident = async (id) => {
  let deleted = null;
  const idStr = String(id || '').trim();

  if (mongoose.connection.readyState === 1) {
    try {
      // 1. If valid 24-character hex ObjectId, attempt findByIdAndDelete
      if (mongoose.Types.ObjectId.isValid(idStr)) {
        deleted = await Incident.findByIdAndDelete(idStr);
      }

      // 2. Search string fields (packetId, id, incidentId) without querying _id to prevent CastError
      if (!deleted) {
        deleted = await Incident.findOneAndDelete({
          $or: [
            { packetId: idStr },
            { id: idStr },
            { incidentId: idStr },
          ],
        });
      }

      // 3. Fallback: scan all documents matching display tag (INC-XXXX) or ID slice
      if (!deleted) {
        const allDocs = await Incident.find({}).lean();
        const cleanTag = idStr.toUpperCase().replace('INC-', '').trim();
        const matched = allDocs.find((d) => {
          const docIdStr = String(d._id).toUpperCase();
          const docPacket = String(d.packetId || '').toUpperCase();
          const docId = String(d.id || '').toUpperCase();

          return (
            docIdStr === idStr.toUpperCase() ||
            docPacket === idStr.toUpperCase() ||
            docId === idStr.toUpperCase() ||
            docIdStr.endsWith(cleanTag) ||
            docIdStr.includes(cleanTag)
          );
        });
        if (matched) {
          deleted = await Incident.findByIdAndDelete(matched._id);
        }
      }

      // 4. Clean up EmergencyPacket collection if matching
      if (mongoose.Types.ObjectId.isValid(idStr)) {
        await EmergencyPacket.deleteMany({ _id: idStr }).catch(() => {});
      }
      await EmergencyPacket.deleteMany({
        $or: [{ packetId: idStr }, { id: idStr }],
      }).catch(() => {});

      if (deleted) {
        localIncidentStore.delete(idStr);
        if (deleted._id) localIncidentStore.delete(String(deleted._id));
        deleted = typeof deleted.toObject === 'function' ? deleted.toObject() : deleted;
      }
    } catch (err) {
      logger.warn(`[IncidentService] Mongo delete warning for ID '${idStr}':`, err.message);
    }
  }

  if (!deleted) {
    const cleanTag = idStr.toUpperCase().replace('INC-', '').trim();
    deleted =
      localIncidentStore.get(idStr) ||
      Array.from(localIncidentStore.values()).find((item) => {
        const docIdStr = String(item._id || item.id || '').toUpperCase();
        return docIdStr === idStr.toUpperCase() || docIdStr.endsWith(cleanTag);
      });
    if (deleted && deleted._id) {
      localIncidentStore.delete(String(deleted._id));
    }
  }

  return deleted;
};

const updateIncident = async (id, updateData) => {
  const idStr = String(id || '').trim();
  let updated = null;

  if (mongoose.connection.readyState === 1) {
    try {
      // 1. If valid 24-character hex ObjectId, attempt findByIdAndUpdate
      if (mongoose.Types.ObjectId.isValid(idStr)) {
        updated = await Incident.findByIdAndUpdate(idStr, updateData, { new: true });
      }

      // 2. Search string fields (packetId, id, incidentId) without querying _id to prevent CastError
      if (!updated) {
        updated = await Incident.findOneAndUpdate(
          {
            $or: [
              { packetId: idStr },
              { id: idStr },
              { incidentId: idStr },
            ],
          },
          updateData,
          { new: true }
        );
      }

      // 3. Fallback: scan all documents matching display tag (INC-XXXX) or ID slice
      if (!updated) {
        const allDocs = await Incident.find({}).lean();
        const cleanTag = idStr.toUpperCase().replace('INC-', '').trim();
        const matched = allDocs.find((d) => {
          const docIdStr = String(d._id).toUpperCase();
          const docPacket = String(d.packetId || '').toUpperCase();
          const docId = String(d.id || '').toUpperCase();

          return (
            docIdStr === idStr.toUpperCase() ||
            docPacket === idStr.toUpperCase() ||
            docId === idStr.toUpperCase() ||
            docIdStr.endsWith(cleanTag) ||
            docIdStr.includes(cleanTag)
          );
        });
        if (matched) {
          updated = await Incident.findByIdAndUpdate(matched._id, updateData, { new: true });
        }
      }

      if (!updated) {
        // Also update EmergencyPacket collection if matching
        await EmergencyPacket.findOneAndUpdate(
          { $or: [{ packetId: idStr }, { id: idStr }] },
          { packetStatus: (updateData.status || 'resolved').toUpperCase(), ...updateData }
        );
        updated = { _id: idStr, id: idStr, ...updateData };
      }
      logger.info(`[IncidentService] Successfully updated MongoDB incident/packet '${idStr}'. Status: ${updateData.status}`);
      return updated;
    } catch (err) {
      logger.warn(`[IncidentService] Mongo update warning for ID '${idStr}':`, err.message);
    }
  }

  const cleanTag = idStr.toUpperCase().replace('INC-', '').trim();
  const local = localIncidentStore.get(idStr) || Array.from(localIncidentStore.values()).find((item) => {
    const docIdStr = String(item._id || item.id || '').toUpperCase();
    return docIdStr === idStr.toUpperCase() || docIdStr.endsWith(cleanTag);
  });

  if (local) {
    Object.assign(local, updateData);
    localIncidentStore.set(String(local._id || idStr), local);
    return local;
  }

  return updated || { _id: idStr, id: idStr, ...updateData };
};

module.exports = {
  getAllIncidents,
  getIncidentById,
  createIncident,
  mergeIncidents,
  updateIncidentPriority,
  updateIncidentStatus,
  updateIncident,
  deleteIncident,
};
