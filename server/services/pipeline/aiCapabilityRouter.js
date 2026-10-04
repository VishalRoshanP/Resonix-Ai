/**
 * AI Capability Router for RESONIX AI
 * 
 * Strict Architecture Rules:
 * 1. ZERO-OVERHEAD FOR RECORDED SOS:
 *    - Standard recorded emergency audio strictly invokes:
 *      Gemini 3.5 Transcribe -> Pinecone RAG -> Gemini 3.8 Flash (Primary) -> (Conditional) Gemma 4 Verification
 *    - NEVER invokes Live Voice, TTS, or Live Translate for recorded SOS.
 * 2. CONDITIONAL ESCALATION:
 *    - Gemma 4 (gemma-4-31b-it / gemma-4-26b-a4b-it) is triggered ONLY upon deterministic escalation conditions:
 *      low confidence (<0.70), contradiction with Indic semantic baseline, incomplete transcript, or ambiguous evidence.
 * 3. SPECIALIZED MODEL DISPATCH:
 *    - Live Transcription: gemini-3.5-transcribe-live (Streaming STT only when requested)
 *    - Live Voice: gemini-3.1-flash-live-preview (Bidirectional conversational voice only when requested)
 *    - Live Translation: gemini-3.5-live-translate-preview (Real-time multilingual voice translation only when requested)
 *    - Voice Response: gemini-3.1-flash-tts-preview (Spoken TTS audio only when requested)
 * 4. FAILURE ISOLATION & RESILIENCE:
 *    - Every optional capability fails gracefully without halting core emergency operations.
 * 5. OBSERVABILITY:
 *    - Tracks internal telemetry (model, latencies, escalation reasons, confidence).
 *    - Never leaks API credentials or technical internals to client/citizen.
 */

const aiModelConfig = require('../../config/aiModels');
const googleAiClient = require('../gemma/googleAiClient');
const semanticEmergencyInterpreter = require('../speech/semanticEmergencyInterpreter');
const asrService = require('../speech/asrService');
const logger = require('../../utils/logger');

class AiCapabilityRouter {
  constructor() {
    this.config = aiModelConfig;
    this.executionLogs = [];
    this.maxLogs = 200;
  }

  /**
   * Main Dispatch Router
   * Routes incoming request to the specialized model pipeline based on requested capability.
   * 
   * @param {Object} params
   * @param {string} [params.capability] - One of 'recorded_sos', 'live_transcription', 'live_voice', 'live_translation', 'voice_response'
   * @param {Object} [params.payload] - Payload specific to the capability
   * @param {Object} [params.options] - Execution options (timeouts, model overrides, etc.)
   * @returns {Promise<Object>} Capability execution result
   */
  async routeRequest({ capability = aiModelConfig.capabilities.RECORDED_SOS, payload = {}, options = {} } = {}) {
    const selectedCapability = capability || aiModelConfig.capabilities.RECORDED_SOS;
    const startTime = Date.now();

    logger.info(`[AiCapabilityRouter] Routing request for capability: '${selectedCapability}'`);

    switch (selectedCapability) {
      case aiModelConfig.capabilities.RECORDED_SOS:
      case 'recorded_sos':
        return await this.processRecordedSos(payload, options, startTime);

      case aiModelConfig.capabilities.LIVE_TRANSCRIPTION:
      case 'live_transcription':
        return await this.processLiveTranscription(payload, options, startTime);

      case aiModelConfig.capabilities.LIVE_VOICE:
      case 'live_voice':
        return await this.processLiveVoice(payload, options, startTime);

      case aiModelConfig.capabilities.LIVE_TRANSLATION:
      case 'live_translation':
        return await this.processLiveTranslation(payload, options, startTime);

      case aiModelConfig.capabilities.VOICE_RESPONSE:
      case 'voice_response':
        return await this.processVoiceResponse(payload, options, startTime);

      default:
        logger.warn(`[AiCapabilityRouter] Unknown capability '${selectedCapability}'. Defaulting to 'recorded_sos'.`);
        return await this.processRecordedSos(payload, options, startTime);
    }
  }

  /**
   * Primary Emergency Intelligence Pipeline: Recorded SOS
   * 
   * Pipeline Flow:
   * AUDIO -> Gemini 3.5 Transcribe -> Faithful Transcript -> Pinecone RAG -> Gemini 3.8 Flash
   * -> Structured Classification -> Validation -> (Conditional) Gemma 4 Verification -> MongoDB/Socket.IO
   * 
   * Guarantees:
   * - Does NOT call Gemini 3.1 Flash Live, TTS, or Live Translate.
   * - Never blocks initial SOS submission.
   */
  async processRecordedSos(payload = {}, options = {}, routeStartTime = Date.now()) {
    const startTime = Date.now();
    let transcriptionResult = null;
    let transcriptionLatencyMs = 0;
    let transcriptToAnalyze = (
      payload.transcript ||
      payload.originalTranscript ||
      payload.voiceTranscript ||
      payload.speechRecognitionTranscript ||
      payload.description ||
      payload.text ||
      ''
    ).trim();

    const hasAudio = Boolean(payload.audioData || payload.dataUrl || payload.buffer || payload.audioReference?.hasAudio);

    // 1. Authoritative Transcription via Gemini 3.5 Transcribe if audio is present
    if (hasAudio) {
      try {
        const asrStart = Date.now();
        transcriptionResult = await asrService.transcribeAudio({
          audioData: payload.audioData || payload.dataUrl || payload.buffer,
          mimeType: payload.mimeType || payload.audioReference?.mimeType || 'audio/webm',
          durationSeconds: payload.recordingDuration || payload.durationSeconds || 0,
          transcript: transcriptToAnalyze,
          languageHint: payload.selectedVoiceLanguageCode || payload.languageHint || null,
        });
        transcriptionLatencyMs = Date.now() - asrStart;

        if (transcriptionResult && transcriptionResult.success && transcriptionResult.transcript) {
          transcriptToAnalyze = transcriptionResult.transcript;
        }
      } catch (asrErr) {
        logger.warn(`[AiCapabilityRouter] Authoritative transcription fallback notice: ${asrErr.message}`);
      }
    }

    // 2. Semantic Classification via Gemini 3.8 Flash + Pinecone + Conditional Gemma 4
    const interpretationParams = {
      ...payload,
      transcript: transcriptToAnalyze,
      originalTranscript: transcriptToAnalyze,
      detectedLanguage: transcriptionResult?.detectedLanguage || transcriptionResult?.language || payload.detectedLanguage,
      detectedLanguageCode: transcriptionResult?.detectedLanguageCode || transcriptionResult?.languageCode || payload.detectedLanguageCode,
      nativeScriptTranscript: transcriptionResult?.nativeScriptTranscript || payload.nativeScriptTranscript,
      englishTranslation: transcriptionResult?.englishTranslation || payload.englishTranslation,
      normalizedMeaning: transcriptionResult?.normalizedMeaning || payload.normalizedMeaning,
      script: transcriptionResult?.script || payload.script,
      transcriptForm: transcriptionResult?.transcriptForm || payload.transcriptForm,
      isCodeMixed: transcriptionResult?.isCodeMixed !== undefined ? transcriptionResult.isCodeMixed : payload.isCodeMixed,
      secondaryLanguage: transcriptionResult?.secondaryLanguage || payload.secondaryLanguage,
      transcriptionSource: transcriptionResult?.transcriptionSource || transcriptionResult?.asrEngine || payload.transcriptionSource,
      translationSource: transcriptionResult?.translationSource || payload.translationSource,
      multiModelAgreement: transcriptionResult?.multiModelAgreement || payload.multiModelAgreement,
      sarvamFallbackTriggered: Boolean(transcriptionResult?.sarvamFallbackTriggered || payload.sarvamFallbackTriggered),
      needsReview: transcriptionResult?.needsReview !== undefined ? transcriptionResult.needsReview : payload.needsReview,
      sttTelemetry: transcriptionResult?.sttTelemetry || null,
    };

    const semanticResult = await semanticEmergencyInterpreter.analyzeEmergency(interpretationParams, options);

    const totalLatencyMs = Date.now() - startTime;

    // Observability telemetry record (internal only)
    const telemetry = {
      capability: aiModelConfig.capabilities.RECORDED_SOS,
      timestamp: new Date().toISOString(),
      modelsInvoked: {
        transcription: hasAudio ? (transcriptionResult?.asrEngine || aiModelConfig.recordedTranscription.model) : 'NONE_TEXT_INPUT',
        sarvamInvoked: Boolean(transcriptionResult?.sarvamFallbackTriggered || transcriptionResult?.sttTelemetry?.sarvamCalled),
        multiModelAgreement: transcriptionResult?.multiModelAgreement || null,
        primaryReasoning: semanticResult.primaryModel || aiModelConfig.primaryReasoning.model,
        ragRetrieval: 'PINECONE_VECTOR_SEARCH',
        secondaryVerification: semanticResult.source === 'GEMMA_4_VERIFIED' ? (options.verifierModel || aiModelConfig.secondaryVerification.model) : 'SKIPPED_FAST_PATH',
        liveVoice: 'NOT_INVOKED',
        tts: 'NOT_INVOKED',
        liveTranslate: 'NOT_INVOKED',
      },
      latencies: {
        transcriptionMs: transcriptionLatencyMs,
        pineconeRetrievalMs: semanticResult.retrievalLatencyMs || 0,
        primaryClassificationMs: semanticResult.geminiLatencyMs || 0,
        secondaryVerificationMs: semanticResult.gemmaLatencyMs || 0,
        totalMs: totalLatencyMs,
      },
      ragContextRetrieved: Boolean(semanticResult.ragContextRetrieved),
      ragChunksCount: semanticResult.ragChunksCount || 0,
      escalationOccurred: semanticResult.source === 'GEMMA_4_VERIFIED',
      finalCategory: semanticResult.category || semanticResult.detectedCategory,
      finalConfidence: semanticResult.confidence,
      categoryConflict: Boolean(semanticResult.categoryConflict),
      needsReview: Boolean(semanticResult.needsReview),
    };

    this._recordTelemetry(telemetry);

    return {
      success: true,
      capability: aiModelConfig.capabilities.RECORDED_SOS,
      ...semanticResult,
      // Pass transcription details if available
      ...(transcriptionResult ? {
        transcription: {
          transcript: transcriptionResult.transcript,
          language: transcriptionResult.language,
          languageCode: transcriptionResult.languageCode,
          nativeScriptTranscript: transcriptionResult.nativeScriptTranscript,
          confidence: transcriptionResult.confidence,
          asrEngine: transcriptionResult.asrEngine,
          transcriptionSource: transcriptionResult.transcriptionSource,
          multiModelAgreement: transcriptionResult.multiModelAgreement,
          sarvamFallbackTriggered: transcriptionResult.sarvamFallbackTriggered,
        }
      } : {}),
      telemetry: {
        latencyMs: totalLatencyMs,
        modelsUsed: [
          ...(hasAudio ? [aiModelConfig.recordedTranscription.model] : []),
          semanticResult.primaryModel || aiModelConfig.primaryReasoning.model,
          ...(semanticResult.source === 'GEMMA_4_VERIFIED' ? [aiModelConfig.secondaryVerification.model] : []),
        ],
        verificationTriggered: semanticResult.source === 'GEMMA_4_VERIFIED',
      },
    };
  }

  /**
   * Optional Real-Time Streaming Transcription via Gemini 3.5 Transcribe Live
   */
  async processLiveTranscription(payload = {}, options = {}, routeStartTime = Date.now()) {
    const startTime = Date.now();
    try {
      const result = await googleAiClient.transcribeLiveStream({
        audioData: payload.audioData || payload.chunk,
        mimeType: payload.mimeType || 'audio/webm',
        sessionState: payload.sessionState || {},
      }, options);

      const latencyMs = Date.now() - startTime;
      this._recordTelemetry({
        capability: aiModelConfig.capabilities.LIVE_TRANSCRIPTION,
        model: result.model || aiModelConfig.liveTranscription.model,
        latencyMs,
        success: result.success,
      });

      return result;
    } catch (err) {
      logger.warn(`[AiCapabilityRouter] Live transcription error: ${err.message}`);
      return {
        success: false,
        capability: aiModelConfig.capabilities.LIVE_TRANSCRIPTION,
        model: aiModelConfig.liveTranscription.model,
        error: err.message,
        fallbackAvailable: true,
        recordedTranscriptionPath: 'AVAILABLE',
      };
    }
  }

  /**
   * Optional Real-Time Bidirectional Voice Interaction via Gemini 3.1 Flash Live
   */
  async processLiveVoice(payload = {}, options = {}, routeStartTime = Date.now()) {
    const startTime = Date.now();
    try {
      const result = await googleAiClient.liveVoiceTurn({
        audioData: payload.audioData || null,
        text: payload.text || payload.prompt || '',
        sessionState: payload.sessionState || {},
      }, options);

      const latencyMs = Date.now() - startTime;
      this._recordTelemetry({
        capability: aiModelConfig.capabilities.LIVE_VOICE,
        model: result.model || aiModelConfig.liveVoice.model,
        latencyMs,
        success: result.success,
      });

      return result;
    } catch (err) {
      logger.warn(`[AiCapabilityRouter] Live voice error: ${err.message}`);
      return {
        success: false,
        capability: aiModelConfig.capabilities.LIVE_VOICE,
        model: aiModelConfig.liveVoice.model,
        error: err.message,
        fallbackAvailable: true,
      };
    }
  }

  /**
   * Optional Real-Time Multilingual Speech Translation via Gemini 3.5 Live Translate
   */
  async processLiveTranslation(payload = {}, options = {}, routeStartTime = Date.now()) {
    const startTime = Date.now();
    try {
      const result = await googleAiClient.liveTranslateStream({
        audioData: payload.audioData || null,
        transcript: payload.transcript || payload.text || '',
        sourceLanguage: payload.sourceLanguage || 'auto',
        targetLanguage: payload.targetLanguage || 'English',
      }, options);

      const latencyMs = Date.now() - startTime;
      this._recordTelemetry({
        capability: aiModelConfig.capabilities.LIVE_TRANSLATION,
        model: result.model || aiModelConfig.liveTranslation.model,
        latencyMs,
        success: result.success,
      });

      return result;
    } catch (err) {
      logger.warn(`[AiCapabilityRouter] Live translation error: ${err.message}`);
      return {
        success: false,
        capability: aiModelConfig.capabilities.LIVE_TRANSLATION,
        model: aiModelConfig.liveTranslation.model,
        error: err.message,
        originalText: payload.transcript || payload.text || '',
        fallbackAvailable: true,
      };
    }
  }

  /**
   * Optional Spoken AI Voice Response / Text-to-Speech via Gemini 3.1 Flash TTS
   */
  async processVoiceResponse(payload = {}, options = {}, routeStartTime = Date.now()) {
    const startTime = Date.now();
    try {
      const result = await googleAiClient.generateSpeech({
        text: payload.text || payload.message || '',
        voice: payload.voice || 'Standard',
        language: payload.language || 'en',
      }, options);

      const latencyMs = Date.now() - startTime;
      this._recordTelemetry({
        capability: aiModelConfig.capabilities.VOICE_RESPONSE,
        model: result.model || aiModelConfig.tts.model,
        latencyMs,
        success: result.success,
      });

      return result;
    } catch (err) {
      logger.warn(`[AiCapabilityRouter] Voice response TTS error: ${err.message}`);
      return {
        success: false,
        capability: aiModelConfig.capabilities.VOICE_RESPONSE,
        model: aiModelConfig.tts.model,
        error: err.message,
        originalText: payload.text || payload.message || '',
        fallbackAvailable: true,
      };
    }
  }

  /**
   * Internal telemetry tracker
   * @private
   */
  _recordTelemetry(entry) {
    this.executionLogs.unshift({
      id: `telemetry_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      ...entry,
    });
    if (this.executionLogs.length > this.maxLogs) {
      this.executionLogs.pop();
    }
  }

  /**
   * Retrieve recent telemetry records for observability audits
   */
  getExecutionLogs(limit = 20) {
    return this.executionLogs.slice(0, limit);
  }

  /**
   * Aggregated observability statistics
   */
  getObservabilityStats() {
    const total = this.executionLogs.length;
    const byCapability = {};
    let totalLatency = 0;

    for (const log of this.executionLogs) {
      const cap = log.capability || 'unknown';
      byCapability[cap] = (byCapability[cap] || 0) + 1;
      const lat = log.latencies?.totalMs || log.latencyMs || 0;
      totalLatency += lat;
    }

    return {
      totalRequestsRouted: total,
      breakdownByCapability: byCapability,
      averageLatencyMs: total > 0 ? Math.round(totalLatency / total) : 0,
      timestamp: new Date().toISOString(),
    };
  }
}

const aiCapabilityRouter = new AiCapabilityRouter();
module.exports = aiCapabilityRouter;
module.exports.AiCapabilityRouter = AiCapabilityRouter;
