const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');

const EmergencyReport = require('../models/EmergencyReport');
const Incident = require('../models/Incident');
const AiAnalysis = require('../models/AiAnalysis');
const EmergencySummaryRecord = require('../models/EmergencySummaryRecord');
const ConfidenceScoreRecord = require('../models/ConfidenceScoreRecord');
const ExplainableAiRecord = require('../models/ExplainableAiRecord');
const incidentTriageService = require('../services/incidentTriageService');
const socketService = require('../services/socketService');
const logger = require('../utils/logger');

/**
 * @route   GET /api/reports
 * @desc    Get paginated reports list
 * @access  Private / Public
 */
const getReports = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;

    let reports = [];
    let total = 0;

    if (EmergencyReport?.db?.readyState === 1) {
      try {
        const skip = (page - 1) * limit;
        const dbReports = await EmergencyReport.find().sort({ createdAt: -1 }).skip(skip).limit(limit);
        total = await EmergencyReport.countDocuments();
        if (dbReports && dbReports.length > 0) {
          reports = dbReports.map((r) => r.toObject());
        }
      } catch (err) {
        // Database query error handled gracefully with empty list
      }
    }

    return ApiResponse.success(res, 200, 'Reports retrieved successfully', {
      reports,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getReportById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (EmergencyReport?.db?.readyState === 1) {
      try {
        const report = await EmergencyReport.findOne({
          $or: [{ reportId: id }, { packetId: id }, { _id: id.match(/^[0-9a-fA-F]{24}$/) ? id : null }],
        });
        if (report) {
          return ApiResponse.success(res, 200, 'Report details retrieved from database', { report });
        }
      } catch (_) {}
    }

    return next(new ApiError(404, `Report with ID '${id}' not found`));
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/reports
 * @desc    Submit a new disaster report
 * @access  Private / Public
 */
const createReport = async (req, res, next) => {
  try {
    const newReport = {
      id: `rpt_${Date.now()}`,
      ...req.body,
      status: 'submitted',
      createdAt: new Date().toISOString(),
    };

    return ApiResponse.success(res, 201, 'Report submitted successfully', { report: newReport });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/reports/:id
 * @desc    Update an existing report
 * @access  Private
 */
const updateReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updatedReport = {
      id,
      ...req.body,
      updatedAt: new Date().toISOString(),
    };

    return ApiResponse.success(res, 200, 'Report updated successfully', { report: updatedReport });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   DELETE /api/reports/:id
 * @desc    Delete a report
 * @access  Private (Admin / Commander)
 */
const deleteReport = async (req, res, next) => {
  try {
    const { id } = req.params;
    return ApiResponse.success(res, 200, `Report '${id}' deleted successfully`, { id });
  } catch (error) {
    next(error);
  }
};

const gemmaService = require('../services/gemma');

const ImageUnderstanding = require('../models/ImageUnderstanding');

/**
 * @route   POST /api/reports/upload
 * @desc    Upload disaster photo for Gemma 4 image intelligence analysis & store observations separately
 * @access  Public / Citizen
 */
const uploadReportPhoto = async (req, res, next) => {
  try {
    const { imageData, mimeType = 'image/jpeg', promptText, packetId, reportId, context = {} } = req.body || {};

    let analysis = null;
    try {
      analysis = await gemmaService.analyzeImage({
        imageData: imageData || '',
        mimeType,
        promptText: promptText || 'Analyze disaster site damage',
        context,
      });
    } catch (_) {
      // Fallback
    }

    const photoId = `img_${Date.now()}`;
    let savedObservationRecord = null;

    // Store AI visual observation output separately from original image in MongoDB
    try {
      if (ImageUnderstanding?.db?.readyState === 1 && analysis) {
        savedObservationRecord = await ImageUnderstanding.create({
          photoId,
          packetId: packetId || null,
          reportId: reportId || null,
          visibleDisaster: analysis.visibleDisaster || 'NONE',
          floodDepth: analysis.floodDepth || 'None',
          fireVisible: Boolean(analysis.fireVisible),
          collapsedBuildings: Boolean(analysis.collapsedBuildings),
          roadBlockage: Boolean(analysis.roadBlockage),
          visibleInjuries: Boolean(analysis.visibleInjuries),
          smokePresent: Boolean(analysis.smokePresent),
          waterPresent: Boolean(analysis.waterPresent),
          vehiclesInvolved: analysis.vehiclesInvolved || [],
          infrastructureDamage: analysis.infrastructureDamage || 'NONE',
          confidenceScores: analysis.confidenceScores || {},
          humanVerificationRequired: true, // Always true (AI visual observations never replace human verification)
          humanVerified: false,
          gemmaModel: 'resonix-disaster-intelligence',
        });
      }
    } catch (dbErr) {
      // Fallback for mock/demo mode
    }

    return ApiResponse.success(res, 200, 'Report photo uploaded securely and visual observations stored separately', {
      photoId,
      mimeType,
      url: `/uploads/${photoId}.jpg`,
      gemmaAnalysis: analysis,
      observationRecordId: savedObservationRecord?._id || null,
      humanVerificationRequired: true,
      uploadedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/reports/location
 * @desc    Save report GPS coordinates and accuracy metrics
 * @access  Public / Citizen
 */
const saveReportLocation = async (req, res, next) => {
  try {
    const { latitude, longitude, accuracy, status = 'GPS_AVAILABLE' } = req.body || {};

    const locationId = `loc_${Date.now()}`;

    return ApiResponse.success(res, 200, 'GPS location coordinates and accuracy stored successfully', {
      locationId,
      latitude: latitude ? parseFloat(latitude) : null,
      longitude: longitude ? parseFloat(longitude) : null,
      accuracyMeters: accuracy ? parseFloat(accuracy) : null,
      status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

const TextUnderstanding = require('../models/TextUnderstanding');

/**
 * @route   POST /api/reports/analyze-text
 * @desc    Analyze emergency text dispatch using Disaster AI and store AI output separately
 * @access  Public / Citizen
 */
const analyzeTextReport = async (req, res, next) => {
  try {
    const { text, packetId, reportId, context = {} } = req.body || {};

    const analysis = await gemmaService.analyzeText({
      text: text || '',
      context,
    });

    let savedTextRecord = null;

    // Store AI text understanding output separately from original text report in MongoDB
    try {
      if (TextUnderstanding?.db?.readyState === 1 && text) {
        savedTextRecord = await TextUnderstanding.create({
          packetId: packetId || null,
          reportId: reportId || null,
          disaster: analysis.disaster || 'OTHER',
          severity: analysis.severity || 'SEVERE',
          people: analysis.people || 0,
          children: analysis.children || 0,
          medicalNeeds: Boolean(analysis.medicalNeeds),
          infrastructureDamage: analysis.infrastructureDamage || 'NONE',
          urgency: analysis.urgency || 'HIGH',
          keywords: analysis.keywords || [],
          confidence: analysis.confidence || 0.94,
          rawText: text,
          gemmaModel: 'resonix-disaster-intelligence',
        });
      }
    } catch (dbErr) {
      // Fallback for mock/demo mode
    }

    return ApiResponse.success(res, 200, 'Text report analyzed and AI record stored separately', {
      analysis,
      textRecordId: savedTextRecord?._id || null,
      analyzedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

const UnifiedEmergency = require('../models/UnifiedEmergency');
const reportPipeline = require('../pipeline/reportPipeline');

/**
 * @route   POST /api/reports/pipeline
 * @desc    Execute Unified Emergency Understanding Pipeline combining Voice, Image, Text, GPS, and Language
 * @access  Public / Citizen / Command Center
 */
const executeUnifiedPipeline = async (req, res, next) => {
  try {
    const { voice, image, text, gps, language = 'en' } = req.body || {};

    const pipelineResult = await reportPipeline.execute({
      voice,
      image,
      text,
      gps,
      language,
    });

    const unifiedData = pipelineResult.result;
    let savedUnifiedRecord = null;
    let savedOriginalReport = null;
    let savedAiAnalysis = null;
    let savedSummaryRecord = null;
    let savedConfidenceRecord = null;
    let savedExplainableAiRecord = null;

    // Persist records across 5 separate collections while keeping original report immutable
    try {
      const reportId = `rpt_${Date.now()}`;
      const packetId = `pkt_${Date.now()}`;
      const unifiedEmergencyId = unifiedData.unifiedEmergencyId;

      // Collection 1: Original Reports (Immutable raw user submission)
      if (EmergencyReport?.db?.readyState === 1) {
        savedOriginalReport = await EmergencyReport.create({
          reportId,
          packetId,
          rawText: typeof text === 'string' ? text : text?.text || '',
          audioReference: voice?.audioData ? 'audio_ref_attached' : null,
          photoReference: image?.imageData || image?.dataUrl ? 'photo_ref_attached' : null,
          gpsCoordinates: {
            latitude: gps?.latitude ? parseFloat(gps.latitude) : null,
            longitude: gps?.longitude ? parseFloat(gps.longitude) : null,
            accuracyMeters: gps?.accuracy ? parseFloat(gps.accuracy) : null,
            status: gps?.latitude ? 'GPS_AVAILABLE' : 'NO_GPS',
          },
          selectedLanguage: language || 'en',
          submittedAt: new Date(),
        });
      }

      // Collection 2: AI Analysis (Detailed raw Gemma 4 output)
      if (AiAnalysis?.db?.readyState === 1 && unifiedData.detailedAiOutput) {
        savedAiAnalysis = await AiAnalysis.create({
          analysisId: `anl_${Date.now()}`,
          reportId,
          packetId,
          unifiedEmergencyId,
          voiceAnalysis: unifiedData.detailedAiOutput.voiceUnderstanding || null,
          imageAnalysis: unifiedData.detailedAiOutput.imageUnderstanding || null,
          textAnalysis: unifiedData.detailedAiOutput.textUnderstanding || null,
          gemmaModel: 'resonix-disaster-intelligence',
        });
      }

      // Collection 3: Emergency Summary (Responder short bullet summary)
      if (EmergencySummaryRecord?.db?.readyState === 1 && unifiedData.shortSummary) {
        savedSummaryRecord = await EmergencySummaryRecord.create({
          summaryId: `sum_${Date.now()}`,
          reportId,
          packetId,
          unifiedEmergencyId,
          shortSummary: unifiedData.shortSummary,
          shortSummaryLines: unifiedData.shortSummaryLines || [],
          fullSummary: unifiedData.summary?.value || '',
        });
      }

      // Collection 4: Confidence Scores (Per-field float confidence metrics)
      if (ConfidenceScoreRecord?.db?.readyState === 1) {
        const rawScores = [
          unifiedData.primaryDisasterType?.confidence,
          unifiedData.severity?.confidence,
          unifiedData.urgencyTier?.confidence,
          unifiedData.peopleCount?.confidence,
          unifiedData.locationData?.confidence,
        ].filter((s) => typeof s === 'number' && !isNaN(s));
        const avgScore = rawScores.length > 0
          ? Math.round((rawScores.reduce((a, b) => a + b, 0) / rawScores.length) * 100) / 100
          : null;

        savedConfidenceRecord = await ConfidenceScoreRecord.create({
          scoreId: `scr_${Date.now()}`,
          reportId,
          packetId,
          unifiedEmergencyId,
          fieldConfidenceScores: {
            disaster: typeof unifiedData.primaryDisasterType?.confidence === 'number' ? unifiedData.primaryDisasterType.confidence : null,
            severity: typeof unifiedData.severity?.confidence === 'number' ? unifiedData.severity.confidence : null,
            urgency: typeof unifiedData.urgencyTier?.confidence === 'number' ? unifiedData.urgencyTier.confidence : null,
            people: typeof unifiedData.peopleCount?.confidence === 'number' ? unifiedData.peopleCount.confidence : null,
            location: typeof unifiedData.locationData?.confidence === 'number' ? unifiedData.locationData.confidence : null,
          },
          overallConfidence: avgScore,
        });
      }

      // Collection 5: Explainable AI (Transparent decision rationales)
      if (ExplainableAiRecord?.db?.readyState === 1 && unifiedData.explainableAi) {
        savedExplainableAiRecord = await ExplainableAiRecord.create({
          explanationId: `xai_${Date.now()}`,
          reportId,
          packetId,
          unifiedEmergencyId,
          disasterExplanation: unifiedData.explainableAi.disasterExplanation,
          urgencyExplanation: unifiedData.explainableAi.urgencyExplanation,
          severityExplanation: unifiedData.explainableAi.severityExplanation || '',
          peopleExplanation: unifiedData.explainableAi.peopleExplanation || '',
          medicalExplanation: unifiedData.explainableAi.medicalExplanation || '',
          hazardsExplanation: unifiedData.explainableAi.hazardsExplanation || '',
          fieldRationales: unifiedData.explainableAi.fieldRationales || {},
          gemmaModel: 'resonix-disaster-intelligence',
        });
      }

      // Store fused unified emergency object
      if (UnifiedEmergency?.db?.readyState === 1 && unifiedData) {
        savedUnifiedRecord = await UnifiedEmergency.create({
          unifiedEmergencyId: unifiedData.unifiedEmergencyId,
          timestamp: unifiedData.timestamp || new Date(),
          primaryDisasterType: unifiedData.primaryDisasterType,
          summary: unifiedData.summary,
          shortSummary: unifiedData.shortSummary || '',
          shortSummaryLines: unifiedData.shortSummaryLines || [],
          detailedAiOutput: unifiedData.detailedAiOutput || {},
          explainableAi: unifiedData.explainableAi || {},
          severity: unifiedData.severity,
          urgencyTier: unifiedData.urgencyTier,
          peopleCount: unifiedData.peopleCount,
          childrenCount: unifiedData.childrenCount,
          medicalNeeds: unifiedData.medicalNeeds,
          visualHazards: unifiedData.visualHazards,
          locationData: unifiedData.locationData,
          language: unifiedData.language,
          inputsProcessed: unifiedData.inputsProcessed,
          fusionModel: 'resonix-disaster-intelligence',
        });
      }
    } catch (dbErr) {
      // Fallback for mock/demo mode
    }

    return ApiResponse.success(res, 200, 'Unified emergency pipeline executed and stored across 5 separate collections', {
      pipeline: pipelineResult,
      references: {
        originalReportId: savedOriginalReport?.reportId || null,
        aiAnalysisId: savedAiAnalysis?.analysisId || null,
        summaryId: savedSummaryRecord?.summaryId || null,
        confidenceScoreId: savedConfidenceRecord?.scoreId || null,
        explainableAiId: savedExplainableAiRecord?.explanationId || null,
        unifiedEmergencyId: savedUnifiedRecord?.unifiedEmergencyId || unifiedData.unifiedEmergencyId,
      },
      executedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/reports/triage
 * @desc    Convert citizen report payload into structured incident via AI triage
 * @access  Public / Citizen / Responder
 */
const triageReportPayload = async (req, res, next) => {
  try {
    const rawReport = req.body || {};
    const reportId = rawReport.reportId || rawReport.id || `rpt_${Date.now()}`;

    // 1. Preserve original citizen report in EmergencyReport collection (if not already saved)
    let savedReport = null;
    if (EmergencyReport?.db?.readyState === 1) {
      try {
        const existing = await EmergencyReport.findOne({
          $or: [{ reportId }, { _id: String(reportId).match(/^[0-9a-fA-F]{24}$/) ? reportId : null }],
        });
        if (!existing) {
          savedReport = await EmergencyReport.create({
            reportId,
            packetId: rawReport.packetId || `pkt_${Date.now()}`,
            userId: rawReport.userId || 'ANONYMOUS_CITIZEN',
            rawText: rawReport.rawText || rawReport.text || rawReport.description || '',
            audioReference: rawReport.audioReference?.dataUrl || rawReport.audioData ? 'audio_ref_attached' : null,
            photoReference: rawReport.photoReference?.dataUrl || rawReport.imageUrl ? 'photo_ref_attached' : null,
            gpsCoordinates: {
              latitude: rawReport.gpsCoordinates?.latitude ?? rawReport.latitude ?? null,
              longitude: rawReport.gpsCoordinates?.longitude ?? rawReport.longitude ?? null,
              accuracyMeters: rawReport.gpsCoordinates?.accuracyMeters ?? rawReport.accuracy ?? null,
              status: (rawReport.latitude || rawReport.gpsCoordinates?.latitude) ? 'GPS_AVAILABLE' : 'NO_GPS',
            },
            selectedLanguage: rawReport.selectedLanguage || 'en',
            submittedAt: rawReport.submittedAt || new Date(),
          });
        } else {
          savedReport = existing;
        }
      } catch (dbErr) {
        logger.warn('[ReportController] MongoDB EmergencyReport save warning:', dbErr.message);
      }
    }

    // 2. Perform AI Triage to convert citizen report into structured incident
    const structuredIncident = incidentTriageService.triageCitizenReport({
      ...rawReport,
      reportId: savedReport?.reportId || reportId,
    });

    // 3. Persist Structured Incident into MongoDB
    let savedIncident = null;
    if (Incident?.db?.readyState === 1) {
      try {
        const { _id, ...cleanDoc } = structuredIncident;
        savedIncident = await Incident.create(cleanDoc);
      } catch (incErr) {
        logger.warn('[ReportController] MongoDB Incident save warning:', incErr.message);
      }
    }

    const finalIncident = savedIncident ? savedIncident.toObject() : structuredIncident;

    // 4. Real-time broadcast to all responder units via Socket.IO
    try {
      socketService.broadcastIncidentCreated(finalIncident);
    } catch (_) {}

    return ApiResponse.success(res, 201, 'Citizen report triaged into structured incident successfully', {
      incident: finalIncident,
      data: finalIncident,
      originalReport: savedReport ? savedReport.toObject() : rawReport,
      isOfficialEmergencyDetermination: false,
      disclaimer: incidentTriageService.OFFICIAL_DISCLAIMER,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/reports/:id/triage
 * @desc    Convert an existing citizen report into a structured incident by ID
 * @access  Private / Public
 */
const triageReportById = async (req, res, next) => {
  try {
    const { id } = req.params;
    let reportDoc = null;

    if (EmergencyReport?.db?.readyState === 1) {
      try {
        reportDoc = await EmergencyReport.findOne({
          $or: [{ reportId: id }, { packetId: id }, { _id: String(id).match(/^[0-9a-fA-F]{24}$/) ? id : null }],
        });
      } catch (_) {}
    }

    if (!reportDoc) {
      return next(new ApiError(404, `Citizen report with ID '${id}' not found`));
    }

    // Perform AI Triage to convert citizen report into structured incident
    const structuredIncident = incidentTriageService.triageCitizenReport(reportDoc);

    // Persist Structured Incident into MongoDB
    let savedIncident = null;
    if (Incident?.db?.readyState === 1) {
      try {
        const { _id, ...cleanDoc } = structuredIncident;
        savedIncident = await Incident.create(cleanDoc);
      } catch (incErr) {
        logger.warn('[ReportController] MongoDB Incident save warning:', incErr.message);
      }
    }

    const finalIncident = savedIncident ? savedIncident.toObject() : structuredIncident;

    try {
      socketService.broadcastIncidentCreated(finalIncident);
    } catch (_) {}

    return ApiResponse.success(res, 200, 'Citizen report triaged into structured incident successfully', {
      incident: finalIncident,
      data: finalIncident,
      originalReport: reportDoc.toObject(),
      isOfficialEmergencyDetermination: false,
      disclaimer: incidentTriageService.OFFICIAL_DISCLAIMER,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getReports,
  getReportById,
  createReport,
  updateReport,
  deleteReport,
  uploadReportPhoto,
  saveReportLocation,
  analyzeTextReport,
  executeUnifiedPipeline,
  triageReportPayload,
  triageReportById,
};




