/**
 * WeatherGPT Voice Service for RESONIX AI
 * 
 * Implements full Indian-Language Voice Weather Pipeline:
 * Speech (Tamil / English)
 * ➔ STT (Gemini / Sarvam / Client Stream Fallback)
 * ➔ Language Detection (Tamil \u0B80-\u0BFF, Tanglish, English)
 * ➔ Weather Intent & Parameter Extraction
 * ➔ Live Weather Retrieval (Real Factual Measurements)
 * ➔ Grounded AI Reasoning & Stratified Verification
 * ➔ TTS (Gemini Speech / Client Web Speech Fallback)
 * 
 * Strict Invariants:
 * - Grounded in real retrieved weather data only.
 * - Zero hallucinated weather measurements or translated fabricated data.
 * - Graceful fallback if STT or TTS services fail.
 * - Full backward compatibility with existing Resonix voice architecture.
 */

const asrService = require('../speech/asrService');
const googleAiClient = require('../gemma/googleAiClient');
const weatherGptAgent = require('./weatherGptAgent');
const logger = require('../../utils/logger');

const DEFAULT_VOICES = {
  ta: 'Kore',
  en: 'Puck',
  hi: 'Kore',
  te: 'Aoede',
  kn: 'Fenrir',
  ml: 'Leda',
  bn: 'Zephyr',
  mr: 'Kore',
  gu: 'Charon',
  pa: 'Fenrir',
};

const STT_FALLBACK_MESSAGES = {
  ta: 'மன்னிக்கவும், உங்கள் குரலைப் புரிந்து கொள்ள முடியவில்லை. தயவுசெய்து தெளிவாகப் பேசவும் அல்லது எழுதி அனுப்பவும்.',
  hi: 'क्षमा करें, आपकी आवाज़ समझ नहीं आई। कृपया स्पष्ट बोलें या लिखकर भेजें।',
  te: 'క్షమించండి, మీ వాయిస్ అర్థం కాలేదు. దయచేసి స్పష్టంగా మాట్లాడండి లేదా టైప్ చేయండి.',
  kn: 'ಕ್ಷಮಿಸಿ, ನಿಮ್ಮ ಧ್ವನಿ ಸ್ಪಷ್ಟವಾಗಿಲ್ಲ. ದಯವಿಟ್ಟು ಸ್ಪಷ್ಟವಾಗಿ ಮಾತನಾಡಿ ಅಥವಾ ಟೈಪ್ ಮಾಡಿ.',
  ml: 'ക്ഷമിക്കണം, ശബ്ദം വ്യക്തമല്ല. ദയവായി വ്യക്തമായി സംസാരിക്കുകയോ ടൈപ്പ് ചെയ്യുകയോ ചെയ്യുക.',
  bn: 'দুঃখিত, আপনার কথা বুঝতে পারিনি। অনুগ্রহ করে স্পষ্ট করে বলুন বা লিখে জানান।',
  mr: 'क्षमस्व, तुमचा आवाज समजला नाही. कृपया स्पष्ट बोला किंवा लिहून पाठवा.',
  gu: 'માફ કરશો, તમારો અવાજ સ્પષ્ટ નથી. કૃપા કરીને સ્પષ્ટ બોલો અથવા લખીને મોકલો.',
  pa: 'ਮਾਫ਼ ਕਰਨਾ, ਤੁਹਾਡੀ ਆਵਾਜ਼ ਸਮਝ ਨਹੀਂ ਆਈ। ਕਿਰਪਾ ਕਰਕੇ ਸਾਫ਼ ਬੋਲੋ ਜਾਂ ਲਿਖ ਕੇ ਭੇਜੋ।',
  en: 'Could not transcribe speech. Please speak clearly or type your weather query.',
};

const WARNING_INTROS = {
  ta: 'வானிலை எச்சரிக்கை: ',
  hi: 'मौसम चेतावनी: ',
  te: 'వాతావరణ హెచ్చరిక: ',
  kn: 'ಹವಾಮಾನ ಎಚ್ಚರಿಕೆ: ',
  ml: 'കാലാവസ്ഥാ മുന്നറിയിപ്പ്: ',
  bn: 'আবহাওয়া সতর্কতা: ',
  mr: 'हवामान इशारा: ',
  gu: 'હવામાન ચેતવણી: ',
  pa: 'ਮੌਸਮ ਚੇਤਾਵਨੀ: ',
  en: 'Weather Alert: ',
};

class WeatherVoiceService {
  constructor() {
    this.supportedLanguages = ['en', 'ta', 'hi', 'te', 'kn', 'ml', 'bn', 'mr', 'gu', 'pa'];
  }

  /**
   * Orchestrates the complete end-to-end voice query pipeline
   * @param {Object} params
   * @param {string} [params.audioData] - Base64 audio string
   * @param {string} [params.dataUrl] - Data URL with audio
   * @param {Buffer} [params.buffer] - Raw audio buffer
   * @param {string} [params.mimeType] - e.g. 'audio/webm', 'audio/wav'
   * @param {string} [params.transcript] - Pre-captured transcript from client Web Speech API
   * @param {string} [params.languageHint] - 'en', 'ta', 'hi', etc.
   * @param {number} [params.latitude] - GPS latitude
   * @param {number} [params.longitude] - GPS longitude
   * @param {string} [params.locationName] - Optional location name
   * @param {string} [params.voice] - TTS voice name
   * @returns {Promise<Object>} Complete voice weather response
   */
  async processVoiceQuery(params = {}) {
    const startTime = Date.now();
    const {
      audioData,
      dataUrl,
      buffer,
      mimeType = 'audio/webm',
      transcript: clientTranscript,
      languageHint,
      latitude,
      longitude,
      locationName,
      voice,
    } = params;

    let spokenQuery = '';
    let sttResult = null;
    let sttEngine = 'DIRECT_TEXT';
    let sttConfidence = 1.0;
    let sttFailed = false;

    // 1. Speech-to-Text (STT) Processing
    const hasAudioPayload = Boolean(audioData || dataUrl || buffer);

    if (hasAudioPayload) {
      try {
        sttResult = await asrService.transcribeAudio({
          audioData,
          dataUrl,
          buffer,
          mimeType,
          transcript: clientTranscript,
          languageHint,
        });

        if (sttResult && sttResult.success && sttResult.transcript) {
          spokenQuery = sttResult.transcript.trim();
          sttEngine = sttResult.asrEngine || sttResult.transcriptionSource || 'ASR_SERVICE';
          sttConfidence = sttResult.confidence || 0.9;
        } else if (clientTranscript && clientTranscript.trim().length >= 2) {
          spokenQuery = clientTranscript.trim();
          sttEngine = 'CLIENT_SPEECH_STREAM_FALLBACK';
          sttConfidence = 0.75;
        } else {
          sttFailed = true;
        }
      } catch (sttErr) {
        logger.warn(`[WeatherVoiceService] STT failed: ${sttErr.message}`);
        if (clientTranscript && clientTranscript.trim().length >= 2) {
          spokenQuery = clientTranscript.trim();
          sttEngine = 'CLIENT_SPEECH_STREAM_FALLBACK';
          sttConfidence = 0.7;
        } else {
          sttFailed = true;
        }
      }
    } else if (clientTranscript && clientTranscript.trim().length >= 1) {
      spokenQuery = clientTranscript.trim();
      sttEngine = 'CLIENT_WEB_SPEECH_DIRECT';
      sttConfidence = 0.95;
    } else {
      sttFailed = true;
    }

    // Handle STT failure gracefully
    if (sttFailed || !spokenQuery) {
      const fallbackLang = weatherGptAgent.detectLanguage('', languageHint);
      const fallbackMsg = STT_FALLBACK_MESSAGES[fallbackLang] || STT_FALLBACK_MESSAGES.en;

      return {
        success: false,
        error: 'SPEECH_RECOGNITION_FAILED',
        message: fallbackMsg,
        spokenQuery: '',
        language: fallbackLang,
        weatherResponse: null,
        spokenSummary: fallbackMsg,
        audio: {
          hasAudio: false,
          audioData: null,
          mimeType: 'audio/wav',
          ttsEngine: 'BROWSER_SYNTHESIS_FALLBACK',
          fallbackToClient: true,
        },
        latencyMs: Date.now() - startTime,
      };
    }

    // 2. Language Detection & Prioritization
    const detectedLanguage = weatherGptAgent.detectLanguage(spokenQuery, languageHint);
    logger.info(`[WeatherVoiceService] Processing query: "${spokenQuery}" | Language: ${detectedLanguage} | STT Engine: ${sttEngine}`);

    // 3. Grounded WeatherGPT Reasoning
    const weatherResponse = await weatherGptAgent.processQuery(
      spokenQuery,
      latitude,
      longitude,
      {
        language: detectedLanguage,
        locationName,
      }
    );

    // 4. Synthesize Concise Spoken Audio Summary in user's language
    const spokenSummary = this._createSpokenSummary(weatherResponse, detectedLanguage);

    // 5. Text-to-Speech (TTS) Generation
    let audioPayload = null;
    let ttsEngine = 'BROWSER_SYNTHESIS_FALLBACK';
    let fallbackToClientTts = true;

    try {
      const chosenVoice = voice || DEFAULT_VOICES[detectedLanguage] || 'Puck';
      const ttsResult = await googleAiClient.generateSpeech({
        text: spokenSummary,
        voice: chosenVoice,
        language: detectedLanguage,
      });

      if (ttsResult && ttsResult.success && ttsResult.audioData) {
        audioPayload = ttsResult.audioData;
        ttsEngine = ttsResult.model || 'GEMINI_TTS';
        fallbackToClientTts = false;
      } else {
        logger.warn(`[WeatherVoiceService] Remote TTS returned failure or empty audio: ${ttsResult?.message || 'Unknown'}. Falling back to browser speech synthesis.`);
      }
    } catch (ttsErr) {
      logger.warn(`[WeatherVoiceService] Remote TTS exception: ${ttsErr.message}. Falling back to browser speech synthesis.`);
    }

    const latencyMs = Date.now() - startTime;

    return {
      success: true,
      spokenQuery,
      language: detectedLanguage,
      stt: {
        engine: sttEngine,
        confidence: sttConfidence,
      },
      weatherResponse,
      spokenSummary,
      audio: {
        hasAudio: Boolean(audioPayload),
        audioData: audioPayload,
        mimeType: 'audio/wav',
        ttsEngine,
        fallbackToClient: fallbackToClientTts,
      },
      latencyMs,
    };
  }

  /**
   * Generates a natural, conversational spoken summary suitable for voice playback
   * @param {Object} gptResult - Result from WeatherGptAgent
   * @param {string} language - ISO language code
   * @returns {string} Clean conversational speech text
   */
  _createSpokenSummary(gptResult, language = 'en') {
    if (!gptResult) return '';

    // Prioritize Phase 5 concise conversational answer for natural voice playback
    if (gptResult.conciseAnswer) {
      return gptResult.conciseAnswer;
    }

    const layers = gptResult.evidenceLayers || {};
    const aiGuidance = layers.aiInterpretation || '';
    const warning = layers.warning || '';

    let summaryParts = [];

    // Prioritize AI Actionable Guidance
    if (aiGuidance) {
      summaryParts.push(aiGuidance);
    }

    // Include severe warning if active (filter out green/safe alerts)
    const isSafe = /பச்சை|GREEN|सामान्य|హరితం|ಹಸಿರು|സുരക്ഷിതം|স্বাভাবিক|સામાન્ય|ਆਮ/i.test(warning);
    if (warning && !isSafe) {
      const warningIntro = WARNING_INTROS[language] || WARNING_INTROS.en;
      summaryParts.push(`${warningIntro}${warning}`);
    }

    // If guidance was empty, pull observed metrics
    if (summaryParts.length === 0 && layers.observedData) {
      const cleanObserved = layers.observedData.replace(/\n/g, ', ');
      summaryParts.push(cleanObserved);
    }

    return summaryParts.join(' ').trim();
  }
}

const weatherVoiceService = new WeatherVoiceService();
module.exports = weatherVoiceService;
module.exports.WeatherVoiceService = WeatherVoiceService;
