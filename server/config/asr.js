/**
 * ASR (Speech-to-Text) Configuration Module for RESONIX AI
 * 
 * Supports:
 * - Hugging Face Inference API / Open Serverless ASR Endpoint
 * - Configurable ASR model (Default: openai/whisper-large-v3-turbo)
 * - Multilingual support: English, Hindi, Tamil, Kannada, Telugu, Bengali, Malayalam, Marathi, Gujarati
 * - Resilience, timeout, retry, and acoustic quality thresholds
 */

const asrConfig = {
  // Hugging Face ASR Endpoint & Model
  hfApiBaseUrl: process.env.HF_API_BASE_URL || 'https://api-inference.huggingface.co/models',
  hfModel: process.env.HF_ASR_MODEL || 'openai/whisper-large-v3-turbo',
  hfApiKey: process.env.HF_API_KEY || process.env.HUGGINGFACE_API_KEY || '',

  // Fallback / Alternate ASR Models evaluated for Indian languages
  evaluatedModels: [
    {
      id: 'openai/whisper-large-v3-turbo',
      name: 'Whisper Large v3 Turbo',
      languages: ['en', 'hi', 'ta', 'kn', 'te', 'bn', 'ml', 'mr', 'gu'],
      strengths: 'Fast inference, excellent multilingual coverage, robust to Indian accents and ambient noise',
    },
    {
      id: 'openai/whisper-large-v3',
      name: 'Whisper Large v3',
      languages: ['en', 'hi', 'ta', 'kn', 'te', 'bn', 'ml', 'mr', 'gu'],
      strengths: 'Highest accuracy across Indian regional languages and noisy conditions',
    },
    {
      id: 'facebook/mms-1b-all',
      name: 'Meta MMS 1B',
      languages: ['hin', 'tam', 'kan', 'eng'],
      strengths: 'Extensive regional dialect and phonetic coverage',
    },
  ],

  // Resilience & Performance Settings
  timeoutMs: parseInt(process.env.ASR_TIMEOUT_MS, 10) || 30000,
  maxRetries: parseInt(process.env.ASR_MAX_RETRIES, 10) || 2,
  retryDelayMs: parseInt(process.env.ASR_RETRY_DELAY_MS, 10) || 1500,

  // Audio Quality & Validation Thresholds
  minAudioDurationSeconds: 0.3,
  maxAudioDurationSeconds: 120.0,
  minAudioSizeBytes: 64,
  maxAudioSizeBytes: 15 * 1024 * 1024, // 15MB max
  silenceRmsThreshold: 0.005, // Below this RMS amplitude is considered silent/empty audio
  confidenceThresholdUncertain: 0.60, // Below this is marked as UNCERTAIN / POOR_TRANSCRIPTION

  // Supported Audio MIME Types
  supportedMimeTypes: [
    'audio/webm',
    'audio/webm;codecs=opus',
    'audio/wav',
    'audio/x-wav',
    'audio/wave',
    'audio/ogg',
    'audio/ogg;codecs=opus',
    'audio/mp4',
    'audio/m4a',
    'audio/aac',
    'audio/mpeg',
    'audio/mp3',
  ],

  // Supported Indian Languages & BCP47 Language Tag Mapping
  languageMap: {
    en: { name: 'English', bcp47: 'en-IN', script: 'LATIN' },
    hi: { name: 'Hindi', bcp47: 'hi-IN', script: 'DEVANAGARI' },
    ta: { name: 'Tamil', bcp47: 'ta-IN', script: 'TAMIL' },
    kn: { name: 'Kannada', bcp47: 'kn-IN', script: 'KANNADA' },
    te: { name: 'Telugu', bcp47: 'te-IN', script: 'TELUGU' },
    bn: { name: 'Bengali', bcp47: 'bn-IN', script: 'BENGALI' },
    ml: { name: 'Malayalam', bcp47: 'ml-IN', script: 'MALAYALAM' },
    mr: { name: 'Marathi', bcp47: 'mr-IN', script: 'DEVANAGARI' },
    gu: { name: 'Gujarati', bcp47: 'gu-IN', script: 'GUJARATI' },
  },

  /**
   * Generates full request URL for Hugging Face ASR model
   * @param {string} [modelId]
   * @returns {string} Endpoint URL
   */
  getEndpointUrl(modelId) {
    const targetModel = modelId || this.hfModel;
    return `${this.hfApiBaseUrl}/${targetModel}`;
  },

  /**
   * Generates HTTP headers for Hugging Face API
   * @returns {Object}
   */
  getHeaders() {
    const headers = {
      'Content-Type': 'application/octet-stream',
    };
    if (this.hfApiKey) {
      headers['Authorization'] = `Bearer ${this.hfApiKey}`;
    }
    return headers;
  },
};

module.exports = asrConfig;
