/**
 * Sarvam AI Speech Intelligence Configuration for RESONIX AI
 * 
 * Strict Architecture & Security Rules:
 * 1. SERVER-SIDE ONLY CREDENTIAL:
 *    - Reads SARVAM_API_KEY exclusively from Node.js server environment (server/.env).
 *    - ZERO API key exposure to browser, React frontend, Vite env, mobile APKs, client payloads, or logs.
 * 2. ADDITIONAL CAPABILITY:
 *    - Sarvam Saaras acts as an additional Indian-language speech intelligence engine.
 *    - It does NOT replace Gemini 3.5 Transcribe, Gemini 3.8 Flash, or Gemma 4.
 * 3. GRACEFUL DEGRADATION:
 *    - If SARVAM_API_KEY is missing, empty, or exhausted (zero credits / quota exceeded),
 *      the system gracefully degrades to Gemini STT and existing fallbacks without failing the SOS.
 */

const sarvamConfig = {
  // Server-side environment key getter (never hardcoded, never logged)
  get apiKey() {
    return process.env.SARVAM_API_KEY ? process.env.SARVAM_API_KEY.trim() : '';
  },

  // Target speech-to-text model for Saaras (default: 'saaras:v4')
  get transcribeModel() {
    return process.env.SARVAM_TRANSCRIBE_MODEL || 'saaras:v4';
  },

  // Base URL for Sarvam REST APIs
  baseUrl: process.env.SARVAM_API_BASE_URL || 'https://api.sarvam.ai',

  // Request endpoints
  endpoints: {
    speechToText: '/speech-to-text',
    translate: '/translate',
  },

  // Timeout settings
  timeoutMs: parseInt(process.env.SARVAM_TIMEOUT_MS, 10) || 15000,
  maxRetries: parseInt(process.env.SARVAM_MAX_RETRIES, 10) || 1,

  // Supported Indic BCP-47 language codes
  supportedLanguages: [
    'hi-IN', 'ta-IN', 'te-IN', 'kn-IN', 'ml-IN', 'mr-IN',
    'bn-IN', 'gu-IN', 'pa-IN', 'od-IN', 'en-IN', 'auto', 'unknown'
  ],

  // Check if Sarvam is configured with a valid key
  isConfigured() {
    const key = this.apiKey;
    return Boolean(key && key.length > 5 && !key.includes('<user-provided-key>'));
  },
};

module.exports = sarvamConfig;
