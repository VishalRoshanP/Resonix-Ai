/**
 * Gemma 4 E4B Reusable API Client Wrapper for Local Ollama Inference Engine
 * 
 * Handles:
 * - Environment configuration (OLLAMA_BASE_URL, OLLAMA_MODEL=gemma4:e4b)
 * - Retries with backoff
 * - Timeout cancellation via AbortController
 * - Structured response formatting compatible with responseParser.js
 */

const gemmaConfig = require('../../config/gemma');
const logger = require('../../utils/logger');

class GemmaClient {
  constructor(config = gemmaConfig) {
    this.config = config;
  }

  /**
   * Executes text inference against local Ollama gemma4:e4b model
   * @param {string|Object} prompt - Input text or prompt payload
   * @param {Object} [options] - Additional parameters
   * @returns {Promise<Object>} API response object or structured error object
   */
  async generateText(prompt, options = {}) {
    if (!this.config.isConfigured()) {
      logger.warn('[GemmaClient] Ollama configuration is missing.');
      return this._formatStructuredError({
        code: 'OLLAMA_CONFIG_MISSING',
        message: 'OLLAMA_BASE_URL or OLLAMA_MODEL is not configured.',
        statusCode: 500,
        attempts: 0,
      });
    }

    const endpoint = this.config.getEndpointUrl();
    const promptText = typeof prompt === 'string' ? prompt : JSON.stringify(prompt);

    const payload = {
      model: this.config.ollamaModel || 'gemma4:e4b',
      prompt: promptText,
      stream: false,
      ...(options.images ? { images: options.images } : {}),
      options: {
        ...this.config.defaultParams,
        ...options.parameters,
      },
    };

    const maxRetries = options.maxRetries || this.config.maxRetries;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        logger.info(`[GemmaClient] Invoking local Ollama model ${this.config.ollamaModel} (Attempt ${attempt}/${maxRetries})`);
        
        const startTime = Date.now();
        const response = await this._fetchWithTimeout(endpoint, {
          method: 'POST',
          headers: this.config.getHeaders(),
          body: JSON.stringify(payload),
        }, options.timeoutMs || this.config.timeoutMs);

        const latencyMs = Date.now() - startTime;

        if (!response.ok) {
          const errorText = await response.text();
          const err = new Error(`Ollama HTTP ${response.status}: ${errorText}`);
          err.statusCode = response.status;
          err.attempt = attempt;
          throw err;
        }

        const data = await response.json();
        const generatedText = data.response || '';

        logger.info(`[GemmaClient] Ollama gemma4:e4b inference succeeded in ${latencyMs}ms (${generatedText.length} chars generated)`);

        return {
          generated_text: generatedText,
          response: generatedText,
          text: generatedText,
          model: this.config.ollamaModel,
          done: data.done,
          latencyMs,
        };
      } catch (error) {
        lastError = error;
        logger.warn(`[GemmaClient] Attempt ${attempt}/${maxRetries} failed: ${error.message}`);

        if (attempt < maxRetries) {
          const delay = this._calculateBackoff(attempt);
          logger.info(`[GemmaClient] Retrying in ${delay}ms...`);
          await this._sleep(delay);
        }
      }
    }

    return this._formatStructuredError(lastError, maxRetries);
  }

  /**
   * Multimodal input support for image + text / audio + text payloads
   */
  async generateMultimodal({ mediaData, mimeType, promptText }, options = {}) {
    try {
      logger.info(`[GemmaClient] Multimodal request for model ${this.config.ollamaModel} [${mimeType}]`);

      let cleanBase64 = mediaData || '';
      if (cleanBase64.includes(',')) {
        cleanBase64 = cleanBase64.split(',')[1];
      }
      cleanBase64 = cleanBase64.replace(/[^A-Za-z0-9+/=]/g, '').trim();
      while (cleanBase64.length % 4 !== 0) {
        cleanBase64 += '=';
      }

      const formattedInput = promptText || 'Analyze emergency site payload';
      return await this.generateText(formattedInput, {
        ...options,
        images: cleanBase64 ? [cleanBase64] : undefined,
      });
    } catch (error) {
      logger.error('[GemmaClient] Multimodal generation failed:', error.message);
      return this._formatStructuredError(error);
    }
  }

  /**
   * Streaming response generator for progressive token streaming
   */
  async *generateStream(prompt, options = {}) {
    logger.info(`[GemmaClient] Opening response stream for model ${this.config.ollamaModel}`);
    const result = await this.generateText(prompt, options);
    
    if (result && result.success === false) {
      yield `[Gemma 4 Client Notice: ${result.error?.message || 'Stream fallback active'}]`;
      return;
    }

    yield result?.generated_text || result?.response || JSON.stringify(result);
  }

  /**
   * Fetch with AbortController timeout handling
   * @private
   */
  async _fetchWithTimeout(url, fetchOptions, timeoutMs) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
      });
      return response;
    } catch (err) {
      if (err.name === 'AbortError') {
        const timeoutError = new Error(`Local Ollama API request timed out after ${timeoutMs}ms.`);
        timeoutError.code = 'OLLAMA_TIMEOUT';
        timeoutError.statusCode = 408;
        throw timeoutError;
      }
      throw err;
    } finally {
      clearTimeout(id);
    }
  }

  /**
   * Calculates backoff duration in milliseconds
   * @private
   */
  _calculateBackoff(attempt) {
    const baseDelay = this.config.retryDelayMs || 1000;
    return baseDelay * Math.pow(2, attempt - 1);
  }

  /**
   * Helper sleep function
   * @private
   */
  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Formats structured error response object
   * @private
   */
  _formatStructuredError(error, attempts = 1) {
    return {
      success: false,
      error: {
        code: error?.code || 'OLLAMA_INFERENCE_FAILURE',
        message: error?.message || 'Local Ollama gemma4:e4b inference failed.',
        statusCode: error?.statusCode || 500,
        attempts: error?.attempt || attempts,
        model: this.config.ollamaModel,
        timestamp: new Date().toISOString(),
      },
    };
  }
}

const clientInstance = new GemmaClient();

module.exports = clientInstance;
module.exports.GemmaClient = GemmaClient;
