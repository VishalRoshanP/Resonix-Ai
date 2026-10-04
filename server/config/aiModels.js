/**
 * Centralized AI Model Capability Configuration for RESONIX AI
 * 
 * Strict Architecture & Security Rules:
 * 1. SINGLE CENTRALIZED CREDENTIAL:
 *    - Uses a single, shared GEMINI_API_KEY from server-side environment for ALL models.
 *    - ZERO API key exposure to browser, React frontend, Vite env, mobile APKs, client payloads, or logs.
 * 2. MODEL ROUTING ARCHITECTURE:
 *    GEMINI_API_KEY (Shared Credential)
 *          |
 *          +-- Gemini 3.8 Flash (Primary Emergency Reasoning & Semantic Classification)
 *          +-- Gemini 3.5 Transcribe (Authoritative Recorded SOS Multilingual Audio Transcription)
 *          +-- Gemini 3.5 Transcribe Live (Optional Real-Time Streaming Transcription)
 *          +-- Gemini 3.1 Flash Live (Optional Bidirectional Real-Time Voice Interaction)
 *          +-- Gemini 3.1 Flash TTS (Optional Spoken Voice Guidance)
 *          +-- Gemini 3.5 Live Translate (Optional Real-Time Multilingual Spoken Translation)
 *          +-- Gemma 4 Verification (Deterministic Secondary Adjudication & Fast-Path Escalation)
 * 3. DEFENSIVE ISOLATION & LATENCY PROTECTION:
 *    - Standard recorded SOS invokes: Gemini 3.5 Transcribe -> Pinecone RAG -> Gemini 3.8 Flash -> (Conditional) Gemma 4.
 *    - Optional models (Live Voice, TTS, Live Translate) are NEVER invoked on the recorded SOS critical path.
 *    - Defensive fallbacks prevent server crash if an experimental model preview ID is unavailable.
 */

const aiModelConfig = {
  // Single Shared API Credential (Backend Environment ONLY)
  get apiKey() {
    return process.env.GEMINI_API_KEY || '';
  },

  getApiKey() {
    return process.env.GEMINI_API_KEY || '';
  },

  isConfigured() {
    return Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '');
  },

  // Centralized Environment Variable Mappings
  models: {
    GEMINI_REASONING_MODEL: process.env.GEMINI_REASONING_MODEL || process.env.PRIMARY_REASONING_MODEL || 'gemini-3.8-flash',
    GEMINI_TRANSCRIBE_MODEL: process.env.GEMINI_TRANSCRIBE_MODEL || process.env.RECORDED_TRANSCRIPTION_MODEL || 'gemini-3.5-transcribe',
    GEMINI_TRANSCRIBE_LIVE_MODEL: process.env.GEMINI_TRANSCRIBE_LIVE_MODEL || process.env.LIVE_TRANSCRIPTION_MODEL || 'gemini-3.5-transcribe-live',
    GEMINI_LIVE_MODEL: process.env.GEMINI_LIVE_MODEL || process.env.LIVE_VOICE_MODEL || 'gemini-3.1-flash-live-preview',
    GEMINI_TTS_MODEL: process.env.GEMINI_TTS_MODEL || process.env.TTS_MODEL || 'gemini-3.1-flash-tts-preview',
    GEMINI_TRANSLATE_LIVE_MODEL: process.env.GEMINI_TRANSLATE_LIVE_MODEL || process.env.LIVE_TRANSLATE_MODEL || 'gemini-3.5-live-translate-preview',
    GEMMA_VERIFICATION_MODEL: process.env.GEMMA_VERIFICATION_MODEL || process.env.SECONDARY_VERIFICATION_MODEL || 'gemma-4-31b-it',
    GEMMA_MODEL: process.env.GEMMA_MODEL || 'gemma-4-26b-a4b-it',
    SARVAM_TRANSCRIBE_MODEL: process.env.SARVAM_TRANSCRIBE_MODEL || 'saaras:v4',
  },

  // 1. Primary Emergency Reasoning & Semantic Classification (Gemini 3.8 Flash)
  primaryReasoning: {
    get model() {
      return process.env.GEMINI_REASONING_MODEL || process.env.PRIMARY_REASONING_MODEL || 'gemini-3.8-flash';
    },
    candidateModels: [
      process.env.GEMINI_REASONING_MODEL || 'gemini-3.8-flash',
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.7-flash',
      'gemini-3.6-flash',
    ],
    timeoutMs: parseInt(process.env.PRIMARY_REASONING_TIMEOUT_MS, 10) || 12000,
  },

  // 2. Authoritative Recorded Audio Speech-to-Text (Gemini 3.5 Transcribe)
  recordedTranscription: {
    get model() {
      return process.env.GEMINI_TRANSCRIBE_MODEL || process.env.RECORDED_TRANSCRIPTION_MODEL || 'gemini-3.5-transcribe';
    },
    candidateModels: [
      process.env.GEMINI_TRANSCRIBE_MODEL || 'gemini-3.5-transcribe',
      'gemini-3.5-flash',
      'gemini-3.6-flash',
    ],
    timeoutMs: parseInt(process.env.RECORDED_TRANSCRIPTION_TIMEOUT_MS, 10) || 15000,
  },

  // 2B. Additional Indian-Language Speech Intelligence (Sarvam Saaras - Secondary STT)
  sarvamTranscription: {
    get model() {
      return process.env.SARVAM_TRANSCRIBE_MODEL || 'saaras:v4';
    },
    candidateModels: [
      process.env.SARVAM_TRANSCRIBE_MODEL || 'saaras:v4',
      'saaras:v3',
    ],
    timeoutMs: parseInt(process.env.SARVAM_TIMEOUT_MS, 10) || 15000,
  },

  // 3. Secondary Verification & Fast-Path Adjudication (Gemma 4 Verification)
  secondaryVerification: {
    get model() {
      return process.env.GEMMA_VERIFICATION_MODEL || process.env.SECONDARY_VERIFICATION_MODEL || process.env.GEMMA_MODEL || 'gemma-4-31b-it';
    },
    candidateModels: [
      process.env.GEMMA_VERIFICATION_MODEL || 'gemma-4-31b-it',
      process.env.GEMMA_MODEL || 'gemma-4-26b-a4b-it',
    ],
    timeoutMs: parseInt(process.env.SECONDARY_VERIFICATION_TIMEOUT_MS, 10) || 25000,
    escalationThreshold: parseFloat(process.env.AI_ESCALATION_CONFIDENCE_THRESHOLD) || 0.70,
  },

  // 4. Optional Real-Time Streaming Transcription (Gemini 3.5 Transcribe Live)
  liveTranscription: {
    get model() {
      return process.env.GEMINI_TRANSCRIBE_LIVE_MODEL || process.env.LIVE_TRANSCRIPTION_MODEL || 'gemini-3.5-transcribe-live';
    },
    candidateModels: [
      process.env.GEMINI_TRANSCRIBE_LIVE_MODEL || 'gemini-3.5-transcribe-live',
      'gemini-3.5-transcribe',
      'gemini-3.5-flash',
    ],
    timeoutMs: parseInt(process.env.LIVE_TRANSCRIPTION_TIMEOUT_MS, 10) || 10000,
  },

  // 5. Optional Real-Time Bidirectional Voice Interaction (Gemini 3.1 Flash Live)
  liveVoice: {
    get model() {
      return process.env.GEMINI_LIVE_MODEL || process.env.LIVE_VOICE_MODEL || 'gemini-3.1-flash-live-preview';
    },
    candidateModels: [
      process.env.GEMINI_LIVE_MODEL || 'gemini-3.1-flash-live-preview',
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.8-flash',
      'gemini-3.6-flash',
    ],
    timeoutMs: parseInt(process.env.LIVE_VOICE_TIMEOUT_MS, 10) || 15000,
  },

  // 6. Optional Natural Spoken Audio Output / TTS (Gemini 3.1 Flash TTS)
  tts: {
    get model() {
      return process.env.GEMINI_TTS_MODEL || process.env.TTS_MODEL || 'gemini-3.1-flash-tts-preview';
    },
    candidateModels: [
      process.env.GEMINI_TTS_MODEL || 'gemini-3.1-flash-tts-preview',
      'gemini-2.5-flash-preview-tts',
    ],
    timeoutMs: parseInt(process.env.TTS_TIMEOUT_MS, 10) || 15000,
  },

  // 7. Optional Real-Time Multilingual Speech Translation (Gemini 3.5 Live Translate)
  liveTranslation: {
    get model() {
      return process.env.GEMINI_TRANSLATE_LIVE_MODEL || process.env.LIVE_TRANSLATE_MODEL || 'gemini-3.5-live-translate-preview';
    },
    candidateModels: [
      process.env.GEMINI_TRANSLATE_LIVE_MODEL || 'gemini-3.5-live-translate-preview',
      'gemini-3.5-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.8-flash',
      'gemini-3.6-flash',
    ],
    timeoutMs: parseInt(process.env.LIVE_TRANSLATE_TIMEOUT_MS, 10) || 12000,
  },

  // Supported Capability Identifiers
  capabilities: {
    RECORDED_SOS: 'recorded_sos',
    LIVE_TRANSCRIPTION: 'live_transcription',
    LIVE_VOICE: 'live_voice',
    LIVE_TRANSLATION: 'live_translation',
    VOICE_RESPONSE: 'voice_response',
  },
};

module.exports = aiModelConfig;
