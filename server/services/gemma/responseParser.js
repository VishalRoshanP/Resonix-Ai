/**
 * Response Parser for Gemma 4 E4B Outputs
 * Handles text cleaning, markdown code-block stripping, structured JSON extraction, and fallback mechanisms.
 */

const logger = require('../../utils/logger');

class ResponseParser {
  /**
   * Cleans raw text response from model
   * @param {Array|Object|string} responsePayload
   * @returns {string} Raw extracted output text
   */
  extractText(responsePayload) {
    if (!responsePayload) return '';

    if (typeof responsePayload === 'string') {
      return responsePayload.trim();
    }

    if (Array.isArray(responsePayload) && responsePayload.length > 0) {
      const first = responsePayload[0];
      return first.generated_text || first.text || JSON.stringify(first);
    }

    if (typeof responsePayload === 'object') {
      return responsePayload.generated_text || responsePayload.text || JSON.stringify(responsePayload);
    }

    return String(responsePayload);
  }

  /**
   * Parses JSON out of model response, removing markdown fence blocks if present
   * @param {Array|Object|string} responsePayload
   * @param {Object} [fallback={}] Fallback object if parsing fails
   * @returns {Object} Parsed JSON object
   */
  parseJson(responsePayload, fallback = {}) {
    const rawText = this.extractText(responsePayload);

    try {
      // 1. Direct JSON parse attempt
      return JSON.parse(rawText);
    } catch (_) {
      // 2. Extract JSON from markdown backticks or matching curly braces
      try {
        const cleaned = rawText
          .replace(/```json/gi, '')
          .replace(/```/g, '')
          .trim();

        return JSON.parse(cleaned);
      } catch (cleanError) {
        // 3. Regex match first `{ ... }` or `[ ... ]` block
        try {
          const jsonMatch = rawText.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
          if (jsonMatch) {
            return JSON.parse(jsonMatch[0]);
          }
        } catch (matchError) {
          logger.warn('[ResponseParser] Failed to extract JSON from Gemma output. Using fallback.', {
            rawTextSnippet: rawText.substring(0, 100),
          });
        }
      }
    }

    return fallback;
  }

  /**
   * Sanitizes streaming token chunks into uniform text strings
   * @param {string|Object} chunk
   * @returns {string} Clean token text
   */
  parseStreamChunk(chunk) {
    if (typeof chunk === 'string') return chunk;
    if (chunk?.token?.text) return chunk.token.text;
    if (chunk?.generated_text) return chunk.generated_text;
    return JSON.stringify(chunk);
  }
}

module.exports = new ResponseParser();
