/**
 * AI Service Unified Client Wrapper for RESONIX AI
 * 
 * Handles:
 * - Routing to Google AI Studio API when GEMINI_API_KEY is configured
 * - Graceful deterministic fallback when offline or unconfigured
 * - Retries with backoff & AbortController timeouts
 * - Multimodal & streaming response wrappers
 */

const gemmaConfig = require('../../config/gemma');
const googleAiClient = require('./googleAiClient');
const logger = require('../../utils/logger');

class GemmaClient {
  constructor(config = gemmaConfig) {
    this.config = config;
  }

  /**
   * Executes text inference against active AI provider (Google AI Studio)
   * @param {string|Object} prompt - Input text or prompt payload
   * @param {Object} [options] - Additional parameters
   * @returns {Promise<Object>} API response object or structured error object
   */
  async generateText(prompt, options = {}) {
    if (this.config.provider === 'google' && this.config.isConfigured()) {
      return googleAiClient.generateText(prompt, options);
    }

    logger.info('[AIClient] Running in deterministic offline rule mode (Cloud AI unconfigured).');
    return {
      success: true,
      generated_text: '',
      response: '',
      text: '',
      model: this.config.gemmaModel,
      isOfflineFallback: true,
    };
  }

  /**
   * Executes JSON-enforced inference against active AI provider
   * @param {string|Object} prompt - Input text or prompt payload
   * @param {Object} [options] - Additional parameters
   * @returns {Promise<Object>} API response object or structured error object
   */
  async generateJson(prompt, options = {}) {
    return this.generateText(prompt, {
      ...options,
      jsonMode: true,
    });
  }

  /**
   * Multimodal input support for image + text / audio + text payloads
   */
  async generateMultimodal({ mediaData, mimeType, promptText }, options = {}) {
    if (this.config.provider === 'google' && this.config.isConfigured()) {
      return googleAiClient.generateMultimodal({ mediaData, mimeType, promptText }, options);
    }
    
    return {
      success: true,
      generated_text: '',
      response: '',
      text: '',
      model: this.config.gemmaModel,
      isOfflineFallback: true,
    };
  }

  /**
   * Streaming response generator
   */
  async *generateStream(prompt, options = {}) {
    if (this.config.provider === 'google' && this.config.isConfigured()) {
      yield* googleAiClient.generateStream(prompt, options);
      return;
    }
    const result = await this.generateText(prompt, options);
    yield result?.generated_text || result?.response || '';
  }
}

const clientInstance = new GemmaClient();

module.exports = clientInstance;
module.exports.GemmaClient = GemmaClient;
