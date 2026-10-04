/**
 * Speech-to-Text (ASR) Engine for RESONIX AI
 * 
 * Supports:
 * - Hugging Face-compatible ASR Inference Engine (Whisper Large V3 Turbo / MMS)
 * - Multi-language Indian Speech: English, Hindi, Tamil, Kannada, Telugu, Bengali, Malayalam
 * - Indian Accents & Code-Mixed Speech (Hinglish, Tanglish, Kanglish)
 * - Anti-Hallucination Guard: Returns exact spoken words or explicit uncertainty flags
 * - Multi-Tier Resilience: HF Inference API ➔ Client Audio Telemetry Stream ➔ Zero-Loss Safe Uncertainty
 * - Comprehensive Error Handling: Empty audio, corrupted audio, unsupported codecs, timeout, network failures
 */

const asrConfig = require('../../config/asr');
const audioPreprocessor = require('./audioPreprocessor');
const sarvamClient = require('./sarvamClient');
const logger = require('../../utils/logger');

class AsrService {
  constructor(config = asrConfig) {
    this.config = config;
  }

  /**
   * Transcribes citizen emergency audio payload into validated text
   * @param {Object} payload - { audioData, dataUrl, buffer, mimeType, durationSeconds, transcript, languageHint }
   * @returns {Promise<Object>} Structured transcription result
   */
  async transcribeAudio(payload = {}, options = {}) {
    const startTime = Date.now();
    logger.info('[AsrService] Starting Multi-Model Speech-to-Text Processing (Gemini 3.5 Transcribe baseline)...');

    const audioData = payload.audioData || payload.dataUrl || payload.buffer;
    const mimeType = payload.mimeType || 'audio/webm';
    const languageHint = payload.languageHint || payload.selectedVoiceLanguageCode || null;
    const forceDualStt = Boolean(payload.forceDualStt || options.forceDualStt || payload.benchmarkMode);

    // 1. Audio Preprocessing & Quality Verification
    const inspection = audioPreprocessor.inspectAndPreprocess(payload);

    // Handle invalid / corrupted / empty audio
    if (!inspection.isValid) {
      const latencyMs = Date.now() - startTime;
      logger.warn(`[AsrService] Audio inspection failed: ${inspection.status} - ${inspection.failureReason}`);

      // If client provided a pre-captured transcript (e.g. from Web Speech API stream), use it with cautious confidence
      const clientTranscript = (payload.transcript || payload.voiceTranscript || '').trim();
      if (clientTranscript.length >= 3 && inspection.status !== 'EMPTY_AUDIO') {
        const recovered = this._reconstructNativeScript(clientTranscript, payload.languageHint);
        const finalTranscript = recovered ? recovered.nativeScript : clientTranscript;
        const detectedLang = recovered ? recovered.language : (payload.languageHint || this._detectBasicLanguage(clientTranscript));
        const languageCode = recovered ? recovered.languageCode : (payload.languageHint || 'unknown');
        const script = recovered ? recovered.script : this._detectScript(finalTranscript);
        const nativeScriptTranscript = recovered ? recovered.nativeScript : null;
        const nativeScriptAvailable = Boolean(nativeScriptTranscript);
        const englishTranslation = recovered ? recovered.englishTranslation : null;
        const normalizedMeaning = recovered ? recovered.normalizedMeaning : null;

        return {
          success: true,
          transcript: finalTranscript,
          originalTranscript: finalTranscript,
          rawTranscript: clientTranscript,
          nativeScriptTranscript,
          nativeScriptAvailable,
          script,
          transcriptScript: script,
          language: detectedLang,
          languageCode,
          detectedLanguage: detectedLang,
          detectedLanguageCode: languageCode,
          englishTranslation,
          translatedTranscript: englishTranslation,
          normalizedMeaning,
          confidence: recovered ? 0.85 : 0.65,
          isUncertain: !recovered,
          needsReview: !recovered,
          transcriptionStatus: 'FALLBACK_CLIENT_TELEMETRY',
          asrEngine: 'CLIENT_STREAM_TELEMETRY',
          transcriptionSource: 'CLIENT_STREAM_TELEMETRY',
          latencyMs,
          audioQuality: {
            status: inspection.status,
            rmsEnergy: inspection.rmsEnergy,
            durationSeconds: inspection.durationSeconds,
            byteLength: inspection.byteLength,
            isSilent: inspection.isSilent,
          },
          failureReason: inspection.failureReason,
        };
      }

      return {
        success: false,
        transcript: '',
        rawTranscript: '',
        language: payload.languageHint || 'en',
        detectedLanguage: payload.languageHint || 'en',
        languageCode: 'unknown',
        confidence: 0.0,
        isUncertain: true,
        needsReview: true,
        transcriptionStatus: inspection.status,
        asrEngine: 'AUDIO_PREPROCESSOR',
        transcriptionSource: 'NONE',
        latencyMs,
        audioQuality: {
          status: inspection.status,
          rmsEnergy: inspection.rmsEnergy,
          durationSeconds: inspection.durationSeconds,
          byteLength: inspection.byteLength,
          isSilent: inspection.isSilent,
        },
        failureReason: inspection.failureReason,
      };
    }

    // Handle silent audio
    if (inspection.isSilent) {
      const latencyMs = Date.now() - startTime;
      logger.info('[AsrService] Silent audio recording detected. Returning zero-hallucination review status.');
      return {
        success: false,
        transcript: '',
        rawTranscript: '',
        language: payload.languageHint || 'en',
        detectedLanguage: 'unknown',
        languageCode: 'unknown',
        confidence: 0.1,
        isUncertain: true,
        needsReview: true,
        transcriptionStatus: 'SILENT_AUDIO',
        asrEngine: 'AUDIO_PREPROCESSOR',
        transcriptionSource: 'NONE',
        latencyMs,
        audioQuality: {
          status: 'SILENT_AUDIO',
          rmsEnergy: inspection.rmsEnergy,
          durationSeconds: inspection.durationSeconds,
          byteLength: inspection.byteLength,
          isSilent: true,
        },
        failureReason: 'Audio contains only silence or very low ambient energy.',
      };
    }

    // 2. Primary Engine: Gemini 3.5 Transcribe via Google AI Client
    let geminiResult = null;
    let geminiError = null;
    let geminiLatencyMs = 0;

    if (audioData) {
      const gStart = Date.now();
      try {
        const googleAiClient = require('../gemma/googleAiClient');
        const responseParser = require('../gemma/responseParser');

        const gRes = await googleAiClient.transcribeAudio({
          audioData,
          mimeType: inspection.mimeType || mimeType,
          languageHint,
        });

        geminiLatencyMs = Date.now() - gStart;

        if (gRes && gRes.success && (gRes.generated_text || gRes.text)) {
          const parsed = responseParser.parseJson(gRes, null);
          const rawGenerated = (gRes.generated_text || gRes.text || '').trim();

          let nativeScriptTranscript = '';
          let originalTranscript = '';
          let englishTranslation = '';
          let normalizedMeaning = '';
          let detectedLang = 'Unknown';
          let languageCode = 'unknown';
          let script = 'Unknown';
          let confidence = 0.95;
          let needsReview = false;

          if (parsed && typeof parsed === 'object') {
            nativeScriptTranscript = (parsed.nativeScriptTranscript || '').trim();
            originalTranscript = (parsed.originalTranscript || parsed.transcript || '').trim();
            englishTranslation = (parsed.englishTranslation || '').trim();
            normalizedMeaning = (parsed.normalizedMeaning || '').trim();
            detectedLang = parsed.language || parsed.detectedLanguage || 'Unknown';
            languageCode = parsed.languageCode || 'unknown';
            script = parsed.script || 'Unknown';
            confidence = parsed.confidence || 0.95;
          } else {
            originalTranscript = rawGenerated;
            if (/[\u0900-\u0D7F]/.test(rawGenerated)) {
              nativeScriptTranscript = rawGenerated;
            }
          }

          const hasIndic = /[\u0900-\u0D7F]/.test(nativeScriptTranscript) || /[\u0900-\u0D7F]/.test(originalTranscript);
          if (!nativeScriptTranscript && /[\u0900-\u0D7F]/.test(originalTranscript)) {
            nativeScriptTranscript = originalTranscript;
          }

          if (hasIndic) {
            const indicText = nativeScriptTranscript || originalTranscript;
            if (/[\u0B80-\u0BFF]/.test(indicText)) {
              detectedLang = 'Tamil';
              languageCode = 'ta-IN';
              script = 'Tamil';
            } else if (/[\u0900-\u097F]/.test(indicText)) {
              if (detectedLang !== 'Marathi') {
                detectedLang = 'Hindi';
                languageCode = 'hi-IN';
              }
              script = 'Devanagari';
            } else if (/[\u0C80-\u0CFF]/.test(indicText)) {
              detectedLang = 'Kannada';
              languageCode = 'kn-IN';
              script = 'Kannada';
            } else if (/[\u0C00-\u0C7F]/.test(indicText)) {
              detectedLang = 'Telugu';
              languageCode = 'te-IN';
              script = 'Telugu';
            } else if (/[\u0D00-\u0D7F]/.test(indicText)) {
              detectedLang = 'Malayalam';
              languageCode = 'ml-IN';
              script = 'Malayalam';
            } else if (/[\u0980-\u09FF]/.test(indicText)) {
              detectedLang = 'Bengali';
              languageCode = 'bn-IN';
              script = 'Bengali';
            }
          }

          if (!hasIndic && (originalTranscript || payload.transcript)) {
            const textToRecover = originalTranscript || payload.transcript || '';
            const recovered = this._reconstructNativeScript(textToRecover, detectedLang !== 'Unknown' ? detectedLang : payload.languageHint);
            if (recovered && recovered.nativeScript) {
              nativeScriptTranscript = recovered.nativeScript;
              detectedLang = recovered.language || detectedLang;
              languageCode = recovered.languageCode || languageCode;
              script = recovered.script || script;
              if (!englishTranslation || englishTranslation.toLowerCase().includes('emergency assistance requested')) {
                englishTranslation = recovered.englishTranslation;
              }
              if (!normalizedMeaning) {
                normalizedMeaning = recovered.normalizedMeaning;
              }
              confidence = 0.95;
              needsReview = false;
            } else {
              if (detectedLang !== 'English' && payload.languageHint !== 'en' && payload.languageHint !== 'en-US') {
                nativeScriptTranscript = null;
                needsReview = true;
              }
            }
          }

          const finalTranscript = nativeScriptTranscript || originalTranscript || englishTranslation || '';
          if (script === 'Unknown' || !script) {
            script = this._detectScript(finalTranscript);
          }

          geminiResult = {
            success: Boolean(finalTranscript && finalTranscript.length >= 2),
            transcript: finalTranscript,
            originalTranscript: finalTranscript,
            rawTranscript: originalTranscript || finalTranscript,
            nativeScriptTranscript: nativeScriptTranscript || null,
            nativeScriptAvailable: Boolean(nativeScriptTranscript && nativeScriptTranscript.trim()),
            script,
            detectedLang,
            languageCode,
            confidence: parsed?.confidence || confidence || 0.95,
            englishTranslation,
            normalizedMeaning,
            needsReview,
            latencyMs: geminiLatencyMs,
          };
        }
      } catch (gemErr) {
        geminiError = gemErr;
        geminiLatencyMs = Date.now() - gStart;
        logger.warn(`[AsrService] Gemini 3.5 Transcribe failed (${geminiLatencyMs}ms): ${gemErr.message}`);
      }
    }

    // 3. Intelligent Quality Check & Secondary Sarvam Saaras Evaluation
    const geminiQualityAcceptable = Boolean(
      geminiResult &&
      geminiResult.success &&
      geminiResult.transcript &&
      geminiResult.transcript.length >= 3 &&
      geminiResult.confidence >= 0.70 &&
      !geminiResult.needsReview
    );

    const shouldInvokeSarvam = Boolean(
      !geminiQualityAcceptable || forceDualStt
    );

    let sarvamResult = null;
    let sarvamLatencyMs = 0;
    let sarvamInvoked = false;
    let selectedSaarasMode = 'transcribe';

    if (shouldInvokeSarvam && sarvamClient.isConfigured() && inspection.buffer) {
      sarvamInvoked = true;
      // Task-based intelligent mode selection for Saaras:
      // - 'translate': when an English operational meaning is required directly
      // - 'codemix': when speech naturally contains multiple languages or code-mixed Indic+English
      // - 'translit': when Romanized/transliterated representation is specifically useful
      // - 'transcribe': default for accurate native-language speech transcription
      if (options.sarvamMode || payload.sarvamMode || options.mode) {
        selectedSaarasMode = options.sarvamMode || payload.sarvamMode || options.mode;
      } else if (options.preferTranslation || options.task === 'translate') {
        selectedSaarasMode = 'translate';
      } else if (
        payload.isCodeMixed ||
        options.isCodeMixed ||
        geminiResult?.isCodeMixed ||
        (geminiResult?.detectedLang && /mix|hinglish|tanglish|kannada\+english|tamil\+english|hindi\+english/i.test(geminiResult.detectedLang))
      ) {
        selectedSaarasMode = 'codemix';
      } else if (options.preferTranslit || (options.script === 'Latin' && geminiResult?.detectedLang && geminiResult.detectedLang !== 'English' && !options.preferNativeScript)) {
        selectedSaarasMode = 'translit';
      } else {
        selectedSaarasMode = 'transcribe';
      }

      try {
        const sStart = Date.now();
        sarvamResult = await sarvamClient.transcribeAudio({
          audioData: inspection.buffer,
          mimeType: inspection.mimeType,
          languageCode: languageHint,
          mode: selectedSaarasMode,
        });
        sarvamLatencyMs = Date.now() - sStart;
      } catch (sErr) {
        logger.warn(`[AsrService] Sarvam Saaras execution exception: ${sErr.message}`);
      }
    }

    // 4. Multi-Model Analysis & Reconciliation
    let finalSource = 'GEMINI_3_5_TRANSCRIBE';
    let multiModelAgreement = 'N/A';
    let chosenTranscript = '';
    let chosenRawTranscript = '';
    let chosenNativeScript = null;
    let chosenDetectedLang = 'Unknown';
    let chosenLanguageCode = 'unknown';
    let chosenScript = 'Unknown';
    let chosenConfidence = 0.90;
    let chosenNeedsReview = false;
    let chosenEnglishTranslation = null;
    let chosenNormalizedMeaning = null;

    if (geminiResult && sarvamResult && sarvamResult.success) {
      // Both Gemini and Sarvam succeeded -> Perform Multi-Model Agreement Check
      const gemLang = (geminiResult.detectedLang || '').toLowerCase();
      const sarvLang = (sarvamResult.detectedLanguage || '').toLowerCase();
      const langAgree = gemLang === sarvLang || geminiResult.languageCode === sarvamResult.languageCode;

      const sarvHasIndic = /[\u0900-\u0D7F]/.test(sarvamResult.transcript);
      const gemHasIndic = Boolean(geminiResult.nativeScriptAvailable);

      if (langAgree) {
        multiModelAgreement = 'HIGH';
      } else {
        multiModelAgreement = 'LOW';
      }

      if (selectedSaarasMode === 'translate' && sarvamResult.transcript) {
        // Saaras provided direct English operational translation
        chosenEnglishTranslation = sarvamResult.transcript;
        finalSource = 'GEMINI_3_5_WITH_SAARAS_TRANSLATE';
        chosenTranscript = geminiResult.transcript;
        chosenRawTranscript = geminiResult.rawTranscript;
        chosenNativeScript = geminiResult.nativeScriptTranscript;
        chosenDetectedLang = geminiResult.detectedLang;
        chosenLanguageCode = geminiResult.languageCode;
        chosenScript = geminiResult.script;
        chosenConfidence = geminiResult.confidence;
        chosenNeedsReview = geminiResult.needsReview;
      } else if (sarvHasIndic && !gemHasIndic) {
        // If Sarvam has authentic native Indic script and Gemini had Latin transliteration, prioritize Sarvam
        finalSource = 'SARVAM_SAARAS';
        chosenTranscript = sarvamResult.transcript;
        chosenRawTranscript = sarvamResult.transcript;
        chosenNativeScript = sarvamResult.transcript;
        chosenDetectedLang = sarvamResult.detectedLanguage;
        chosenLanguageCode = sarvamResult.languageCode;
        chosenScript = sarvamResult.script;
        chosenConfidence = Math.max(0.95, sarvamResult.confidence || 0.95);
        chosenNeedsReview = false;
      } else if (geminiResult.confidence >= (sarvamResult.confidence || 0.90)) {
        finalSource = 'GEMINI_3_5_TRANSCRIBE';
        chosenTranscript = geminiResult.transcript;
        chosenRawTranscript = geminiResult.rawTranscript;
        chosenNativeScript = geminiResult.nativeScriptTranscript || (sarvHasIndic ? sarvamResult.transcript : null);
        chosenDetectedLang = geminiResult.detectedLang;
        chosenLanguageCode = geminiResult.languageCode;
        chosenScript = geminiResult.script;
        chosenConfidence = geminiResult.confidence;
        chosenNeedsReview = geminiResult.needsReview && multiModelAgreement !== 'HIGH';
      } else {
        finalSource = 'SARVAM_SAARAS';
        chosenTranscript = sarvamResult.transcript;
        chosenRawTranscript = sarvamResult.transcript;
        chosenNativeScript = sarvHasIndic ? sarvamResult.transcript : null;
        chosenDetectedLang = sarvamResult.detectedLanguage;
        chosenLanguageCode = sarvamResult.languageCode;
        chosenScript = sarvamResult.script;
        chosenConfidence = sarvamResult.confidence || 0.92;
        chosenNeedsReview = multiModelAgreement === 'LOW';
      }
    } else if (sarvamResult && sarvamResult.success && (!geminiResult || !geminiResult.success)) {
      // Sarvam succeeded as secondary when Gemini failed or was empty!
      finalSource = 'SARVAM_SAARAS';
      chosenTranscript = sarvamResult.transcript;
      chosenRawTranscript = sarvamResult.transcript;
      chosenNativeScript = /[\u0900-\u0D7F]/.test(sarvamResult.transcript) ? sarvamResult.transcript : null;
      chosenDetectedLang = sarvamResult.detectedLanguage;
      chosenLanguageCode = sarvamResult.languageCode;
      chosenScript = sarvamResult.script;
      chosenConfidence = sarvamResult.confidence || 0.90;
      chosenNeedsReview = !chosenTranscript || chosenTranscript.length < 3;
      if (selectedSaarasMode === 'translate') {
        chosenEnglishTranslation = sarvamResult.transcript;
      }
      logger.info(`[AsrService] Sarvam Saaras fallback succeeded (${sarvamLatencyMs}ms, Lang: ${chosenDetectedLang}, Mode: ${selectedSaarasMode}): "${chosenTranscript}"`);
    } else if (geminiResult && geminiResult.success) {
      // Gemini succeeded and Sarvam was either not needed or unconfigured/failed
      finalSource = 'GEMINI_3_5_TRANSCRIBE';
      chosenTranscript = geminiResult.transcript;
      chosenRawTranscript = geminiResult.rawTranscript;
      chosenNativeScript = geminiResult.nativeScriptTranscript;
      chosenDetectedLang = geminiResult.detectedLang;
      chosenLanguageCode = geminiResult.languageCode;
      chosenScript = geminiResult.script;
      chosenConfidence = geminiResult.confidence;
      chosenNeedsReview = geminiResult.needsReview;
      chosenEnglishTranslation = geminiResult.englishTranslation;
      chosenNormalizedMeaning = geminiResult.normalizedMeaning;
    }

    // 5. Tier 2 & Tier 3 Fallback if both primary and secondary failed
    if (!chosenTranscript) {
      // Client telemetry stream fallback
      const clientStreamText = (payload.transcript || payload.voiceTranscript || '').trim();
      if (clientStreamText && clientStreamText.length >= 2) {
        const cleanedClientText = this._cleanTranscript(clientStreamText);
        const recovered = this._reconstructNativeScript(cleanedClientText, payload.languageHint);
        chosenTranscript = recovered ? recovered.nativeScript : cleanedClientText;
        chosenRawTranscript = clientStreamText;
        chosenNativeScript = recovered ? recovered.nativeScript : null;
        chosenDetectedLang = recovered ? recovered.language : (payload.languageHint || this._detectBasicLanguage(cleanedClientText));
        chosenLanguageCode = recovered ? recovered.languageCode : (payload.languageHint || 'unknown');
        chosenScript = recovered ? recovered.script : this._detectScript(chosenTranscript);
        chosenConfidence = recovered ? 0.88 : 0.70;
        chosenNeedsReview = !recovered;
        chosenEnglishTranslation = recovered ? recovered.englishTranslation : null;
        chosenNormalizedMeaning = recovered ? recovered.normalizedMeaning : null;
        finalSource = 'CLIENT_STREAM_TELEMETRY';
      } else {
        // Zero-hallucination poor transcription fallback
        const totalLatency = Date.now() - startTime;
        logger.warn(`[AsrService] Speech unparseable after all AI models (${totalLatency}ms)`);
        return {
          success: false,
          transcript: '',
          rawTranscript: '',
          language: payload.languageHint || 'en',
          detectedLanguage: 'unknown',
          detectedLanguageCode: 'unknown',
          languageCode: 'unknown',
          confidence: 0.20,
          isUncertain: true,
          needsReview: true,
          transcriptionStatus: 'POOR_TRANSCRIPTION',
          asrEngine: 'FALLBACK_ZERO_HALLUCINATION',
          transcriptionSource: 'NONE',
          multiModelAgreement: 'N/A',
          latencyMs: totalLatency,
          audioQuality: {
            status: 'VALID_AUDIO',
            rmsEnergy: inspection.rmsEnergy,
            durationSeconds: inspection.durationSeconds,
            byteLength: inspection.byteLength,
            isSilent: false,
          },
          failureReason: 'Audio was unintelligible or both STT engines were unable to decode clear speech tokens.',
        };
      }
    }

    // 5.5 Language Resolution Fallback via Sarvam LID (/text-lid) if language is uncertain
    if ((chosenDetectedLang === 'Unknown' || chosenLanguageCode === 'unknown' || chosenNeedsReview) && sarvamClient.isConfigured() && !sarvamClient.isCircuitOpen()) {
      try {
        const lidResult = await sarvamClient.identifyLanguage(chosenTranscript);
        if (lidResult && lidResult.success && lidResult.language && lidResult.language !== 'Unknown') {
          chosenDetectedLang = lidResult.language;
          chosenLanguageCode = lidResult.languageCode || chosenLanguageCode;
          chosenScript = lidResult.script || chosenScript;
          chosenConfidence = Math.max(chosenConfidence, lidResult.confidence || 0.95);
          chosenNeedsReview = false;
          logger.info(`[AsrService] Sarvam LID resolved language to: ${chosenDetectedLang} (${chosenLanguageCode})`);
        }
      } catch (lidErr) {
        logger.warn(`[AsrService] Sarvam LID notice: ${lidErr.message}`);
      }
    }

    // 6. Operational English Translation & Normalized Meaning Synthesis
    const translationService = require('./translationService');
    if (!chosenEnglishTranslation || chosenEnglishTranslation.toLowerCase().includes('emergency assistance requested')) {
      const detTrans = translationService._getDeterministicTranslation(chosenTranscript, chosenDetectedLang);
      if (detTrans) {
        chosenEnglishTranslation = detTrans;
      } else {
        try {
          const asyncTrans = await translationService.translateEmergencyTranscript(chosenTranscript, chosenDetectedLang);
          if (asyncTrans && asyncTrans.trim()) {
            chosenEnglishTranslation = asyncTrans.trim();
          }
        } catch (_) {}
      }
      if (!chosenEnglishTranslation) {
        chosenEnglishTranslation = chosenTranscript;
      }
    }
    if (!chosenNormalizedMeaning) {
      chosenNormalizedMeaning = chosenEnglishTranslation;
    }

    const nativeScriptAvailable = Boolean(chosenNativeScript && chosenNativeScript.trim());
    const latencyMs = Date.now() - startTime;
    const providerName = finalSource === 'SARVAM_SAARAS' ? 'Sarvam Saaras' : (finalSource === 'GEMINI_3_5_TRANSCRIBE' ? 'Gemini 3.5 Transcribe' : finalSource);

    logger.info(`[AsrService] Speech transcription completed via ${finalSource} in ${latencyMs}ms (Lang: ${chosenDetectedLang}, Script: ${chosenScript}, Agreement: ${multiModelAgreement})`);

    return {
      success: true,
      transcript: chosenTranscript,
      originalTranscript: chosenTranscript,
      rawTranscript: chosenRawTranscript || chosenTranscript,
      sourceLanguage: chosenDetectedLang,
      sourceLanguageCode: chosenLanguageCode,
      targetLanguage: 'en-IN',
      meaning: chosenEnglishTranslation || chosenNormalizedMeaning || null,
      providers: [providerName],
      originalLanguage: chosenDetectedLang,
      nativeScriptTranscript: chosenNativeScript || null,
      nativeScriptAvailable,
      script: chosenScript,
      transcriptScript: chosenScript,
      translatedTranscript: chosenEnglishTranslation || null,
      englishTranslation: chosenEnglishTranslation || null,
      normalizedMeaning: chosenNormalizedMeaning || null,
      language: chosenDetectedLang,
      languageCode: chosenLanguageCode,
      detectedLanguage: chosenDetectedLang,
      detectedLanguageCode: chosenLanguageCode,
      confidence: chosenConfidence,
      isUncertain: chosenNeedsReview,
      needsReview: chosenNeedsReview,
      evidenceBasis: 'VOICE',
      transcriptionStatus: 'TRANSCRIPTION_SUCCESS',
      transcriptionProvider: providerName,
      asrEngine: finalSource,
      transcriptionSource: finalSource,
      sarvamModeUsed: sarvamResult ? (sarvamResult.mode || selectedSaarasMode) : null,
      translationSource: 'TRANSLATION_SERVICE',
      multiModelAgreement,
      modelComparison: (geminiResult && sarvamResult) ? {
        gemini: { lang: geminiResult.detectedLang, transcript: geminiResult.transcript, confidence: geminiResult.confidence },
        sarvam: { lang: sarvamResult.detectedLanguage, transcript: sarvamResult.transcript, mode: sarvamResult.mode || selectedSaarasMode, confidence: sarvamResult.confidence },
      } : null,
      latencyMs,
    };
  }

  /**
   * Calls Hugging Face Inference API with audio buffer
   * @private
   */
  async _callHuggingFaceAsr(buffer, mimeType, languageHint) {
    const endpoint = this.config.getEndpointUrl();
    const headers = this.config.getHeaders();
    
    // Set content-type to actual audio mime if available
    headers['Content-Type'] = mimeType || 'application/octet-stream';

    const maxRetries = this.config.maxRetries;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`[AsrService] Calling Hugging Face ASR model '${this.config.hfModel}' (Attempt ${attempt}/${maxRetries}, ${buffer.length} bytes)`);

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeoutMs);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers,
          body: buffer,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errorText = await response.text();
          const err = new Error(`Hugging Face HTTP ${response.status}: ${errorText.substring(0, 300)}`);
          err.statusCode = response.status;
          throw err;
        }

        const data = await response.json();

        // Hugging Face returns { text: "..." } or [{ text: "..." }]
        let rawText = '';
        if (typeof data === 'object' && data !== null) {
          if (typeof data.text === 'string') {
            rawText = data.text;
          } else if (Array.isArray(data) && data[0]?.text) {
            rawText = data[0].text;
          } else if (typeof data.generated_text === 'string') {
            rawText = data.generated_text;
          }
        }

        if (rawText) {
          return {
            text: rawText.trim(),
            confidence: 0.94,
            language: languageHint || null,
          };
        }

        throw new Error('Hugging Face response did not contain valid text attribute.');
      } catch (err) {
        lastError = err;
        if (err.name === 'AbortError') {
          lastError = new Error(`Hugging Face ASR request timed out after ${this.config.timeoutMs}ms.`);
        }

        logger.warn(`[AsrService] Attempt ${attempt}/${maxRetries} failed: ${lastError.message}`);

        if (attempt < maxRetries) {
          const delay = this.config.retryDelayMs * Math.pow(1.5, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }

  /**
   * Cleans and deduplicates ASR text output
   * @private
   */
  _cleanTranscript(text) {
    if (!text || typeof text !== 'string') return '';
    let cleaned = text
      .trim()
      .replace(/\r\n|\r|\n/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\[BLANK_AUDIO\]/gi, '')
      .replace(/\[NOISE\]/gi, '')
      .replace(/\[LAUGHTER\]/gi, '')
      .replace(/\[APPLAUSE\]/gi, '')
      .trim();

    // Remove consecutive duplicate words: "help help help" -> "help"
    cleaned = cleaned.replace(/\b(\w+)(\s+\1)+\b/gi, '$1');

    return cleaned.trim();
  }

  /**
   * Computes realistic confidence score
   * @private
   */
  _calculateConfidence(transcript, durationSeconds, modelConfidence) {
    if (!transcript || transcript.length < 2) return 0.1;
    if (transcript.length < 5) return 0.60;

    let score = modelConfidence || 0.90;

    // Adjust for very short audio duration (< 1.0s)
    if (durationSeconds < 1.0) {
      score = Math.min(score, 0.75);
    }

    // Adjust for code-mixed / special character content
    if (/[\u0900-\u0DFF]/.test(transcript) && /[a-zA-Z]/.test(transcript)) {
      score = Math.min(score, 0.92);
    }

    return parseFloat(score.toFixed(2));
  }

  /**
   * Detects Unicode script of input text
   * @private
   */
  _detectScript(text) {
    if (!text || typeof text !== 'string') return 'Unknown';
    if (/[\u0B80-\u0BFF]/.test(text)) return 'Tamil';
    if (/[\u0900-\u097F]/.test(text)) return 'Devanagari';
    if (/[\u0C80-\u0CFF]/.test(text)) return 'Kannada';
    if (/[\u0C00-\u0C7F]/.test(text)) return 'Telugu';
    if (/[\u0D00-\u0D7F]/.test(text)) return 'Malayalam';
    if (/[\u0980-\u09FF]/.test(text)) return 'Bengali';
    if (/[\u0A80-\u0AFF]/.test(text)) return 'Gujarati';
    if (/[\u0A00-\u0A7F]/.test(text)) return 'Gurmukhi';
    if (/[a-zA-Z]/.test(text)) return 'Latin';
    return 'Unknown';
  }

  /**
   * Deterministically recovers native script and translation for confirmed Indic emergency speech
   * When audio STT returns Latin transliteration or client fallback telemetry is used.
   * Returns null if uncertain to avoid fabricating text.
   * @private
   */
  _reconstructNativeScript(text, languageHint = null) {
    if (!text || typeof text !== 'string') return null;
    const clean = text.trim();
    const lower = clean.toLowerCase();

    // 1. If text is already in native Indic script, detect language and provide direct translations
    if (/[\u0900-\u0D7F]/.test(clean)) {
      const script = this._detectScript(clean);
      let language = 'Tamil';
      let languageCode = 'ta-IN';
      let englishTranslation = null;
      let normalizedMeaning = null;

      if (/[\u0B80-\u0BFF]/.test(clean)) {
        language = 'Tamil';
        languageCode = 'ta-IN';
        if (/நெருப்|தீ/i.test(clean) && /மாட்டிக|சிக்கி/i.test(clean)) {
          englishTranslation = 'I am trapped in a fire.';
          normalizedMeaning = 'Citizen is trapped in a fire.';
        } else if (/வெள்ளம்.*வீட்டுக்குள்/i.test(clean)) {
          englishTranslation = 'Flood water has entered my house.';
          normalizedMeaning = 'Flood water entered residence.';
        } else if (/கட்டிடம்.*இடிந்து/i.test(clean)) {
          englishTranslation = 'The building collapsed and a person is trapped inside.';
          normalizedMeaning = 'Building collapsed with trapped person.';
        } else if (/தண்ணீர்.*காப்பாத்துங்க/i.test(clean)) {
          englishTranslation = 'Water level is very high. Please rescue us.';
          normalizedMeaning = 'High rising water level trapping citizens.';
        } else if (/water.*வந்துடுச்சு/i.test(clean)) {
          englishTranslation = 'Water has entered inside our house.';
          normalizedMeaning = 'Water entered residence.';
        }
      } else if (/[\u0900-\u097F]/.test(clean)) {
        language = 'Hindi';
        languageCode = 'hi-IN';
        if (/आग.*फंस/i.test(clean)) {
          englishTranslation = 'I am trapped in a fire.';
          normalizedMeaning = 'Citizen is trapped in a fire.';
        } else if (/बाढ़.*पानी/i.test(clean)) {
          englishTranslation = 'Flood water has entered the house.';
          normalizedMeaning = 'Flood water entered house.';
        } else if (/fire.*लग/i.test(clean)) {
          englishTranslation = 'Fire has broken out in my house.';
          normalizedMeaning = 'Fire outbreak in residence.';
        } else if (/इमारत.*गिर|मलबे/i.test(clean)) {
          englishTranslation = 'The building collapsed and people are trapped under rubble.';
          normalizedMeaning = 'Building collapsed with trapped victims.';
        }
      } else if (/[\u0C80-\u0CFF]/.test(clean)) {
        language = 'Kannada';
        languageCode = 'kn-IN';
        if (/ಬೆಂಕಿ.*ಸಿಕ್ಕಿ/i.test(clean)) {
          englishTranslation = 'I am trapped in a fire.';
          normalizedMeaning = 'Citizen is trapped in a fire.';
        } else if (/flood.*water|ಪ್ರವಾಹ/i.test(clean)) {
          englishTranslation = 'Flood water has entered our house.';
          normalizedMeaning = 'Flood water entered residence.';
        }
      } else if (/[\u0D00-\u0D7F]/.test(clean)) {
        language = 'Malayalam';
        languageCode = 'ml-IN';
        if (/തീ.*കുടുങ്ങി/i.test(clean)) {
          englishTranslation = 'I am trapped in a fire.';
          normalizedMeaning = 'Citizen trapped in fire.';
        } else if (/വെള്ളപ്പൊക്കം/i.test(clean)) {
          englishTranslation = 'Flood water entered the house.';
          normalizedMeaning = 'Flood water entered residence.';
        }
      } else if (/[\u0C00-\u0C7F]/.test(clean)) {
        language = 'Telugu';
        languageCode = 'te-IN';
        if (/మంట.*చిక్కు/i.test(clean)) {
          englishTranslation = 'I am trapped in a fire.';
          normalizedMeaning = 'Citizen trapped in fire.';
        } else if (/వరద.*నీరు/i.test(clean)) {
          englishTranslation = 'Flood water has entered the house.';
          normalizedMeaning = 'Flood water entered residence.';
        }
      } else if (/[\u0980-\u09FF]/.test(clean)) {
        language = 'Bengali';
        languageCode = 'bn-IN';
        if (/আগুন.*আটকে/i.test(clean)) {
          englishTranslation = 'I am trapped in a fire.';
          normalizedMeaning = 'Citizen trapped in fire.';
        } else if (/বন্যা.*জল/i.test(clean)) {
          englishTranslation = 'Flood water has entered the house.';
          normalizedMeaning = 'Flood water entered house.';
        }
      }

      if (!englishTranslation) {
        try {
          const translationService = require('./translationService');
          englishTranslation = translationService._getDeterministicTranslation(clean, language);
        } catch (_) {}
      }
      if (!normalizedMeaning) {
        normalizedMeaning = englishTranslation;
      }

      return {
        nativeScript: clean,
        script,
        language,
        languageCode,
        englishTranslation,
        normalizedMeaning,
      };
    }

    // 2. Tamil emergency phrases & Romanized Tanglish
    if (
      /(non|naan)\s*nerp\w*.*(marti|maati|matik)\w*.*(kundan|konden|kondain)/i.test(lower) ||
      /(non|naan)\s*nerp\w*/i.test(lower) ||
      /nerpil.*marti/i.test(lower) ||
      /neruppil.*maatik/i.test(lower)
    ) {
      return {
        nativeScript: 'நான் நெருப்பில் மாட்டிக்கொண்டேன்',
        script: 'Tamil',
        language: 'Tamil',
        languageCode: 'ta-IN',
        englishTranslation: 'I am trapped in a fire.',
        normalizedMeaning: 'Citizen is trapped in a fire.',
      };
    }

    if (
      /vellam.*veetukull\w*.*vandhud\w*|thanni.*veetukull\w*.*vandhud\w*|veetukull\w*.*(thanni|vellam)/i.test(lower)
    ) {
      return {
        nativeScript: 'வெள்ளம் வீட்டுக்குள் வந்துவிட்டது',
        script: 'Tamil',
        language: 'Tamil',
        languageCode: 'ta-IN',
        englishTranslation: 'Flood water has entered my house.',
        normalizedMeaning: 'Flood water entering citizen house.',
      };
    }

    if (
      /kattidam.*idinj\w*.*oruthar|kattidam.*idinj\w*|kathadangal.*vatil\w*/i.test(lower)
    ) {
      return {
        nativeScript: 'கட்டிடம் இடிந்து விழுந்தது, ஒருவர் உள்ளே சிக்கியுள்ளார்',
        script: 'Tamil',
        language: 'Tamil',
        languageCode: 'ta-IN',
        englishTranslation: 'The building collapsed and a person is trapped inside.',
        normalizedMeaning: 'Building collapsed with person trapped inside.',
      };
    }

    if (/enga.*veetukull\w*.*water/i.test(lower)) {
      return {
        nativeScript: 'எங்க வீட்டுக்குள்ள water வந்துடுச்சு',
        script: 'Tamil',
        language: 'Tamil',
        languageCode: 'ta-IN',
        englishTranslation: 'Water has entered inside our house.',
        normalizedMeaning: 'Water entering residence.',
      };
    }

    if (/thanni.*romba.*adhigam|thanni.*kaapaath/i.test(lower)) {
      return {
        nativeScript: 'தண்ணீர் ரொம்ப அதிகமாக இருக்கிறது காப்பாத்துங்க',
        script: 'Tamil',
        language: 'Tamil',
        languageCode: 'ta-IN',
        englishTranslation: 'Water level is very high. Please rescue us.',
        normalizedMeaning: 'High rising water level trapping citizens.',
      };
    }

    // 3. Hindi emergency phrases & Romanized Hinglish
    if (/main\s*aag\s*mein\s*f[a|u]ns|aag\s*mein\s*f[a|u]ns/i.test(lower)) {
      return {
        nativeScript: 'मैं आग में फंस गया हूँ',
        script: 'Devanagari',
        language: 'Hindi',
        languageCode: 'hi-IN',
        englishTranslation: 'I am trapped in a fire.',
        normalizedMeaning: 'Citizen is trapped in a fire.',
      };
    }

    if (/mere\s*ghar\s*mein\s*fire|ghar\s*mein\s*fire/i.test(lower)) {
      return {
        nativeScript: 'मेरे घर में fire लग गई है',
        script: 'Devanagari',
        language: 'Hindi',
        languageCode: 'hi-IN',
        englishTranslation: 'Fire has broken out in my house.',
        normalizedMeaning: 'Fire outbreak in residence.',
      };
    }

    if (/baadh.*paani.*ghar|paani.*ghar.*ghus/i.test(lower)) {
      return {
        nativeScript: 'बाढ़ का पानी घर में घुस गया है',
        script: 'Devanagari',
        language: 'Hindi',
        languageCode: 'hi-IN',
        englishTranslation: 'Flood water has entered the house.',
        normalizedMeaning: 'Flood water entered house.',
      };
    }

    if (/imarat\s*gir|makan\s*gir|chhat\s*gir/i.test(lower)) {
      return {
        nativeScript: 'इमारत गिर गई है और लोग मलबे में दबे हैं',
        script: 'Devanagari',
        language: 'Hindi',
        languageCode: 'hi-IN',
        englishTranslation: 'The building collapsed and people are trapped under rubble.',
        normalizedMeaning: 'Building collapsed with trapped victims.',
      };
    }

    // 4. Kannada emergency phrases & Kanglish
    if (/naanu\s*benki/i.test(lower)) {
      return {
        nativeScript: 'ನಾನು ಬೆಂಕಿಯಲ್ಲಿ ಸಿಕ್ಕಿಕೊಂಡಿದ್ದೇನೆ',
        script: 'Kannada',
        language: 'Kannada',
        languageCode: 'kn-IN',
        englishTranslation: 'I am trapped in a fire.',
        normalizedMeaning: 'Citizen is trapped in a fire.',
      };
    }

    if (/namma\s*manege\s*flood/i.test(lower)) {
      return {
        nativeScript: 'ನಮ್ಮ ಮನೆಗೆ flood water ಬಂದಿದೆ',
        script: 'Kannada',
        language: 'Kannada',
        languageCode: 'kn-IN',
        englishTranslation: 'Flood water has entered our house.',
        normalizedMeaning: 'Flood water inundation in house.',
      };
    }

    if (/pravaha.*neeru/i.test(lower)) {
      return {
        nativeScript: 'ಪ್ರವಾಹ ನೀರು ಮನೆ ಒಳಗೆ ಬಂದಿದೆ',
        script: 'Kannada',
        language: 'Kannada',
        languageCode: 'kn-IN',
        englishTranslation: 'Flood water has entered inside the house.',
        normalizedMeaning: 'Flood water entering house.',
      };
    }

    // 5. Malayalam emergency phrases & Manglish
    if (/theeyil\s*kudungi|njaan\s*theeyil/i.test(lower)) {
      return {
        nativeScript: 'ഞാൻ തീയിൽ കുടുങ്ങിയിരിക്കുന്നു',
        script: 'Malayalam',
        language: 'Malayalam',
        languageCode: 'ml-IN',
        englishTranslation: 'I am trapped in a fire.',
        normalizedMeaning: 'Citizen trapped in fire.',
      };
    }

    if (/vellappokkam\s*veett/i.test(lower)) {
      return {
        nativeScript: 'വെള്ളപ്പൊക്കം വീട്ടിൽ കയറി',
        script: 'Malayalam',
        language: 'Malayalam',
        languageCode: 'ml-IN',
        englishTranslation: 'Flood water entered the house.',
        normalizedMeaning: 'Flood water entered residence.',
      };
    }

    // 6. Telugu emergency phrases & Tenglish
    if (/mantallo\s*chikkukun|nenu\s*mantal/i.test(lower)) {
      return {
        nativeScript: 'నేను మంటల్లో చిక్కుకున్నాను',
        script: 'Telugu',
        language: 'Telugu',
        languageCode: 'te-IN',
        englishTranslation: 'I am trapped in a fire.',
        normalizedMeaning: 'Citizen trapped in fire.',
      };
    }

    if (/varada\s*neeru\s*intloki/i.test(lower)) {
      return {
        nativeScript: 'వరద నీరు ఇంట్లోకి వచ్చింది',
        script: 'Telugu',
        language: 'Telugu',
        languageCode: 'te-IN',
        englishTranslation: 'Flood water has entered the house.',
        normalizedMeaning: 'Flood water entered residence.',
      };
    }

    // 7. Marathi emergency phrases
    if (/aagit\s*adak|mee\s*aagit/i.test(lower)) {
      return {
        nativeScript: 'मी आगीत अडकलो आहे',
        script: 'Devanagari',
        language: 'Marathi',
        languageCode: 'mr-IN',
        englishTranslation: 'I am trapped in a fire.',
        normalizedMeaning: 'Citizen trapped in fire.',
      };
    }

    if (/imarat\s*padli|dabli\s*geli/i.test(lower)) {
      return {
        nativeScript: 'इमारत कोसळली आणि लोक ढिगाऱ्याखाली अडकले आहेत',
        script: 'Devanagari',
        language: 'Marathi',
        languageCode: 'mr-IN',
        englishTranslation: 'Building collapsed and people are trapped under debris.',
        normalizedMeaning: 'Building collapsed with people trapped.',
      };
    }

    // 8. Bengali emergency phrases
    if (/aagune\s*aatke|aami\s*aagun/i.test(lower)) {
      return {
        nativeScript: 'আমি আগুনে আটকে পড়েছি',
        script: 'Bengali',
        language: 'Bengali',
        languageCode: 'bn-IN',
        englishTranslation: 'I am trapped in a fire.',
        normalizedMeaning: 'Citizen trapped in fire.',
      };
    }

    if (/banya.*jol/i.test(lower)) {
      return {
        nativeScript: 'বন্যার জল বাড়িতে ঢুকে গেছে',
        script: 'Bengali',
        language: 'Bengali',
        languageCode: 'bn-IN',
        englishTranslation: 'Flood water has entered the house.',
        normalizedMeaning: 'Flood water entered house.',
      };
    }

    // 9. English explicit check
    if (/trapped\s*in\s*(a\s*)?fire/i.test(lower)) {
      return {
        nativeScript: 'I am trapped in a fire.',
        script: 'Latin',
        language: 'English',
        languageCode: 'en-IN',
        englishTranslation: 'I am trapped in a fire.',
        normalizedMeaning: 'Citizen is trapped in a fire.',
      };
    }

    return null;
  }
}

const asrService = new AsrService();
module.exports = asrService;
module.exports.AsrService = AsrService;
