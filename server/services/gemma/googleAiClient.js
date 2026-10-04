/**
 * Google AI Studio / Gemini API Client Adapter for RESONIX AI
 * Target Model: gemma-4-26b-a4b-it
 * 
 * Provides production-ready API integration with Google AI Studio API:
 * - Structured text inference
 * - Native JSON mode (`responseMimeType: "application/json"`)
 * - Multimodal vision/telemetry payload evaluation
 * - Backoff retries & cancellation timeouts
 * 
 * Security Rule: GEMINI_API_KEY remains exclusively on Node.js backend environment.
 */

const gemmaConfig = require('../../config/gemma');
const aiModelConfig = require('../../config/aiModels');
const logger = require('../../utils/logger');

class GoogleAiClient {
  constructor(config = gemmaConfig, modelRegistry = aiModelConfig) {
    this.config = config;
    this.modelRegistry = modelRegistry;
  }

  /**
   * Executes text inference using Google AI Studio REST API
   * @param {string|Object} prompt - Input text or prompt payload
   * @param {Object} [options] - Options (jsonMode, maxRetries, timeoutMs)
   * @returns {Promise<Object>} Formatted inference result or error object
   */
  async generateText(prompt, options = {}) {
    const apiKey = this.config.geminiApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey || !apiKey.trim()) {
      logger.warn('[GoogleAiClient] GEMINI_API_KEY is missing from server/.env.');
      return this._formatStructuredError({
        code: 'GOOGLE_AI_KEY_MISSING',
        message: 'GEMINI_API_KEY is not configured in server/.env.',
        statusCode: 500,
        attempts: 0,
      });
    }

    const modelName = options.model || this.config.gemmaModel || 'gemma-4-26b-a4b-it';
    const baseUrl = this.config.googleAiBaseUrl || 'https://generativelanguage.googleapis.com/v1beta';
    const url = `${baseUrl}/models/${modelName}:generateContent?key=${apiKey}`;

    const promptText = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);

    const parts = [];
    if (options.images && Array.isArray(options.images)) {
      options.images.forEach((img) => {
        let cleanData = img;
        let mimeType = 'image/jpeg';
        if (img.startsWith('data:')) {
          const splitParts = img.split(',');
          const mimeMatch = splitParts[0].match(/data:(.*?);/);
          if (mimeMatch) mimeType = mimeMatch[1];
          cleanData = splitParts[1];
        }
        parts.push({
          inlineData: {
            mimeType,
            data: cleanData,
          },
        });
      });
    }

    parts.push({ text: promptText });

    const payload = {
      contents: [{ parts }],
      generationConfig: {
        temperature: options.temperature ?? this.config?.defaultParams?.temperature ?? 0.2,
        topP: options.top_p ?? this.config?.defaultParams?.top_p ?? 0.95,
        maxOutputTokens: options.maxTokens ?? this.config?.defaultParams?.maxOutputTokens ?? 4096,
        ...(options.jsonMode ? { responseMimeType: 'application/json' } : {}),
      },
    };

    const maxRetries = options.maxRetries || this.config.maxRetries;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const promptLength = promptText.length;
        logger.info(`[GoogleAiClient] Invoking Google AI Studio model '${modelName}' (Attempt ${attempt}/${maxRetries}, prompt: ${promptLength} chars${options.jsonMode ? ', JSON mode' : ''})`);

        const startTime = Date.now();
        const response = await this._fetchWithTimeout(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }, options.timeoutMs || this.config.timeoutMs);

        const latencyMs = Date.now() - startTime;

        if (!response.ok) {
          const errorText = await response.text();
          let errJson = null;
          try { errJson = JSON.parse(errorText); } catch (_) {}
          const errMsg = errJson?.error?.message || `HTTP ${response.status}: ${errorText}`;
          const err = new Error(`Google AI Studio Error (${response.status}): ${errMsg}`);
          err.statusCode = response.status;
          err.attempt = attempt;
          throw err;
        }

        const data = await response.json();
        const candidate = data.candidates?.[0];
        const generatedText = candidate?.content?.parts?.[0]?.text || '';

        logger.info(`[GoogleAiClient] Google AI Studio model '${modelName}' inference succeeded in ${latencyMs}ms (${generatedText.length} chars generated)`);

        return {
          success: true,
          generated_text: generatedText,
          response: generatedText,
          text: generatedText,
          model: modelName,
          provider: 'google',
          latencyMs,
          finishReason: candidate?.finishReason || 'STOP',
        };
      } catch (error) {
        lastError = error;
        logger.warn(`[GoogleAiClient] Attempt ${attempt}/${maxRetries} failed: ${error.message}`);

        if (attempt < maxRetries) {
          const delay = this.config.retryDelayMs * Math.pow(2, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    return this._formatStructuredError(lastError, maxRetries);
  }

  /**
   * Executes JSON-enforced inference via Google AI Studio API
   */
  async generateJson(prompt, options = {}) {
    return this.generateText(prompt, {
      ...options,
      jsonMode: true,
    });
  }

  /**
   * Transcribes audio using Google AI Studio Multilingual Speech API (gemini-3.5-transcribe)
   */
  async transcribeAudio({ audioData, mimeType = 'audio/webm', languageHint = null }, options = {}) {
    try {
      const apiKey = this.config.geminiApiKey || process.env.GEMINI_API_KEY;
      if (!apiKey || !apiKey.trim()) {
        return this._formatStructuredError({
          code: 'GOOGLE_AI_KEY_MISSING',
          message: 'GEMINI_API_KEY is not configured in server/.env.',
        });
      }

      let cleanBase64 = audioData || '';
      let detectedMime = mimeType || 'audio/webm';
      if (cleanBase64.includes(',')) {
        const parts = cleanBase64.split(',');
        const mimeMatch = parts[0].match(/data:(.*?);/);
        if (mimeMatch) detectedMime = mimeMatch[1];
        cleanBase64 = parts[1];
      }
      if (detectedMime === 'audio/m4a') {
        detectedMime = 'audio/mp4';
      }

      const promptText = `You are Gemini 3.5 Transcribe, the official Speech-to-Text and Acoustic Multilingual Language Identification Engine for RESONIX AI.
Listen to the attached audio recording and transcribe the exact spoken words in their true native script.

MANDATORY RULES:
1. Detect the spoken language directly from the AUDIO. Do NOT assume English or Latin.
2. Produce the transcript in the true native script of the spoken language:
   - Tamil speech MUST be transcribed in Tamil script (தமிழ், e.g. "நான் நெருப்பில் மாட்டிக்கொண்டேன்", "வெள்ளம் வீட்டுக்குள் வந்துவிட்டது"). Do NOT output Latin transliterations (such as "Non nerpil Marti kundan") as the primary native transcript.
   - Hindi speech MUST be transcribed in Devanagari script (देवनागरी, e.g. "मैं आग में फंस गया हूँ", "बाढ़ का पानी घर में आ गया है").
   - Kannada speech MUST be transcribed in Kannada script (ಕನ್ನಡ, e.g. "ನಾನು ಬೆಂಕಿಯಲ್ಲಿ ಸಿಕ್ಕಿಕೊಂಡಿದ್ದೇನೆ").
   - Telugu speech MUST be transcribed in Telugu script (తెలుగు, e.g. "నేను మంటల్లో చిక్కుకున్నాను").
   - Malayalam speech MUST be transcribed in Malayalam script (മലയാളം, e.g. "ഞാൻ തീയിൽ കുടുങ്ങിയിരിക്കുന്നു").
   - Marathi speech MUST be transcribed in Devanagari script (मराठी, e.g. "मी आगीत अडकलो आहे").
   - Bengali speech MUST be transcribed in Bengali script (বাংলা, e.g. "আমি আগুনে আটকে পড়েছি").
   - English speech MUST be transcribed in Latin script (e.g. "I am trapped in a fire.").
3. For code-switched speech (e.g. Tamil sentence with English emergency vocabulary), preserve the code-switching while identifying the primary language as Tamil.
4. "englishTranslation": Provide a direct, faithful English translation capturing emergency hazards, trapped persons, location, urgency. NEVER return generic phrases like "Emergency assistance requested" when meaningful speech exists.
5. "normalizedMeaning": Concise operational interpretation for emergency responders (e.g. "Citizen is trapped in a fire.").
6. "script": Specific script name ("Tamil", "Devanagari", "Kannada", "Telugu", "Malayalam", "Bengali", "Latin").
7. "languageCode": Standard BCP-47 language code ("ta-IN", "hi-IN", "kn-IN", "te-IN", "ml-IN", "mr-IN", "bn-IN", "en-IN").
8. "confidence": Numeric confidence score between 0.0 and 1.0.

Return ONLY valid JSON matching this schema:
{
  "originalTranscript": "Verbatim transcript in the true native script of the spoken language",
  "nativeScriptTranscript": "Verbatim transcript in the true native script",
  "language": "Tamil | Hindi | Telugu | Kannada | Malayalam | Marathi | Bengali | English | Other",
  "languageCode": "ta-IN | hi-IN | te-IN | kn-IN | ml-IN | mr-IN | bn-IN | en-IN | unknown",
  "script": "Tamil | Devanagari | Kannada | Telugu | Malayalam | Bengali | Latin",
  "confidence": 0.95,
  "englishTranslation": "Accurate English translation of spoken emergency text",
  "normalizedMeaning": "Concise operational summary of emergency",
  "reason": "Acoustic transcription and language detection basis"
}`;

      const baseUrl = this.config.googleAiBaseUrl || 'https://generativelanguage.googleapis.com/v1beta';
      const candidateModels = options.model
        ? [options.model]
        : ['gemini-3.5-transcribe', 'gemini-3.6-flash', 'gemini-3.5-flash'];

      for (const targetModel of candidateModels) {
        try {
          const url = `${baseUrl}/models/${targetModel}:generateContent?key=${apiKey}`;
          const generationConfig = {
            temperature: 0.1,
          };
          if (targetModel !== 'gemini-3.5-transcribe') {
            generationConfig.responseMimeType = 'application/json';
          }

          const payload = {
            contents: [{
              parts: [
                { inlineData: { mimeType: detectedMime, data: cleanBase64 } },
                { text: promptText }
              ]
            }],
            generationConfig,
          };

          logger.info(`[GoogleAiClient] Calling Multilingual STT [${targetModel}] (${cleanBase64.length} base64 chars, Mime: ${detectedMime})`);
          const response = await this._fetchWithTimeout(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }, options.timeoutMs || 15000);

          if (response && response.ok) {
            const data = await response.json();
            const parts = data.candidates?.[0]?.content?.parts || [];
            let generatedText = '';
            for (const p of parts) {
              if (p.audioTranscription?.text) {
                generatedText = p.audioTranscription.text.trim();
                break;
              }
              if (p.text && !p.thought) {
                generatedText = p.text.trim();
                break;
              }
            }
            if (!generatedText && parts[0]?.text) {
              generatedText = parts[0].text.trim();
            }

            if (generatedText) {
              return {
                success: true,
                generated_text: generatedText,
                response: generatedText,
                text: generatedText,
                model: targetModel,
              };
            }
          } else if (response) {
            const errBody = await response.text();
            logger.warn(`[GoogleAiClient] Model '${targetModel}' failed (${response.status}): ${errBody?.substring(0, 200)}`);
          }
        } catch (modelErr) {
          logger.warn(`[GoogleAiClient] Model '${targetModel}' request exception: ${modelErr.message}`);
        }
      }

      throw new Error('Google AI Transcribe API Error: All transcription models failed or quota exceeded.');
    } catch (error) {
      logger.error('[GoogleAiClient] Audio transcription failed:', error.message);
      return this._formatStructuredError(error);
    }
  }

  /**
   * Executes multimodal (image/audio + prompt) inference via Google AI Studio API
   */
  async generateMultimodal({ mediaData, mimeType = 'image/jpeg', promptText }, options = {}) {
    try {
      logger.info(`[GoogleAiClient] Multimodal request for Google AI Studio [${mimeType}]`);
      let cleanBase64 = mediaData || '';
      if (cleanBase64.includes(',')) {
        cleanBase64 = cleanBase64.split(',')[1];
      }
      return await this.generateText(promptText || 'Analyze emergency site telemetry payload.', {
        ...options,
        images: cleanBase64 ? [cleanBase64] : [],
      });
    } catch (error) {
      logger.error('[GoogleAiClient] Multimodal generation failed:', error.message);
      return this._formatStructuredError(error);
    }
  }

  /**
   * Streaming generator wrapper
   */
  async *generateStream(prompt, options = {}) {
    const result = await this.generateText(prompt, options);
    if (!result.success) {
      yield `[Google AI Client Notice: ${result.error?.message || 'Inference error'}]`;
      return;
    }
    yield result.generated_text;
  }

  /**
   * Optional Real-Time Streaming Audio Transcription via Gemini 3.5 Transcribe Live
   * @param {Object} params
   * @param {Object} [options]
   */
  async transcribeLiveStream({ audioData, mimeType = 'audio/webm', sessionState = {} }, options = {}) {
    const candidateModels = options.model
      ? [options.model]
      : (this.modelRegistry?.liveTranscription?.candidateModels || ['gemini-3.5-transcribe-live', 'gemini-3.5-transcribe']);
    const apiKey = this.config.geminiApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return this._formatStructuredError({ code: 'API_KEY_MISSING', message: 'GEMINI_API_KEY is not configured.' });
    }

    let cleanBase64 = audioData || '';
    if (cleanBase64.includes(',')) cleanBase64 = cleanBase64.split(',')[1];
    const baseUrl = this.config.googleAiBaseUrl || 'https://generativelanguage.googleapis.com/v1beta';

    const payload = {
      contents: [{
        parts: [
          ...(cleanBase64 ? [{ inlineData: { mimeType, data: cleanBase64 } }] : []),
          { text: 'Transcribe this live incoming audio stream chunk verbatim. Return partial transcription.' }
        ]
      }],
    };

    for (const targetModel of candidateModels) {
      try {
        logger.info(`[GoogleAiClient] Invoking Real-Time Transcription [${targetModel}]`);
        const url = `${baseUrl}/models/${targetModel}:generateContent?key=${apiKey}`;

        const resp = await this._fetchWithTimeout(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify(payload),
        }, options.timeoutMs || 10000);

        if (!resp.ok) {
          logger.warn(`[GoogleAiClient] Live transcribe model '${targetModel}' returned status ${resp.status}. Trying next candidate.`);
          continue;
        }

        const data = await resp.json();
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return {
          success: true,
          capability: 'live_transcription',
          model: targetModel,
          transcript: generatedText.trim(),
          isLive: true,
          sessionState,
        };
      } catch (err) {
        logger.warn(`[GoogleAiClient] Live transcription model '${targetModel}' warning: ${this._sanitize(err.message)}. Trying fallback.`);
      }
    }

    return {
      success: false,
      capability: 'live_transcription',
      model: candidateModels[0],
      error: 'All live transcription candidate models failed or preview is unavailable.',
      fallbackAvailable: true,
    };
  }

  /**
   * Optional Real-Time Bidirectional Voice Interaction via Gemini 3.1 Flash Live
   * @param {Object} params
   * @param {Object} [options]
   */
  async liveVoiceTurn({ audioData, text, sessionState = {} }, options = {}) {
    const candidateModels = options.model
      ? [options.model]
      : (this.modelRegistry?.liveVoice?.candidateModels || ['gemini-3.1-flash-live-preview', 'gemini-3.8-flash', 'gemini-3.6-flash']);
    const apiKey = this.config.geminiApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return this._formatStructuredError({ code: 'API_KEY_MISSING', message: 'GEMINI_API_KEY is not configured.' });
    }

    let cleanBase64 = audioData || '';
    if (cleanBase64.includes(',')) cleanBase64 = cleanBase64.split(',')[1];
    const baseUrl = this.config.googleAiBaseUrl || 'https://generativelanguage.googleapis.com/v1beta';

    const parts = [];
    if (cleanBase64) {
      parts.push({ inlineData: { mimeType: 'audio/webm', data: cleanBase64 } });
    }
    if (text) {
      parts.push({ text: `Citizen live voice dialogue turn: "${text}". Provide concise, supportive emergency guidance.` });
    } else {
      parts.push({ text: 'Citizen spoken turn received. Provide immediate concise emergency response guidance.' });
    }
    const payload = { contents: [{ parts }] };

    for (const targetModel of candidateModels) {
      try {
        logger.info(`[GoogleAiClient] Invoking Real-Time Voice Conversation [${targetModel}]`);
        const url = `${baseUrl}/models/${targetModel}:generateContent?key=${apiKey}`;

        const resp = await this._fetchWithTimeout(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify(payload),
        }, options.timeoutMs || 15000);

        if (!resp.ok) {
          logger.warn(`[GoogleAiClient] Live voice model '${targetModel}' returned status ${resp.status}. Trying next candidate.`);
          continue;
        }

        const data = await resp.json();
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return {
          success: true,
          capability: 'live_voice',
          model: targetModel,
          response: generatedText.trim(),
          sessionState,
        };
      } catch (err) {
        logger.warn(`[GoogleAiClient] Live voice model '${targetModel}' note: ${this._sanitize(err.message)}`);
      }
    }

    return {
      success: false,
      capability: 'live_voice',
      model: candidateModels[0],
      error: 'All live voice candidate models failed or preview ID is unprovisioned in project tier.',
      fallbackAvailable: true,
    };
  }

  /**
   * Optional Real-Time Speech Translation via Gemini 3.5 Live Translate
   * @param {Object} params
   * @param {Object} [options]
   */
  async liveTranslateStream({ audioData, transcript = '', sourceLanguage = 'auto', targetLanguage = 'en' }, options = {}) {
    const candidateModels = options.model
      ? [options.model]
      : (this.modelRegistry?.liveTranslation?.candidateModels || ['gemini-3.5-live-translate-preview', 'gemini-3.8-flash', 'gemini-3.6-flash']);
    const apiKey = this.config.geminiApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return this._formatStructuredError({ code: 'API_KEY_MISSING', message: 'GEMINI_API_KEY is not configured.' });
    }

    let cleanBase64 = audioData || '';
    if (cleanBase64.includes(',')) cleanBase64 = cleanBase64.split(',')[1];
    const baseUrl = this.config.googleAiBaseUrl || 'https://generativelanguage.googleapis.com/v1beta';

    const promptText = `Translate the emergency voice audio or transcript from ${sourceLanguage} into ${targetLanguage} in real-time. Preserve operational facts, hazard details, and trapped status exactly.`;
    const parts = [];
    if (cleanBase64) {
      parts.push({ inlineData: { mimeType: 'audio/webm', data: cleanBase64 } });
    }
    if (transcript) {
      parts.push({ text: `Emergency Spoken Transcript: "${transcript}"` });
    }
    parts.push({ text: promptText });
    const payload = { contents: [{ parts }] };

    for (const targetModel of candidateModels) {
      try {
        logger.info(`[GoogleAiClient] Invoking Real-Time Speech Translation [${targetModel}] (${sourceLanguage} -> ${targetLanguage})`);
        const url = `${baseUrl}/models/${targetModel}:generateContent?key=${apiKey}`;

        const resp = await this._fetchWithTimeout(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify(payload),
        }, options.timeoutMs || 12000);

        if (!resp.ok) {
          logger.warn(`[GoogleAiClient] Live translate model '${targetModel}' returned status ${resp.status}. Trying next candidate.`);
          continue;
        }

        const data = await resp.json();
        const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        return {
          success: true,
          capability: 'live_translation',
          model: targetModel,
          translatedText: generatedText.trim(),
          sourceLanguage,
          targetLanguage,
        };
      } catch (err) {
        logger.warn(`[GoogleAiClient] Live translate model '${targetModel}' note: ${this._sanitize(err.message)}`);
      }
    }

    return {
      success: false,
      capability: 'live_translation',
      model: candidateModels[0],
      error: 'All live translation candidate models failed or preview ID is unprovisioned in project tier.',
      fallbackAvailable: true,
    };
  }

  /**
   * Converts raw PCM 16-bit mono audio into a valid RIFF/WAV base64 buffer
   * @private
   */
  _pcmToWav(pcmBase64, sampleRate = 24000) {
    if (!pcmBase64) return null;
    try {
      const pcmBuffer = Buffer.from(pcmBase64, 'base64');
      const header = Buffer.alloc(44);
      header.write('RIFF', 0);
      header.writeUInt32LE(36 + pcmBuffer.length, 4);
      header.write('WAVE', 8);
      header.write('fmt ', 12);
      header.writeUInt32LE(16, 16);
      header.writeUInt16LE(1, 20); // PCM format
      header.writeUInt16LE(1, 22); // mono
      header.writeUInt32LE(sampleRate, 24);
      header.writeUInt32LE(sampleRate * 2, 28); // byte rate
      header.writeUInt16LE(2, 32); // block align
      header.writeUInt16LE(16, 34); // bits per sample
      header.write('data', 36);
      header.writeUInt32LE(pcmBuffer.length, 40);
      return Buffer.concat([header, pcmBuffer]).toString('base64');
    } catch (e) {
      logger.warn(`[GoogleAiClient] PCM to WAV conversion warning: ${e.message}`);
      return pcmBase64;
    }
  }

  /**
   * Optional Natural Voice Output / Text-to-Speech via Gemini TTS
   * @param {Object} params
   * @param {Object} [options]
   */
  async generateSpeech({ text, voice = 'Puck', language = 'en' }, options = {}) {
    const apiKey = this.config.geminiApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return this._formatStructuredError({ code: 'API_KEY_MISSING', message: 'GEMINI_API_KEY is not configured.' });
    }

    const candidateModels = options.model
      ? [options.model]
      : (this.modelRegistry?.tts?.candidateModels || ['gemini-3.1-flash-tts-preview', 'gemini-2.5-flash-preview-tts']);

    const allowedVoices = ['puck', 'charon', 'kore', 'fenrir', 'aoede', 'zephyr', 'achernar', 'enceladus', 'leda'];
    const chosenVoice = allowedVoices.includes(String(voice || '').toLowerCase()) ? voice : 'Puck';

    for (const targetModel of candidateModels) {
      try {
        logger.info(`[GoogleAiClient] Invoking Voice Response TTS [${targetModel}] (Voice: ${chosenVoice}) for: "${text.substring(0, 40)}..."`);
        const baseUrl = this.config.googleAiBaseUrl || 'https://generativelanguage.googleapis.com/v1beta';
        const url = `${baseUrl}/models/${targetModel}:generateContent?key=${apiKey}`;

        const payload = {
          contents: [{
            parts: [{ text: `Generate spoken emergency instruction audio for: "${text}" in language: ${language}` }]
          }],
          generationConfig: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: chosenVoice,
                }
              }
            }
          }
        };

        const resp = await this._fetchWithTimeout(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify(payload),
        }, options.timeoutMs || 15000);

        if (!resp.ok) {
          const errText = await resp.text();
          logger.warn(`[GoogleAiClient] TTS model '${targetModel}' failed (${resp.status}): ${errText.substring(0, 150)}`);
          continue;
        }

        const data = await resp.json();
        const candidatePart = data.candidates?.[0]?.content?.parts?.[0];
        let audioData = candidatePart?.inlineData?.data || null;
        let mimeType = candidatePart?.inlineData?.mimeType || 'audio/wav';

        // If returned as raw PCM (audio/L16 or audio/l16), wrap with standard WAV container
        if (audioData && (mimeType.toLowerCase().includes('l16') || mimeType.toLowerCase().includes('pcm'))) {
          audioData = this._pcmToWav(audioData, 24000);
          mimeType = 'audio/wav';
        }

        if (audioData) {
          return {
            success: true,
            capability: 'voice_response',
            model: targetModel,
            audioData,
            mimeType,
            text,
          };
        }
      } catch (err) {
        logger.warn(`[GoogleAiClient] Voice response TTS model '${targetModel}' note: ${err.message}`);
      }
    }

    return {
      success: false,
      capability: 'voice_response',
      model: candidateModels[0],
      error: 'All TTS voice models failed or unavailable.',
      fallbackAvailable: true,
    };
  }

  /**
   * Scrubs API keys and credential tokens from error messages and log lines
   * @private
   */
  _sanitize(str) {
    if (!str || typeof str !== 'string') return str;
    const apiKey = this.config.geminiApiKey || process.env.GEMINI_API_KEY || '';
    let sanitized = str;
    if (apiKey && apiKey.length > 5) {
      sanitized = sanitized.split(apiKey).join('[REDACTED_API_KEY]');
    }
    return sanitized.replace(/([?&])key=[a-zA-Z0-9_\-.]+/gi, '$1key=[REDACTED]');
  }

  /**
   * Helper fetch with timeout, header-based API key injection, and URL query sanitization
   * @private
   */
  async _fetchWithTimeout(url, fetchOptions, timeoutMs) {
    const apiKey = this.config.geminiApiKey || process.env.GEMINI_API_KEY;
    const cleanHeaders = {
      ...(fetchOptions.headers || {}),
    };
    if (apiKey && !cleanHeaders['x-goog-api-key']) {
      cleanHeaders['x-goog-api-key'] = apiKey;
    }

    // Strip ?key= query param from URL to enforce header authentication and prevent URL leaks
    let cleanUrl = url;
    if (cleanUrl.includes('key=')) {
      cleanUrl = cleanUrl.replace(/([?&])key=[^&]+(&|$)/, (match, p1, p2) => (p1 === '?' && p2 ? '?' : ''));
    }

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(cleanUrl, {
        ...fetchOptions,
        headers: cleanHeaders,
        signal: controller.signal,
      });
      return response;
    } catch (err) {
      if (err.name === 'AbortError') {
        const timeoutErr = new Error(`Google AI Studio API request timed out after ${timeoutMs}ms.`);
        timeoutErr.code = 'GOOGLE_AI_TIMEOUT';
        timeoutErr.statusCode = 408;
        throw timeoutErr;
      }
      err.message = this._sanitize(err.message);
      throw err;
    } finally {
      clearTimeout(id);
    }
  }

  /**
   * Formats structured error response object with absolute API key sanitization
   * @private
   */
  _formatStructuredError(error, attempts = 1) {
    const rawMsg = error?.message || 'Google AI Studio inference failed.';
    const cleanMsg = this._sanitize(rawMsg);
    return {
      success: false,
      error: {
        code: error?.code || 'GOOGLE_AI_INFERENCE_FAILURE',
        message: cleanMsg,
        statusCode: error?.statusCode || 500,
        attempts: error?.attempt || attempts,
        model: this.config.gemmaModel,
        provider: 'google',
        timestamp: new Date().toISOString(),
      },
    };
  }
}

const googleAiClientInstance = new GoogleAiClient();
module.exports = googleAiClientInstance;
module.exports.GoogleAiClient = GoogleAiClient;
