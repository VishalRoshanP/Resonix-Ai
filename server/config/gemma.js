/**
 * AI Service Configuration Module for RESONIX AI
 * Loads Google AI Studio / Gemini API configuration & disaster reasoning settings.
 * 
 * Primary Model: gemma-4-26b-a4b-it
 */

const gemmaConfig = {
  // Google AI Studio / Gemini API Configuration
  get geminiApiKey() {
    return process.env.GEMINI_API_KEY || '';
  },
  get gemmaModel() {
    return process.env.GEMMA_VERIFICATION_MODEL || process.env.GEMMA_MODEL || 'gemma-4-26b-a4b-it';
  },
  get googleAiBaseUrl() {
    return process.env.GOOGLE_AI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta';
  },

  // Backwards compatibility aliases
  get hfModel() {
    return process.env.GEMMA_VERIFICATION_MODEL || process.env.GEMMA_MODEL || 'gemma-4-26b-a4b-it';
  },

  /**
   * Active AI Provider: 'google' if GEMINI_API_KEY is present, else 'rules'
   */
  get provider() {
    return (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim() !== '') ? 'google' : 'rules';
  },

  // Retry & Resilience Settings
  maxRetries: parseInt(process.env.GEMMA_MAX_RETRIES, 10) || 2,
  retryDelayMs: parseInt(process.env.GEMMA_RETRY_DELAY_MS, 10) || 1000,
  timeoutMs: parseInt(process.env.GEMMA_TIMEOUT_MS, 10) || 90000,
  
  // Inference Hyperparameters
  defaultParams: {
    temperature: parseFloat(process.env.GEMMA_TEMPERATURE) || 0.1,
    top_p: parseFloat(process.env.GEMMA_TOP_P) || 0.9,
    num_predict: parseInt(process.env.GEMMA_MAX_TOKENS, 10) || 2048,
    maxOutputTokens: parseInt(process.env.GEMMA_MAX_TOKENS, 10) || 2048,
  },

  enableStreaming: process.env.GEMMA_ENABLE_STREAMING === 'true',

  /**
   * Request headers for AI API calls
   * @returns {Object} Request headers
   */
  getHeaders() {
    return {
      'Content-Type': 'application/json',
    };
  },

  /**
   * Endpoint URL for Google AI Studio
   * @returns {string} Endpoint URL
   */
  getEndpointUrl() {
    return `${this.googleAiBaseUrl}/models/${this.gemmaModel}:generateContent?key=${this.geminiApiKey}`;
  },

  /**
   * Validates whether AI service endpoint is configured
   * @returns {boolean}
   */
  isConfigured() {
    return Boolean(this.geminiApiKey);
  },
};

module.exports = gemmaConfig;
