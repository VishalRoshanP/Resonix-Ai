/**
 * Sarvam AI REST Client Adapter for RESONIX AI
 * 
 * Capabilities:
 * - Server-side Speech-to-Text (Saaras v3 / v4) via POST https://api.sarvam.ai/speech-to-text
 * - Server-side Multilingual Translation via POST https://api.sarvam.ai/translate
 * - Strict Security: SARVAM_API_KEY is never logged, exposed to frontend, or serialized in responses.
 * - Defensive Error Isolation: Gracefully handles 401, 402/403 (credit exhaustion), 429, 5xx, and timeouts.
 * - ZERO Single Point of Failure: Failure in Sarvam NEVER halts emergency SOS delivery.
 */

const sarvamConfig = require('../../config/sarvam');
const logger = require('../../utils/logger');

const SARVAM_LANG_MAP = {
  'ta-IN': { name: 'Tamil', script: 'Tamil' },
  'hi-IN': { name: 'Hindi', script: 'Devanagari' },
  'kn-IN': { name: 'Kannada', script: 'Kannada' },
  'te-IN': { name: 'Telugu', script: 'Telugu' },
  'ml-IN': { name: 'Malayalam', script: 'Malayalam' },
  'mr-IN': { name: 'Marathi', script: 'Devanagari' },
  'bn-IN': { name: 'Bengali', script: 'Bengali' },
  'gu-IN': { name: 'Gujarati', script: 'Gujarati' },
  'pa-IN': { name: 'Punjabi', script: 'Gurmukhi' },
  'od-IN': { name: 'Odia', script: 'Odia' },
  'en-IN': { name: 'English', script: 'Latin' },
};

class SarvamClient {
  constructor(config = sarvamConfig) {
    this.config = config;
    this.circuitOpenUntil = 0;
    this.failureCount = 0;
    this.CIRCUIT_COOLDOWN_MS = 60000;
    this.MAX_FAILURES = 3;
  }

  /**
   * Check if circuit breaker is currently open (cooling down)
   */
  isCircuitOpen() {
    return Date.now() < this.circuitOpenUntil;
  }

  /**
   * Record failure and conditionally trip circuit breaker
   */
  recordFailure(isFatal = false) {
    this.failureCount++;
    if (isFatal || this.failureCount >= this.MAX_FAILURES) {
      this.circuitOpenUntil = Date.now() + this.CIRCUIT_COOLDOWN_MS;
      logger.warn(`[SarvamClient] Circuit breaker tripped. Cooling down for ${this.CIRCUIT_COOLDOWN_MS / 1000}s`);
    }
  }

  /**
   * Record successful call and reset circuit breaker
   */
  recordSuccess() {
    this.failureCount = 0;
    this.circuitOpenUntil = 0;
  }

  /**
   * Check if Sarvam client is ready and configured
   * @returns {boolean}
   */
  isConfigured() {
    return this.config.isConfigured();
  }

  /**
   * Transcribe audio using Sarvam Saaras API
   * @param {Object} params
   * @param {Buffer|string} params.audioData - Raw audio buffer or base64 dataUrl
   * @param {string} [params.mimeType] - Audio MIME type (e.g. 'audio/wav', 'audio/webm')
   * @param {string} [params.languageCode] - Language hint (e.g. 'ta-IN', 'hi-IN', 'unknown')
   * @param {string} [params.mode] - 'transcribe' | 'translate' | 'codemix' | 'translit' | 'verbatim'
   * @param {string} [params.model] - Model override (defaults to config.transcribeModel)
   * @param {number} [params.timeoutMs] - Request timeout
   * @returns {Promise<Object>} Structured transcription result
   */
  async transcribeAudio(params = {}) {
    const startTime = Date.now();

    if (!this.isConfigured()) {
      return {
        success: false,
        transcript: '',
        languageCode: 'unknown',
        detectedLanguage: 'unknown',
        script: 'Unknown',
        errorCode: 'NOT_CONFIGURED',
        error: 'Sarvam API key is not configured in server/.env.',
        latencyMs: 0,
        provider: 'sarvam',
      };
    }

    if (this.isCircuitOpen()) {
      logger.warn('[SarvamClient] Circuit breaker active. Skipping Sarvam Saaras fallback.');
      return {
        success: false,
        transcript: '',
        languageCode: 'unknown',
        detectedLanguage: 'unknown',
        script: 'Unknown',
        errorCode: 'CIRCUIT_OPEN',
        error: 'Sarvam circuit breaker is open (cooling down).',
        latencyMs: 0,
        provider: 'sarvam',
      };
    }

    const apiKey = this.config.apiKey;
    const targetModel = params.model || this.config.transcribeModel || 'saaras:v4';
    const languageCode = params.languageCode || 'unknown';
    const mode = params.mode || 'transcribe';
    const timeoutMs = params.timeoutMs || this.config.timeoutMs || 15000;

    // Normalize audio buffer
    let audioBuffer = null;
    let mimeType = params.mimeType || 'audio/wav';

    try {
      if (Buffer.isBuffer(params.audioData)) {
        audioBuffer = params.audioData;
      } else if (typeof params.audioData === 'string') {
        let cleanBase64 = params.audioData;
        if (cleanBase64.includes(',')) {
          const parts = cleanBase64.split(',');
          const mimeMatch = parts[0].match(/data:(.*?);/);
          if (mimeMatch) mimeType = mimeMatch[1];
          cleanBase64 = parts[1];
        }
        audioBuffer = Buffer.from(cleanBase64, 'base64');
      }

      if (!audioBuffer || audioBuffer.length < 32) {
        return {
          success: false,
          transcript: '',
          languageCode: 'unknown',
          detectedLanguage: 'unknown',
          script: 'Unknown',
          errorCode: 'INVALID_AUDIO',
          error: 'Audio buffer is empty or corrupted.',
          latencyMs: Date.now() - startTime,
          provider: 'sarvam',
        };
      }

      const fileExtension = mimeType.includes('webm')
        ? 'webm'
        : (mimeType.includes('wav') ? 'wav' : (mimeType.includes('mp4') || mimeType.includes('m4a') ? 'm4a' : 'ogg'));
      const fileName = `speech_${Date.now()}.${fileExtension}`;

      // Build multipart/form-data using standard FormData & Blob
      const formData = new FormData();
      const audioBlob = new Blob([audioBuffer], { type: mimeType });
      formData.append('file', audioBlob, fileName);
      formData.append('model', targetModel);
      if (languageCode && languageCode !== 'unknown' && languageCode !== 'auto') {
        formData.append('language_code', languageCode);
      }
      if (mode) {
        formData.append('mode', mode);
      }

      const endpoint = `${this.config.baseUrl}${this.config.endpoints.speechToText}`;
      logger.info(`[SarvamClient] Invoking Sarvam Saaras STT [${targetModel}] (${audioBuffer.length} bytes, langHint: ${languageCode}, mode: ${mode})`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'api-subscription-key': apiKey,
        },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        let errorCode = `HTTP_${response.status}`;
        let errorMessage = `Sarvam API HTTP ${response.status}`;

        const isFatal = response.status === 401 || response.status === 402 || response.status === 403;
        this.recordFailure(isFatal);

        if (response.status === 401) {
          errorCode = 'AUTH_FAILED';
          errorMessage = 'Sarvam authentication failed. Please verify SARVAM_API_KEY in server/.env.';
          logger.warn(`[SarvamClient] Authentication error (401). Skipping Sarvam gracefully.`);
        } else if (response.status === 402 || response.status === 403) {
          errorCode = 'CREDIT_EXHAUSTED';
          errorMessage = 'Sarvam account credits exhausted or payment required.';
          logger.warn(`[SarvamClient] Credit exhaustion / quota status (${response.status}). Skipping Sarvam gracefully.`);
        } else if (response.status === 429) {
          errorCode = 'RATE_LIMITED';
          errorMessage = 'Sarvam rate limit reached.';
          logger.warn(`[SarvamClient] Rate limited (429). Skipping Sarvam gracefully.`);
        } else {
          logger.warn(`[SarvamClient] Request failed (${response.status}): ${errorText.substring(0, 200)}`);
        }

        return {
          success: false,
          transcript: '',
          languageCode: 'unknown',
          detectedLanguage: 'unknown',
          script: 'Unknown',
          errorCode,
          error: errorMessage,
          statusCode: response.status,
          latencyMs,
          provider: 'sarvam',
        };
      }

      const data = await response.json();
      const transcript = (data.transcript || '').trim();
      const detectedLangCode = data.language_code || languageCode || 'unknown';
      const langMapping = SARVAM_LANG_MAP[detectedLangCode] || { name: 'Unknown', script: 'Unknown' };

      if (transcript) {
        this.recordSuccess();
      } else {
        this.recordFailure(false);
      }

      logger.info(`[SarvamClient] Sarvam Saaras succeeded in ${latencyMs}ms (Lang: ${detectedLangCode}, Transcript: "${transcript.substring(0, 60)}...")`);

      return {
        success: Boolean(transcript),
        transcript,
        rawTranscript: transcript,
        languageCode: detectedLangCode,
        detectedLanguageCode: detectedLangCode,
        language: langMapping.name,
        detectedLanguage: langMapping.name,
        script: langMapping.script,
        confidence: transcript ? 0.95 : 0.20,
        requestId: data.request_id || null,
        model: targetModel,
        mode: mode || 'transcribe',
        latencyMs,
        provider: 'sarvam',
        errorCode: null,
      };
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      const isAbort = err.name === 'AbortError' || err.message.includes('abort');
      const errorCode = isAbort ? 'TIMEOUT' : 'NETWORK_ERROR';
      this.recordFailure(false);
      logger.warn(`[SarvamClient] Exception during STT execution: ${err.message} (${errorCode})`);

      return {
        success: false,
        transcript: '',
        languageCode: 'unknown',
        detectedLanguage: 'unknown',
        script: 'Unknown',
        errorCode,
        error: err.message,
        latencyMs,
        provider: 'sarvam',
      };
    }
  }

  /**
   * Translate text using Sarvam Mayura / Sarvam-Translate API
   * @param {Object} params
   * @param {string} params.input - Text to translate
   * @param {string} [params.sourceLanguageCode] - BCP-47 source language code (e.g. 'ta-IN', 'hi-IN', 'auto')
   * @param {string} [params.targetLanguageCode] - BCP-47 target language code (default: 'en-IN')
   * @param {string} [params.model] - Model name (e.g. 'mayura:v1' or 'sarvam-translate:v1')
   * @returns {Promise<Object>}
   */
  async translateText(params = {}) {
    const startTime = Date.now();
    const input = (params.input || '').trim();

    if (!input) {
      return { success: false, translatedText: '', error: 'Input text is empty.', latencyMs: 0 };
    }

    if (!this.isConfigured()) {
      return {
        success: false,
        translatedText: '',
        errorCode: 'NOT_CONFIGURED',
        error: 'Sarvam API key not configured.',
        latencyMs: 0,
      };
    }

    if (this.isCircuitOpen()) {
      logger.warn('[SarvamClient] Circuit breaker active. Skipping Sarvam translation.');
      return {
        success: false,
        translatedText: '',
        errorCode: 'CIRCUIT_OPEN',
        error: 'Sarvam circuit breaker is open (cooling down).',
        latencyMs: 0,
        provider: 'sarvam',
      };
    }

    try {
      const endpoint = `${this.config.baseUrl}${this.config.endpoints.translate}`;
      const payload = {
        input,
        source_language_code: params.sourceLanguageCode || 'auto',
        target_language_code: params.targetLanguageCode || 'en-IN',
        model: params.model || 'mayura:v1',
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-subscription-key': this.config.apiKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const errorText = await response.text();
        const isFatal = response.status === 401 || response.status === 402 || response.status === 403;
        this.recordFailure(isFatal);
        logger.warn(`[SarvamClient] Translation error (${response.status}): ${errorText.substring(0, 150)}`);
        return {
          success: false,
          translatedText: '',
          statusCode: response.status,
          error: `HTTP ${response.status}`,
          latencyMs,
        };
      }

      const data = await response.json();
      const translatedText = (data.translated_text || '').trim();

      if (translatedText) {
        this.recordSuccess();
      }

      return {
        success: Boolean(translatedText),
        translatedText,
        sourceLanguageCode: data.source_language_code || params.sourceLanguageCode,
        requestId: data.request_id || null,
        latencyMs,
        provider: 'sarvam',
      };
    } catch (err) {
      this.recordFailure(false);
      logger.warn(`[SarvamClient] Translate exception: ${err.message}`);
      return {
        success: false,
        translatedText: '',
        error: err.message,
        latencyMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Identify language using Sarvam /text-lid
   * @param {string} input - Text to identify language of
   * @returns {Promise<Object|null>} { success, languageCode, language, script, confidence }
   */
  async identifyLanguage(input = '') {
    const text = (input || '').trim();
    if (!text || !this.isConfigured() || this.isCircuitOpen()) return null;

    try {
      const endpoint = `${this.config.baseUrl}/text-lid`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-subscription-key': this.config.apiKey,
        },
        body: JSON.stringify({ input: text.substring(0, 500) }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const isFatal = response.status === 401 || response.status === 402 || response.status === 403;
        this.recordFailure(isFatal);
        return null;
      }

      const data = await response.json();
      this.recordSuccess();
      const detectedLangCode = data.language_code || 'unknown';
      const langMapping = SARVAM_LANG_MAP[detectedLangCode] || { name: 'Unknown', script: 'Unknown' };

      return {
        success: true,
        languageCode: detectedLangCode,
        language: langMapping.name,
        script: data.script || langMapping.script,
        confidence: 0.95,
      };
    } catch (_) {
      this.recordFailure(false);
      return null;
    }
  }

  /**
   * Alias for transcribeAudio
   */
  async speechToText(params = {}) {
    return this.transcribeAudio(params);
  }

  /**
   * Alias for translateText
   */
  async translate(params = {}) {
    return this.translateText(params);
  }
}

const sarvamClient = new SarvamClient();
module.exports = sarvamClient;
module.exports.SarvamClient = SarvamClient;
module.exports.SARVAM_LANG_MAP = SARVAM_LANG_MAP;

