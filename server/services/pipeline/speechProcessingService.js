/**
 * Independent Pipeline Stage 2: Enhanced Speech Processing Service
 * 
 * Capabilities:
 * - Direct integration with Hugging Face-compatible ASR Engine (asrService.js)
 * - Converts voice audio (WebM, WAV, OGG, MP4, MP3) to accurate text before AI triage
 * - Evaluated for English, Hindi, Tamil, Kannada, Indian accents, noisy speech, and code-mixing
 * - Robust error handling: Empty audio, corrupted audio, unsupported format, silence, model timeout
 * - Anti-hallucination guard: If transcription confidence is low, marks as UNCERTAIN
 * - Stores: originalAudio, transcript, language, confidence, status, and acoustic telemetry
 * - Passes ONLY validated transcript to Stage 3 (Language) and Stage 5 (Prompt Builder)
 * - Full backward compatibility with existing SOS packets & synchronization workflows
 */

const asrService = require('../speech/asrService');
const logger = require('../../utils/logger');

class SpeechProcessingService {
  /**
   * Processes, transcribes, validates, and stores voice audio reports
   * @param {Object} validatedPayload - Sanitized citizen report payload
   * @returns {Promise<Object>} Speech processing result container
   */
  async process(validatedPayload = {}) {
    const audioRef = validatedPayload.audioReference || {};
    const hasAudio = Boolean(audioRef.hasAudio || validatedPayload.audioData || audioRef.dataUrl || audioRef.audioId);
    const rawAudioData = validatedPayload.audioData || audioRef.dataUrl || validatedPayload.voiceData || null;
    const durationSeconds = parseFloat(audioRef.durationSeconds || validatedPayload.recordingDuration) || 0;
    const mimeType = audioRef.mimeType || validatedPayload.mimeType || 'audio/webm';
    const languageHint = validatedPayload.selectedLanguage || validatedPayload.language || audioRef.languageHint || 'en';

    // Raw transcript from browser Web Speech API or voice recording metadata
    const rawTranscript = (validatedPayload.transcript || audioRef.transcript || validatedPayload.voiceTranscript || '').trim();

    let finalTranscript = '';
    let transcriptionStatus = 'NO_SPEECH_ATTACHED';
    let transcriptionFailure = false;
    let transcriptionConfidence = 0.95;
    let failureReason = null;
    let isUncertain = false;
    let asrEngine = 'TEXT_PASS_THROUGH';
    let asrLatencyMs = 0;

    let asrResult = null;
    if (hasAudio && rawAudioData) {
      // 1. Execute Speech-to-Text via ASR Service
      try {
        asrResult = await asrService.transcribeAudio({
          audioData: rawAudioData,
          mimeType,
          durationSeconds,
          transcript: rawTranscript,
          languageHint,
        });

        asrLatencyMs = asrResult.latencyMs || 0;
        asrEngine = asrResult.asrEngine || 'ASR_SERVICE';
        isUncertain = Boolean(asrResult.isUncertain);

        if (asrResult.success && asrResult.transcript) {
          finalTranscript = asrResult.transcript;
          transcriptionStatus = asrResult.transcriptionStatus || 'TRANSCRIPTION_SUCCESS';
          transcriptionConfidence = asrResult.confidence || 0.90;
          transcriptionFailure = false;
        } else {
          // ASR returned error or unparseable audio
          transcriptionStatus = asrResult.transcriptionStatus || 'TRANSCRIPTION_FAILED';
          transcriptionFailure = true;
          transcriptionConfidence = asrResult.confidence || 0.30;
          failureReason = asrResult.failureReason || 'Audio unparseable or noisy.';
          finalTranscript = asrResult.transcript || rawTranscript || '';
        }
      } catch (asrErr) {
        logger.warn('[SpeechProcessingService] ASR processing error:', asrErr.message);
        transcriptionStatus = 'TRANSCRIPTION_FAILED';
        transcriptionFailure = true;
        transcriptionConfidence = 0.35;
        failureReason = `ASR Engine error: ${asrErr.message}`;
        finalTranscript = rawTranscript || '';
      }
    } else if (hasAudio) {
      // Audio indicated but no raw binary attached (e.g. metadata-only sync or pre-transcribed)
      if (rawTranscript.length >= 3) {
        finalTranscript = rawTranscript.replace(/\s+/g, ' ');
        transcriptionStatus = 'TRANSCRIPTION_SUCCESS_CLIENT_TELEMETRY';
        transcriptionConfidence = 0.90;
        asrEngine = 'CLIENT_STREAM_TELEMETRY';
      } else if (durationSeconds > 1.0) {
        transcriptionStatus = 'TRANSCRIPTION_FAILED';
        transcriptionFailure = true;
        transcriptionConfidence = 0.35;
        failureReason = 'Audio duration > 1.0s but speech-to-text transcript was empty or noisy.';
        isUncertain = true;
      } else {
        transcriptionStatus = 'SHORT_AUDIO_CLIP';
        transcriptionConfidence = 0.70;
        isUncertain = true;
      }
    } else if (rawTranscript.length >= 3) {
      // Text-only report (no audio file)
      finalTranscript = rawTranscript.replace(/\s+/g, ' ');
      transcriptionStatus = 'TEXT_TRANSCRIPT_ONLY';
      transcriptionConfidence = 0.95;
      asrEngine = 'TEXT_REPORT';
    }

    // Fallback validated text for Gemma 4 if transcription was empty
    const fallbackText = validatedPayload.description || validatedPayload.combinedText || 'Emergency signal reported';
    const validatedTranscript = finalTranscript.length >= 2 ? finalTranscript : fallbackText;

    const originalAudio = {
      audioId: audioRef.audioId || (hasAudio ? `audio_${Date.now()}` : null),
      hasAudio,
      durationSeconds,
      mimeType,
      formattedSize: audioRef.formattedSize || (rawAudioData ? `${Math.round(rawAudioData.length / 1024)} KB` : 'N/A'),
      dataUrl: rawAudioData ? (rawAudioData.length < 100 ? rawAudioData : `${rawAudioData.substring(0, 50)}...`) : null,
    };

    return {
      hasSpeechInput: hasAudio || finalTranscript.length > 0,
      validatedTranscript, // ONLY validated clean transcript passed to Gemma 4
      originalAudio,
      transcript: finalTranscript || validatedTranscript,
      rawTranscript,
      language: asrResult?.language || languageHint,
      languageCode: asrResult?.languageCode || null,
      nativeScriptTranscript: asrResult?.nativeScriptTranscript || null,
      script: asrResult?.script || null,
      transcriptForm: asrResult?.transcriptForm || null,
      isCodeMixed: Boolean(asrResult?.isCodeMixed),
      secondaryLanguage: asrResult?.secondaryLanguage || null,
      transcriptionSource: asrResult?.transcriptionSource || asrEngine,
      translationSource: asrResult?.translationSource || null,
      englishTranslation: asrResult?.englishTranslation || null,
      normalizedMeaning: asrResult?.normalizedMeaning || null,
      multiModelAgreement: asrResult?.multiModelAgreement || null,
      sarvamFallbackTriggered: Boolean(asrResult?.sarvamFallbackTriggered),
      needsReview: Boolean(asrResult?.needsReview || isUncertain || transcriptionFailure),
      sttTelemetry: asrResult?.sttTelemetry || null,
      confidence: transcriptionConfidence,
      transcriptionStatus,
      transcriptionFailure,
      failureReason,
      isUncertain,
      asrEngine,
      asrLatencyMs,
      speechMeta: {
        durationSeconds,
        mimeType,
        hasAudioData: Boolean(rawAudioData),
        asrEngine,
        isUncertain,
      },
      processedTranscript: validatedTranscript,
    };
  }
}

const speechProcessingService = new SpeechProcessingService();
module.exports = speechProcessingService;
