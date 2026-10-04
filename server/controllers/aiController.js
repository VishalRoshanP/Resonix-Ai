const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const gemmaConfig = require('../config/gemma');
const gemmaService = require('../services/gemma');
const reportPipeline = require('../pipeline/reportPipeline');

const UnifiedEmergency = require('../models/UnifiedEmergency');
const EmergencyReport = require('../models/EmergencyReport');
const AiAnalysis = require('../models/AiAnalysis');
const EmergencySummaryRecord = require('../models/EmergencySummaryRecord');
const ConfidenceScoreRecord = require('../models/ConfidenceScoreRecord');
const ExplainableAiRecord = require('../models/ExplainableAiRecord');

/**
 * @route   POST /api/ai/analyze
 * @desc    Execute multi-input Gemma 4 emergency intelligence analysis
 * @access  Public / Citizen / Responder
 */
const analyzeEmergency = async (req, res, next) => {
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

    const reportId = `rpt_${Date.now()}`;
    const packetId = `pkt_${Date.now()}`;
    const unifiedEmergencyId = unifiedData.unifiedEmergencyId;

    try {
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
        });
      }

      if (AiAnalysis?.db?.readyState === 1 && unifiedData.detailedAiOutput) {
        savedAiAnalysis = await AiAnalysis.create({
          analysisId: `anl_${Date.now()}`,
          reportId,
          packetId,
          unifiedEmergencyId,
          voiceAnalysis: unifiedData.detailedAiOutput.voiceUnderstanding || null,
          imageAnalysis: unifiedData.detailedAiOutput.imageUnderstanding || null,
          textAnalysis: unifiedData.detailedAiOutput.textUnderstanding || null,
          gemmaModel: gemmaConfig.gemmaModel || 'resonix-disaster-intelligence',
        });
      }

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
          gemmaModel: gemmaConfig.gemmaModel || 'resonix-disaster-intelligence',
        });
      }

      if (UnifiedEmergency?.db?.readyState === 1) {
        savedUnifiedRecord = await UnifiedEmergency.create({
          unifiedEmergencyId,
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
          fusionModel: gemmaConfig.gemmaModel || 'resonix-disaster-intelligence',
        });
      }
    } catch (_) {}

    return ApiResponse.success(res, 200, 'Emergency intelligence analysis completed', {
      id: unifiedEmergencyId,
      reportId,
      analysis: unifiedData,
      references: {
        originalReportId: savedOriginalReport?.reportId || reportId,
        aiAnalysisId: savedAiAnalysis?.analysisId || null,
        summaryId: savedSummaryRecord?.summaryId || null,
        confidenceScoreId: savedConfidenceRecord?.scoreId || null,
        explainableAiId: savedExplainableAiRecord?.explanationId || null,
        unifiedEmergencyId,
      },
      analyzedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/ai/report/:id
 * @desc    Get full emergency intelligence bundle (Original, AI Analysis, Summary, Scores, XAI)
 * @access  Public / Responder / Command Center
 */
const getReportIntelligence = async (req, res, next) => {
  try {
    const { id } = req.params;

    let unifiedRecord = null;
    let originalReport = null;
    let summaryRecord = null;
    let explainableRecord = null;

    try {
      if (UnifiedEmergency?.db?.readyState === 1) {
        unifiedRecord = await UnifiedEmergency.findOne({
          $or: [{ unifiedEmergencyId: id }, { _id: id }],
        });
      }
      if (EmergencyReport?.db?.readyState === 1) {
        originalReport = await EmergencyReport.findOne({
          $or: [{ reportId: id }, { packetId: id }],
        });
      }
      if (EmergencySummaryRecord?.db?.readyState === 1) {
        summaryRecord = await EmergencySummaryRecord.findOne({
          $or: [{ unifiedEmergencyId: id }, { reportId: id }],
        });
      }
      if (ExplainableAiRecord?.db?.readyState === 1) {
        explainableRecord = await ExplainableAiRecord.findOne({
          $or: [{ unifiedEmergencyId: id }, { reportId: id }],
        });
      }
    } catch (_) {}

    if (!unifiedRecord && !originalReport && !summaryRecord && !explainableRecord) {
      return next(new ApiError(404, `Emergency report intelligence not found for ID '${id}'`));
    }

    const reportBundle = {
      id,
      primaryDisaster: unifiedRecord?.primaryDisasterType?.value || 'GENERAL',
      urgencyTier: unifiedRecord?.urgencyTier?.value || null,
      severity: unifiedRecord?.severity?.value || null,
      originalSubmission: originalReport || null,
      shortSummary: summaryRecord?.shortSummary || unifiedRecord?.shortSummary || null,
      shortSummaryLines: summaryRecord?.shortSummaryLines || unifiedRecord?.shortSummaryLines || [],
      explainableAi: explainableRecord || unifiedRecord?.explainableAi || null,
      detailedAiOutput: unifiedRecord?.detailedAiOutput || null,
      fetchedAt: new Date().toISOString(),
    };

    return ApiResponse.success(res, 200, 'Emergency report intelligence retrieved successfully', reportBundle);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/ai/summary/:id
 * @desc    Get responder short summary bullet lines for a specific report/emergency
 * @access  Public / Responder / Command Center
 */
const getReportSummary = async (req, res, next) => {
  try {
    const { id } = req.params;

    let summaryRecord = null;
    let unifiedRecord = null;

    try {
      if (EmergencySummaryRecord?.db?.readyState === 1) {
        summaryRecord = await EmergencySummaryRecord.findOne({
          $or: [{ unifiedEmergencyId: id }, { reportId: id }, { summaryId: id }],
        });
      }
      if (UnifiedEmergency?.db?.readyState === 1 && !summaryRecord) {
        unifiedRecord = await UnifiedEmergency.findOne({
          $or: [{ unifiedEmergencyId: id }, { _id: id }],
        });
      }
    } catch (_) {}

    if (!summaryRecord && !unifiedRecord?.shortSummary) {
      return next(new ApiError(404, `Emergency short summary for '${id}' not found`));
    }

    const shortSummary = summaryRecord?.shortSummary || unifiedRecord?.shortSummary || null;
    const shortSummaryLines = summaryRecord?.shortSummaryLines || unifiedRecord?.shortSummaryLines || [];

    return ApiResponse.success(res, 200, 'Emergency short summary retrieved successfully', {
      id,
      shortSummary,
      shortSummaryLines,
      retrievedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/ai/explanation/:id
 * @desc    Get Explainable AI decision rationales for a specific report/emergency
 * @access  Public / Responder / Command Center
 */
const getReportExplanation = async (req, res, next) => {
  try {
    const { id } = req.params;

    let explainableRecord = null;
    let unifiedRecord = null;

    try {
      if (ExplainableAiRecord?.db?.readyState === 1) {
        explainableRecord = await ExplainableAiRecord.findOne({
          $or: [{ unifiedEmergencyId: id }, { reportId: id }, { explanationId: id }],
        });
      }
      if (UnifiedEmergency?.db?.readyState === 1 && !explainableRecord) {
        unifiedRecord = await UnifiedEmergency.findOne({
          $or: [{ unifiedEmergencyId: id }, { _id: id }],
        });
      }
    } catch (_) {}

    if (!explainableRecord && !unifiedRecord?.explainableAi) {
      return next(new ApiError(404, `Explainable AI decision rationales for '${id}' not found`));
    }

    const explainableAi = explainableRecord || unifiedRecord?.explainableAi || null;

    return ApiResponse.success(res, 200, 'Explainable AI decision rationales retrieved successfully', {
      id,
      explainableAi,
      retrievedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/ai/gemma-language
 * @desc    Language Intelligence Phase 2 - Analyzes Speech-to-Text transcript
 * @access  Public / Citizen / Responder
 */
const processGemmaLanguageIntelligence = async (req, res, next) => {
  try {
    const { transcript = '' } = req.body || {};
    const gemmaLanguageIntelligence = require('../services/gemma/gemmaLanguageIntelligence');

    const result = await gemmaLanguageIntelligence.processLanguageIntelligence({ transcript });

    return ApiResponse.success(res, 200, 'Language Intelligence analysis completed', {
      success: true,
      data: result,
      result,
      gemmaModel: gemmaConfig.gemmaModel || 'resonix-disaster-intelligence',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/ai/transcribe
 * @route   POST /api/v1/ai/transcribe
 * @desc    Speech-to-Text ASR endpoint for emergency audio recordings (English, Hindi, Tamil, Kannada)
 * @access  Public / Citizen / Responder
 */
const transcribeAudio = async (req, res, next) => {
  try {
    const { audioData, dataUrl, mimeType = 'audio/webm', durationSeconds = 0, transcript = '', languageHint = 'en' } = req.body || {};
    const asrService = require('../services/speech/asrService');

    const result = await asrService.transcribeAudio({
      audioData: audioData || dataUrl || null,
      mimeType,
      durationSeconds: parseFloat(durationSeconds) || 0,
      transcript,
      languageHint,
    });

    return ApiResponse.success(res, 200, 'Speech-to-Text processing completed', {
      success: result.success,
      transcript: result.transcript,
      rawTranscript: result.rawTranscript,
      language: result.language,
      confidence: result.confidence,
      isUncertain: result.isUncertain,
      transcriptionStatus: result.transcriptionStatus,
      asrEngine: result.asrEngine,
      latencyMs: result.latencyMs,
      audioQuality: result.audioQuality,
      failureReason: result.failureReason,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  analyzeEmergency,
  getReportIntelligence,
  getReportSummary,
  getReportExplanation,
  processGemmaLanguageIntelligence,
  transcribeAudio,
};
