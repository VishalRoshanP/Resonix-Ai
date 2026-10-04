const mongoose = require('mongoose');
const User = require('../models/User');
const Incident = require('../models/Incident');
const EmergencyPacket = require('../models/EmergencyPacket');
const logger = require('../utils/logger');

// Local fallback store for offline / unconnected mode
const localIncidentStore = new Map();

const getAllIncidents = async (filters = {}, limitCount = 50) => {
  if (mongoose.connection.readyState === 1) {
    try {
      // Phase 4: High-speed inclusive projection selecting only queue-necessary fields
      // Excludes heavy audio/image blobs, nested AI trees, and eliminates sequential user populate
      const dbIncidents = await Incident.find(filters)
        .select('_id id packetId clientRequestId title description category detectedCategory detectedEmergencyCategory citizenSelectedCategory severity priority status location sector victimName citizenName userId createdAt updatedAt completedAt completedBy resolutionSummary completionNotes acknowledgement assignedUnit originalTranscript originalVoiceTranscript speechRecognitionTranscript transcriptScript transcriptQuality transcriptStyle nativeScriptTranscript nativeScriptAvailable script languageConfidence normalizedMeaning aiProcessingStatus selectedVoiceLanguage selectedVoiceLanguageCode detectedLanguage detectedLanguageCode englishTranslation translatedTranscript englishMeaning meaning reason classificationConfidence categoryConflict evidenceBasis reportedOccurrenceTime needsReview trapped peopleAffected photoReference notes aiTriage aiAssessment citizenInput audioReference.hasAudio audioReference.durationSeconds audioReference.mimeType aiAnalysis.disasterCategory aiAnalysis.severity aiAnalysis.priority aiAnalysis.summary aiAnalysis.immediate_risks aiAnalysis.hazards_detected aiAnalysis.recommended_resources')
        .sort({ createdAt: -1 })
        .limit(Math.min(limitCount, 50))
        .maxTimeMS(10000)
        .lean();

      return dbIncidents;
    } catch (err) {
      console.error('ERROR IN getAllIncidents:', err.message);
      logger.warn('[IncidentService] Mongo query fallback to local store:', err.message);
    }
  }
  return Array.from(localIncidentStore.values());
};

/**
 * Phase 7: Lightweight Dashboard Summary Counts
 * Executes high-speed countDocuments queries instead of downloading entire collections
 */
const getDashboardSummary = async () => {
  if (mongoose.connection.readyState === 1) {
    try {
      const activeFilter = { status: { $nin: ['resolved', 'closed', 'completed', 'cancelled', 'RESOLVED', 'CLOSED', 'COMPLETED', 'CANCELLED'] } };
      const [totalIncidents, criticalIncidents, highPriority, activeOperations, completedMissions] = await Promise.all([
        Incident.countDocuments({}).maxTimeMS(5000),
        Incident.countDocuments({
          $or: [
            { severity: { $in: ['critical', 'CRITICAL'] } },
            { priority: { $in: ['critical', 'CRITICAL'] } },
          ],
          ...activeFilter,
        }).maxTimeMS(5000),
        Incident.countDocuments({
          $or: [
            { severity: { $in: ['warning', 'high', 'WARNING', 'HIGH'] } },
            { priority: { $in: ['warning', 'high', 'WARNING', 'HIGH'] } },
          ],
          ...activeFilter,
        }).maxTimeMS(5000),
        Incident.countDocuments(activeFilter).maxTimeMS(5000),
        Incident.countDocuments({
          status: { $in: ['resolved', 'closed', 'completed', 'RESOLVED', 'CLOSED', 'COMPLETED'] },
        }).maxTimeMS(5000),
      ]);

      return {
        totalIncidents,
        criticalIncidents,
        highPriority,
        activeOperations,
        completedMissions,
      };
    } catch (err) {
      logger.warn('[IncidentService] Mongo count fallback to local store:', err.message);
    }
  }

  // Local fallback store calculation
  const all = Array.from(localIncidentStore.values());
  const activeOps = all.filter((i) => !['RESOLVED', 'CLOSED', 'COMPLETED', 'CANCELLED'].includes((i.status || '').toUpperCase())).length;
  const compMissions = all.filter((i) => ['RESOLVED', 'CLOSED', 'COMPLETED'].includes((i.status || '').toUpperCase())).length;
  const crit = all.filter((i) => ['CRITICAL'].includes((i.severity || i.priority || '').toUpperCase()) && !['RESOLVED', 'CLOSED', 'COMPLETED', 'CANCELLED'].includes((i.status || '').toUpperCase())).length;
  const high = all.filter((i) => ['HIGH', 'WARNING'].includes((i.severity || i.priority || '').toUpperCase()) && !['RESOLVED', 'CLOSED', 'COMPLETED', 'CANCELLED'].includes((i.status || '').toUpperCase())).length;

  return {
    totalIncidents: all.length,
    criticalIncidents: crit,
    highPriority: high,
    activeOperations: activeOps,
    completedMissions: compMissions,
  };
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

      // 2. Search string fields (packetId, clientRequestId, id, incidentId) with lean projection
      if (!incidentObj) {
        const incident = await Incident.findOne({
          $or: [
            { packetId: idStr },
            { clientRequestId: idStr },
            { id: idStr },
            { incidentId: idStr },
          ],
        }).populate('assignedResponders', 'name role callsign');
        if (incident) incidentObj = incident.toObject();
      }

      // 3. Fast targeted query by display tag (INC-XXXX) without scanning entire collections
      if (!incidentObj) {
        const cleanTag = idStr.toUpperCase().replace('INC-', '').trim();
        if (cleanTag.length >= 4) {
          const incident = await Incident.findOne({
            $or: [
              { packetId: { $regex: cleanTag + '$', $options: 'i' } },
              { clientRequestId: { $regex: cleanTag + '$', $options: 'i' } },
            ],
          }).populate('assignedResponders', 'name role callsign');
          if (incident) incidentObj = incident.toObject();
        }
      }

      // Enrich with EmergencyPacket voice telemetry only if voiceTranscript is missing
      if (incidentObj && !incidentObj.voiceTranscript && !incidentObj.originalVoiceTranscript) {
        const pKey = incidentObj.packetId || incidentObj.clientRequestId;
        if (pKey) {
          const matchingPkt = await EmergencyPacket.findOne({
            $or: [{ packetId: pKey }, { clientRequestId: pKey }],
          }).select('voiceTranscript originalVoiceTranscript detectedLanguage englishTranslation aiAnalysis').lean();
          if (matchingPkt) {
            incidentObj.voiceTranscript = matchingPkt.voiceTranscript || matchingPkt.originalVoiceTranscript || '';
            incidentObj.originalVoiceTranscript = matchingPkt.originalVoiceTranscript || matchingPkt.voiceTranscript || '';
            incidentObj.detectedLanguage = matchingPkt.detectedLanguage || incidentObj.detectedLanguage || 'English';
            incidentObj.englishTranslation = matchingPkt.englishTranslation || incidentObj.englishTranslation || '';
            if (matchingPkt.aiAnalysis && (!incidentObj.aiAnalysis || Object.keys(incidentObj.aiAnalysis).length === 0)) {
              incidentObj.aiAnalysis = matchingPkt.aiAnalysis;
            }
          }
        }
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
  const detectedEmergencyCategory = (incidentData.detectedEmergencyCategory || incidentData.category || incidentData.disasterCategory || incidentData.type || 'GENERAL').toString().toUpperCase();
  const citizenSelectedCategory = (incidentData.citizenSelectedCategory || incidentData.selectedCategory || incidentData.citizenInput?.selectedCategory || 'GENERAL').toString().toUpperCase();
  const rawCategory = detectedEmergencyCategory !== 'GENERAL' && detectedEmergencyCategory !== 'OTHER' ? detectedEmergencyCategory : (incidentData.category || citizenSelectedCategory || 'GENERAL').toString().toUpperCase();
  const normalizedSeverity = (incidentData.severity || 'HIGH').toString().toUpperCase();
  const normalizedStatus = (incidentData.status || 'active').toString().toLowerCase();
  const categoryConflict = incidentData.categoryConflict !== undefined
    ? Boolean(incidentData.categoryConflict)
    : Boolean(citizenSelectedCategory !== rawCategory && citizenSelectedCategory !== 'GENERAL' && citizenSelectedCategory !== 'OTHER');
  const evidenceBasis = incidentData.evidenceBasis || (incidentData.voiceTranscript || incidentData.originalTranscript ? 'VOICE' : 'CITIZEN_SELECTION');
  const needsReview = incidentData.needsReview !== undefined ? Boolean(incidentData.needsReview) : false;
  const reportedOccurrenceTime = incidentData.reportedOccurrenceTime || null;

  let resolvedLat = null;
  let resolvedLng = null;
  let resolvedAccuracy = null;

  if (incidentData.location && typeof incidentData.location === 'object') {
    if (incidentData.location.lat != null && incidentData.location.lat !== '') resolvedLat = Number(incidentData.location.lat);
    else if (incidentData.location.latitude != null && incidentData.location.latitude !== '') resolvedLat = Number(incidentData.location.latitude);

    if (incidentData.location.lng != null && incidentData.location.lng !== '') resolvedLng = Number(incidentData.location.lng);
    else if (incidentData.location.longitude != null && incidentData.location.longitude !== '') resolvedLng = Number(incidentData.location.longitude);

    if (incidentData.location.accuracy != null && incidentData.location.accuracy !== '') resolvedAccuracy = Number(incidentData.location.accuracy);
  }

  if (resolvedLat == null && incidentData.latitude != null && incidentData.latitude !== '') resolvedLat = Number(incidentData.latitude);
  if (resolvedLng == null && incidentData.longitude != null && incidentData.longitude !== '') resolvedLng = Number(incidentData.longitude);

  if ((resolvedLat == null || resolvedLng == null) && incidentData.gpsCoordinates && typeof incidentData.gpsCoordinates === 'object') {
    if (incidentData.gpsCoordinates.latitude != null && incidentData.gpsCoordinates.latitude !== '') resolvedLat = Number(incidentData.gpsCoordinates.latitude);
    else if (incidentData.gpsCoordinates.lat != null && incidentData.gpsCoordinates.lat !== '') resolvedLat = Number(incidentData.gpsCoordinates.lat);

    if (incidentData.gpsCoordinates.longitude != null && incidentData.gpsCoordinates.longitude !== '') resolvedLng = Number(incidentData.gpsCoordinates.longitude);
    else if (incidentData.gpsCoordinates.lng != null && incidentData.gpsCoordinates.lng !== '') resolvedLng = Number(incidentData.gpsCoordinates.lng);

    if (resolvedAccuracy == null && incidentData.gpsCoordinates.accuracy != null) resolvedAccuracy = Number(incidentData.gpsCoordinates.accuracy);
    if (resolvedAccuracy == null && incidentData.gpsCoordinates.accuracyMeters != null) resolvedAccuracy = Number(incidentData.gpsCoordinates.accuracyMeters);
  }

  if (resolvedLat == null || resolvedLng == null) {
    const coords = Array.isArray(incidentData.coordinates)
      ? incidentData.coordinates
      : (Array.isArray(incidentData.location?.coordinates) ? incidentData.location.coordinates : null);
    if (coords && coords.length >= 2 && coords[0] != null && coords[1] != null && coords[0] !== '' && coords[1] !== '') {
      resolvedLng = Number(coords[0]);
      resolvedLat = Number(coords[1]);
    }
  }

  if (resolvedAccuracy == null && incidentData.accuracyMeters != null) resolvedAccuracy = Number(incidentData.accuracyMeters);
  if (resolvedAccuracy == null && incidentData.accuracy != null) resolvedAccuracy = Number(incidentData.accuracy);

  const isValidLat = typeof resolvedLat === 'number' && !isNaN(resolvedLat) && isFinite(resolvedLat) && resolvedLat >= -90 && resolvedLat <= 90;
  const isValidLng = typeof resolvedLng === 'number' && !isNaN(resolvedLng) && isFinite(resolvedLng) && resolvedLng >= -180 && resolvedLng <= 180;
  const hasValidGps = isValidLat && isValidLng && (resolvedLat !== 0 || resolvedLng !== 0);

  const finalLat = hasValidGps ? resolvedLat : null;
  const finalLng = hasValidGps ? resolvedLng : null;
  const finalAccuracy = resolvedAccuracy != null && !isNaN(resolvedAccuracy) && isFinite(resolvedAccuracy) ? resolvedAccuracy : null;
  const defaultSector = (finalLat != null && finalLng != null) ? `GPS: ${finalLat.toFixed(4)}, ${finalLng.toFixed(4)}` : 'Live Telemetry Sector';

  const docData = {
    packetId: incidentData.packetId || null,
    clientRequestId: incidentData.clientRequestId || incidentData.packetId || null,
    userId: incidentData.userId || 'usr_guest',
    victimName: incidentData.victimName || incidentData.citizenName || 'Citizen User',
    citizenName: incidentData.citizenName || incidentData.victimName || 'Citizen User',
    deviceId: incidentData.deviceId || null,
    title: incidentData.title || `${rawCategory} Emergency Report (${incidentData.packetId || Date.now()})`,
    description: incidentData.description || 'Disaster telemetry report submitted by citizen',
    category: rawCategory,
    detectedEmergencyCategory: rawCategory,
    selectedCategory: citizenSelectedCategory,
    citizenSelectedCategory: citizenSelectedCategory,
    categoryConflict,
    evidenceBasis,
    needsReview,
    trapped: Boolean(incidentData.trapped || incidentData.aiAssessment?.trapped),
    reportedOccurrenceTime,
    type: rawCategory.toLowerCase(),
    severity: normalizedSeverity,
    priority: (incidentData.priority || 'HIGH').toString().toUpperCase(),
    peopleAffected: incidentData.peopleAffected !== undefined ? Number(incidentData.peopleAffected) : 0,
    recordingDuration: Number(incidentData.recordingDuration || 0),
    sector: incidentData.sector && !incidentData.sector.startsWith('Sector 4') && !incidentData.sector.startsWith('Sector 7')
      ? incidentData.sector
      : (defaultSector || incidentData.sector || 'Live Telemetry Sector'),
    location: {
      lat: finalLat,
      lng: finalLng,
      accuracy: finalAccuracy,
      address: (finalLat != null && finalLng != null) ? defaultSector : (incidentData.location?.address || incidentData.address || incidentData.sector || 'Location unavailable'),
    },
    status: ['reported', 'active', 'monitoring', 'acknowledged', 'resolved'].includes(normalizedStatus) ? normalizedStatus : 'active',
    originalTranscript: incidentData.originalTranscript || incidentData.originalVoiceTranscript || incidentData.voiceTranscript || incidentData.transcript || '',
    originalVoiceTranscript: incidentData.originalVoiceTranscript || incidentData.originalTranscript || incidentData.voiceTranscript || incidentData.transcript || '',
    voiceTranscript: incidentData.voiceTranscript || incidentData.originalTranscript || incidentData.originalVoiceTranscript || incidentData.transcript || '',
    nativeScriptTranscript: incidentData.nativeScriptTranscript || '',
    nativeScriptAvailable: Boolean(incidentData.nativeScriptAvailable || (incidentData.nativeScriptTranscript && incidentData.nativeScriptTranscript.trim())),
    script: incidentData.script || incidentData.transcriptScript || 'Latin',
    languageConfidence: typeof incidentData.languageConfidence === 'number' ? incidentData.languageConfidence : 0.95,
    normalizedMeaning: incidentData.normalizedMeaning || incidentData.englishMeaning || incidentData.meaning || '',
    detectedLanguage: incidentData.detectedLanguage || incidentData.language || 'English',
    detectedLanguageCode: incidentData.detectedLanguageCode || incidentData.languageCode || 'unknown',
    originalAudio: incidentData.originalAudio || incidentData.audioReference?.dataUrl || null,
    audioReference: incidentData.audioReference || null,
    aiProcessingStatus: incidentData.aiProcessingStatus || 'COMPLETED',
    englishTranslation: incidentData.englishTranslation || '',
    translatedTranscript: incidentData.translatedTranscript || incidentData.englishTranslation || null,
    relayAnalytics: incidentData.relayAnalytics || null,
    citizenInput: incidentData.citizenInput || {
      selectedCategory: citizenSelectedCategory,
      voiceTranscript: incidentData.originalTranscript || incidentData.voiceTranscript || incidentData.originalVoiceTranscript || incidentData.transcript || '',
      textDescription: incidentData.description || '',
      photoReference: incidentData.photoReference || null,
      gpsCoordinates: incidentData.location || null,
    },
    aiAssessment: incidentData.aiAssessment || {
      category: rawCategory,
      detectedEmergencyCategory: rawCategory,
      selectedCategory: citizenSelectedCategory,
      citizenSelectedCategory,
      categoryConflict,
      evidenceBasis,
      needsReview,
      severity: normalizedSeverity,
      priority: (incidentData.priority || 'HIGH').toString().toUpperCase(),
      confidence: 0.95,
      meaning: incidentData.description || '',
      reason: incidentData.description || '',
      englishTranslation: incidentData.englishTranslation || '',
      trapped: Boolean(incidentData.trapped || incidentData.aiAssessment?.trapped),
      hazards: incidentData.hazards || [rawCategory],
      keyEvidence: [],
      contradictionDetected: categoryConflict,
      contradictionNote: categoryConflict ? `⚠ Citizen selected ${citizenSelectedCategory}. Reported evidence indicates ${rawCategory}.` : null,
      confidenceNote: null,
    },
    aiAnalysis: {
      summary: incidentData.aiAnalysis?.summary || incidentData.description || `${rawCategory} emergency report`,
      disasterType: rawCategory,
      disasterCategory: rawCategory,
      severity: normalizedSeverity,
      priority: incidentData.priority || 'HIGH',
      confidence: incidentData.aiAnalysis?.confidenceScore || incidentData.aiAnalysis?.confidence || null,
      ...incidentData.aiAnalysis,
    },
    imageAnalysis: incidentData.imageAnalysis || null,
    photoReference: incidentData.photoReference || null,
  };

  let createdDoc = null;

  if (mongoose.connection.readyState === 1) {
    try {
      const targetKey = docData.clientRequestId || docData.packetId;
      if (targetKey) {
        const existingDoc = await Incident.findOne({
          $or: [
            { clientRequestId: targetKey },
            { packetId: targetKey },
          ],
        });
        if (existingDoc) {
          logger.info(`[IncidentService] Duplicate incident creation prevented for key '${targetKey}'. Returning existing document '${existingDoc._id}'.`);
          const existingObj = existingDoc.toObject();
          existingObj._id = String(existingDoc._id);
          localIncidentStore.set(String(existingObj._id), existingObj);
          return existingObj;
        }
      }

      const dbDoc = await Incident.create(docData);
      createdDoc = dbDoc.toObject();
      createdDoc._id = String(dbDoc._id);

      console.log('==================================================');
      console.log('[INCIDENT_CREATE]');
      console.log(`incidentId=${createdDoc._id}`);
      console.log(`clientRequestId=${docData.clientRequestId || 'N/A'}`);
      console.log(`packetId=${docData.packetId || 'N/A'}`);
      console.log(`category=${docData.category}`);
      console.log(`location=${JSON.stringify(docData.location || {})}`);
      console.log(`source=Authoritative Incident Service`);
      console.log(`timestamp=${new Date().toISOString()}`);
      console.log('==================================================');
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

    console.log('==================================================');
    console.log('[INCIDENT_CREATE - LOCAL MEMORY STORE]');
    console.log(`incidentId=${createdDoc._id}`);
    console.log(`clientRequestId=${docData.clientRequestId || 'N/A'}`);
    console.log(`packetId=${docData.packetId || 'N/A'}`);
    console.log(`category=${docData.category}`);
    console.log(`location=${JSON.stringify(docData.location || {})}`);
    console.log(`source=Local Memory Store Fallback`);
    console.log(`timestamp=${new Date().toISOString()}`);
    console.log('==================================================');
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

      // 2. Search string fields (packetId, clientRequestId, id, incidentId) without querying _id to prevent CastError
      if (!deleted) {
        deleted = await Incident.findOneAndDelete({
          $or: [
            { packetId: idStr },
            { clientRequestId: idStr },
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
          const docClientReq = String(d.clientRequestId || '').toUpperCase();
          const docId = String(d.id || '').toUpperCase();

          return (
            docIdStr === idStr.toUpperCase() ||
            docPacket === idStr.toUpperCase() ||
            docClientReq === idStr.toUpperCase() ||
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

      // 2. Search string fields (packetId, clientRequestId, id, incidentId) without querying _id to prevent CastError
      if (!updated) {
        updated = await Incident.findOneAndUpdate(
          {
            $or: [
              { packetId: idStr },
              { clientRequestId: idStr },
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
          const docClientReq = String(d.clientRequestId || '').toUpperCase();
          const docId = String(d.id || '').toUpperCase();

          return (
            docIdStr === idStr.toUpperCase() ||
            docPacket === idStr.toUpperCase() ||
            docClientReq === idStr.toUpperCase() ||
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
        const epDoc = await EmergencyPacket.findOneAndUpdate(
          { $or: [{ packetId: idStr }, { clientRequestId: idStr }, { id: idStr }] },
          { packetStatus: (updateData.status || 'resolved').toUpperCase(), ...updateData },
          { new: true }
        );
        if (epDoc) {
          updated = { _id: epDoc._id, id: epDoc.packetId || idStr, packetId: epDoc.packetId, clientRequestId: epDoc.clientRequestId, ...updateData };
        }
      }
      if (updated) {
        logger.info(`[IncidentService] Successfully updated MongoDB incident/packet '${idStr}'. Status: ${updateData.status}`);
      }
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

const acknowledgeIncident = async (id, responderInfo = {}) => {
  const idStr = String(id || '').trim();
  const responderName = typeof responderInfo === 'string'
    ? responderInfo
    : (responderInfo.name || responderInfo.badgeId || responderInfo.email || 'Command Officer');

  const now = new Date();

  // First check if already acknowledged to prevent duplicate events/updates
  const existing = await getIncidentById(idStr);
  if (existing && existing.acknowledgement?.status === 'ACKNOWLEDGED') {
    logger.info(`[IncidentService] Incident '${idStr}' already acknowledged by '${existing.acknowledgement.acknowledgedBy}'. Skipping duplicate update.`);
    return existing;
  }

  const ackData = {
    acknowledgement: {
      status: 'ACKNOWLEDGED',
      acknowledgedAt: now,
      acknowledgedBy: responderName,
    },
  };

  const updated = await updateIncident(idStr, ackData);

  if (mongoose.connection.readyState === 1) {
    try {
      await EmergencyPacket.findOneAndUpdate(
        { $or: [{ packetId: idStr }, { clientRequestId: idStr }] },
        { acknowledgement: ackData.acknowledgement }
      );
    } catch (_) {}
  }

  return updated;
};

module.exports = {
  getAllIncidents,
  getDashboardSummary,
  getIncidentById,
  createIncident,
  mergeIncidents,
  updateIncidentPriority,
  updateIncidentStatus,
  updateIncident,
  acknowledgeIncident,
  deleteIncident,
};
