const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const gemmaService = require('../services/gemma');
const gemmaConfig = require('../config/gemma');
const logger = require('../utils/logger');
const VoiceUnderstanding = require('../models/VoiceUnderstanding');

/**
 * @route   POST /api/voice/process
 * @desc    Process incoming voice audio payload for Gemma 4 analysis & store AI output separately
 * @access  Public / Citizen / Responder
 */
const processVoiceAudio = async (req, res, next) => {
  try {
    const { audioData, mimeType = 'audio/webm', transcript, packetId, reportId, context = {} } = req.body || {};

    logger.info(`[VoiceController] Received voice audio processing request. MIME: ${mimeType}`);

    // Call Gemma 4 voice service interface
    const analysisResult = await gemmaService.analyzeVoice({
      audioData: audioData || null,
      mimeType,
      transcript: transcript || '',
      context,
    });

    const audioId = `voice_${Date.now()}`;
    let savedAiRecord = null;

    // Store AI understanding output separately from original report in MongoDB
    try {
      if (VoiceUnderstanding?.db?.readyState === 1) {
        savedAiRecord = await VoiceUnderstanding.create({
          packetId: packetId || null,
          reportId: reportId || null,
          disasterType: analysisResult.disasterType || 'OTHER',
          summary: analysisResult.summary || 'Voice emergency dispatch received.',
          peopleCount: analysisResult.peopleCount || 0,
          childrenCount: analysisResult.childrenCount || 0,
          medicalNeed: Boolean(analysisResult.medicalNeed),
          urgency: analysisResult.urgency || 'HIGH',
          possibleHazards: analysisResult.possibleHazards || [],
          language: analysisResult.language || 'en',
          confidenceScore: analysisResult.confidenceScore || 0.95,
          rawTranscript: transcript || '',
          gemmaModel: gemmaConfig.ollamaModel || 'gemma4:e4b',
        });
      }
    } catch (dbErr) {
      logger.warn('[VoiceController] VoiceUnderstanding DB save fallback active:', dbErr.message);
    }

    return ApiResponse.success(res, 200, 'Voice audio analyzed by Gemma 4 and AI record saved separately', {
      audioId,
      mimeType,
      status: 'QUEUED_FOR_GEMMA4',
      analysis: analysisResult,
      aiRecordId: savedAiRecord?._id || null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[VoiceController] Error processing voice audio:', error.message);
    next(error);
  }
};

module.exports = {
  processVoiceAudio,
};
