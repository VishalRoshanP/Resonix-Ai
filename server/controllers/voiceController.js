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

    let resolvedTranscript = (transcript || '').trim();
    let asrMeta = null;

    // Transcribe audio using ASR if audio data is present
    if (audioData) {
      try {
        const asrService = require('../services/speech/asrService');
        const asrResult = await asrService.transcribeAudio({
          audioData,
          mimeType,
          transcript: resolvedTranscript,
          languageHint: context?.language || 'en',
        });
        if (asrResult.success && asrResult.transcript) {
          resolvedTranscript = asrResult.transcript;
        }
        asrMeta = asrResult;
      } catch (asrErr) {
        logger.warn('[VoiceController] ASR transcription error:', asrErr.message);
      }
    }

    // Call Gemma 4 voice service interface
    const analysisResult = await gemmaService.analyzeVoice({
      audioData: audioData || null,
      mimeType,
      transcript: resolvedTranscript,
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
          gemmaModel: gemmaConfig.gemmaModel || 'resonix-disaster-intelligence',
        });
      }
    } catch (dbErr) {
      logger.warn('[VoiceController] VoiceUnderstanding DB save fallback active:', dbErr.message);
    }

    return ApiResponse.success(res, 200, 'Voice audio analyzed and AI record saved separately', {
      audioId,
      mimeType,
      status: 'PROCESSED_BY_AI',
      analysis: analysisResult,
      aiRecordId: savedAiRecord?._id || null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[VoiceController] Error processing voice audio:', error.message);
    next(error);
  }
};

/**
 * @route   POST /api/voice/live-transcribe
 * @desc    Real-time interim transcription preview via GEMINI_TRANSCRIBE_LIVE_MODEL
 *          NOTE: Strictly non-authoritative preview. Recorded SOS audio remains source of truth.
 * @access  Public / Citizen
 */
const handleLiveTranscribe = async (req, res, next) => {
  try {
    const aiCapabilityRouter = require('../services/pipeline/aiCapabilityRouter');
    const aiModelConfig = require('../config/aiModels');
    const { audioData, chunk, mimeType = 'audio/webm', sessionState = {} } = req.body || {};

    const result = await aiCapabilityRouter.routeRequest({
      capability: aiModelConfig.capabilities.LIVE_TRANSCRIPTION,
      payload: {
        audioData: audioData || chunk,
        mimeType,
        sessionState,
      },
    });

    return ApiResponse.success(res, 200, 'Live interim transcription preview generated', {
      success: result.success,
      isInterim: true,
      authoritative: false,
      sourceOfTruth: 'RECORDED_SOS_AUDIO',
      transcript: result.transcript || '',
      model: result.model || aiModelConfig.liveTranscription.model,
      note: 'Live interim preview only. Emergency classification uses authoritative recorded SOS audio.',
      fallbackAvailable: result.fallbackAvailable || false,
    });
  } catch (error) {
    logger.warn('[VoiceController] Live transcribe error:', error.message);
    return ApiResponse.success(res, 200, 'Live transcribe unavailable; fallback active', {
      success: false,
      isInterim: true,
      authoritative: false,
      transcript: '',
      error: error.message,
      sourceOfTruth: 'RECORDED_SOS_AUDIO',
      fallbackAvailable: true,
    });
  }
};

/**
 * @route   POST /api/voice/live-conversation
 * @desc    Optional real-time voice conversation turn via GEMINI_LIVE_MODEL
 *          NOTE: Decoupled from SOS creation and emergency classification.
 * @access  Public / Citizen
 */
const handleLiveVoiceConversation = async (req, res, next) => {
  try {
    const aiCapabilityRouter = require('../services/pipeline/aiCapabilityRouter');
    const aiModelConfig = require('../config/aiModels');
    const { text, prompt, audioData, sessionState = {} } = req.body || {};

    const userPrompt = text || prompt || '';
    if (!userPrompt && !audioData) {
      return ApiResponse.error(res, 400, 'Either text or audioData is required for live voice conversation.');
    }

    const result = await aiCapabilityRouter.routeRequest({
      capability: aiModelConfig.capabilities.LIVE_VOICE,
      payload: {
        text: userPrompt,
        audioData,
        sessionState,
      },
    });

    return ApiResponse.success(res, 200, 'Live voice conversation turn processed', {
      success: result.success,
      capability: 'live_voice',
      model: result.model || aiModelConfig.liveVoice.model,
      response: result.response || '',
      classificationDecoupled: true,
      sessionState: result.sessionState || sessionState,
    });
  } catch (error) {
    logger.warn('[VoiceController] Live voice error:', error.message);
    return ApiResponse.error(res, 500, `Live conversation error: ${error.message}`);
  }
};

/**
 * @route   POST /api/voice/synthesize
 * @desc    AI-generated spoken responses via GEMINI_TTS_MODEL
 *          NOTE: Selective / on-demand voice synthesis only. Never automatically speaks every notification.
 * @access  Public / Citizen / Responder
 */
const handleSynthesizeSpeech = async (req, res, next) => {
  try {
    const aiCapabilityRouter = require('../services/pipeline/aiCapabilityRouter');
    const aiModelConfig = require('../config/aiModels');
    const { text, message, voice = 'Puck', language = 'en' } = req.body || {};

    const textToSynthesize = text || message || '';
    if (!textToSynthesize.trim()) {
      return ApiResponse.error(res, 400, 'Text parameter is required for voice synthesis.');
    }

    let result = null;
    try {
      result = await aiCapabilityRouter.routeRequest({
        capability: aiModelConfig.capabilities.VOICE_RESPONSE,
        payload: {
          text: textToSynthesize,
          voice,
          language,
        },
      });
    } catch (routeErr) {
      logger.warn('[VoiceController] AI router synthesize note:', routeErr.message);
      result = { success: false, error: routeErr.message };
    }

    const hasAudio = Boolean(result && result.success && result.audioData);

    return ApiResponse.success(res, 200, hasAudio ? 'Voice speech synthesized successfully' : 'Speech synthesis fallback to client', {
      success: hasAudio,
      capability: 'voice_response',
      model: result?.model || aiModelConfig.tts.model,
      audioData: result?.audioData || null,
      mimeType: result?.mimeType || 'audio/wav',
      text: textToSynthesize,
      voice,
      fallbackToClient: !hasAudio,
      error: !hasAudio ? (result?.error || 'TTS audio synthesis unavailable') : null,
    });
  } catch (error) {
    logger.warn('[VoiceController] Voice synthesize error:', error.message);
    return ApiResponse.success(res, 200, 'Speech synthesis error. Falling back to browser synthesis.', {
      success: false,
      capability: 'voice_response',
      audioData: null,
      fallbackToClient: true,
      error: error.message,
    });
  }
};

/**
 * @route   POST /api/voice/live-translate
 * @desc    Real-time multilingual conversation translation via GEMINI_TRANSLATE_LIVE_MODEL
 *          NOTE: For live conversation (e.g. Tamil -> English). Does NOT alter recorded SOS pipeline.
 * @access  Public / Citizen / Responder
 */
const handleLiveTranslate = async (req, res, next) => {
  try {
    const aiCapabilityRouter = require('../services/pipeline/aiCapabilityRouter');
    const aiModelConfig = require('../config/aiModels');
    const { audioData, transcript, text, sourceLanguage = 'auto', targetLanguage = 'English' } = req.body || {};

    const contentToTranslate = transcript || text || '';
    if (!contentToTranslate && !audioData) {
      return ApiResponse.error(res, 400, 'Transcript or audioData is required for live translation.');
    }

    const result = await aiCapabilityRouter.routeRequest({
      capability: aiModelConfig.capabilities.LIVE_TRANSLATION,
      payload: {
        audioData,
        transcript: contentToTranslate,
        sourceLanguage,
        targetLanguage,
      },
    });

    return ApiResponse.success(res, 200, 'Live multilingual translation completed', {
      success: result.success,
      capability: 'live_translation',
      model: result.model || aiModelConfig.liveTranslation.model,
      translatedText: result.translatedText || '',
      sourceLanguage,
      targetLanguage,
      authoritativePipelineIntact: true,
    });
  } catch (error) {
    logger.warn('[VoiceController] Live translate error:', error.message);
    return ApiResponse.error(res, 500, `Live translation error: ${error.message}`);
  }
};

module.exports = {
  processVoiceAudio,
  handleLiveTranscribe,
  handleLiveVoiceConversation,
  handleSynthesizeSpeech,
  handleLiveTranslate,
};
