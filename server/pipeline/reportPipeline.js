/**
 * Unified Emergency Report Processing Pipeline for Gemma 4 E4B
 * Multi-input pipeline combining Voice, Image, Text, GPS, and Language into a single structured emergency object.
 */

const gemmaService = require('../services/gemma');
const logger = require('../utils/logger');

class ReportPipeline {
  /**
   * Executes unified emergency understanding pipeline fusing all available inputs
   * @param {Object} payload
   * @param {Object|string} [payload.voice]
   * @param {Object|string} [payload.image]
   * @param {Object|string} [payload.text]
   * @param {Object} [payload.gps]
   * @param {string} [payload.language='en']
   * @returns {Promise<Object>} Processed unified emergency object
   */
  async execute(payload = {}) {
    logger.info('[ReportPipeline] Starting unified emergency pipeline execution');
    const startTime = Date.now();

    try {
      const unifiedObject = await gemmaService.processUnifiedPipeline({
        voice: payload.voice || payload.audioData || payload.transcript || null,
        image: payload.image || payload.imageData || null,
        text: payload.text || null,
        gps: payload.gps || payload.location || null,
        language: payload.language || payload.metadata?.language || 'en',
      });

      const durationMs = Date.now() - startTime;
      logger.info(`[ReportPipeline] Unified emergency pipeline finished in ${durationMs}ms`);

      return {
        success: true,
        pipeline: 'UNIFIED_EMERGENCY_UNDERSTANDING',
        model: gemmaService.config.hfModel,
        durationMs,
        result: unifiedObject,
      };
    } catch (error) {
      logger.error('[ReportPipeline] Pipeline execution failed:', error.message);
      return {
        success: false,
        pipeline: 'UNIFIED_EMERGENCY_UNDERSTANDING',
        error: error.message,
        durationMs: Date.now() - startTime,
      };
    }
  }
}

module.exports = new ReportPipeline();
