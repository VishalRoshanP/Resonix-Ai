/**
 * Gemma 4 E4B Configuration Module for RESONIX AI
 * Loads local Ollama configuration from environment variables.
 * 
 * Model Primary: gemma4:e4b
 */

const gemmaConfig = {
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  ollamaModel: process.env.OLLAMA_MODEL || 'gemma4:e4b',

  // Backwards compatibility aliases
  hfModel: process.env.OLLAMA_MODEL || 'gemma4:e4b',

  // Retry & Resilience Settings
  maxRetries: parseInt(process.env.GEMMA_MAX_RETRIES, 10) || 2,
  retryDelayMs: parseInt(process.env.GEMMA_RETRY_DELAY_MS, 10) || 1000,
  timeoutMs: parseInt(process.env.GEMMA_TIMEOUT_MS, 10) || 45000,
  
  // Inference Hyperparameters
  defaultParams: {
    temperature: parseFloat(process.env.GEMMA_TEMPERATURE) || 0.1,
    top_p: parseFloat(process.env.GEMMA_TOP_P) || 0.9,
    num_predict: parseInt(process.env.GEMMA_MAX_TOKENS, 10) || 1024,
  },

  enableStreaming: process.env.GEMMA_ENABLE_STREAMING === 'true',

  /**
   * Request headers for Ollama API
   * @returns {Object} Request headers
   */
  getHeaders() {
    return {
      'Content-Type': 'application/json',
    };
  },

  /**
   * Full endpoint URL for Ollama generate API
   * @returns {string} Endpoint URL
   */
  getEndpointUrl() {
    return `${this.ollamaBaseUrl}/api/generate`;
  },

  /**
   * Validates whether Ollama endpoint is configured
   * @returns {boolean}
   */
  isConfigured() {
    return Boolean(this.ollamaBaseUrl && this.ollamaModel);
  },
};

module.exports = gemmaConfig;
