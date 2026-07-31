/**
 * Stage 4: Gemma Vision Analysis Service
 * 
 * Capabilities:
 * - Interfaces with Gemma 4 Vision Engine (ImageUnderstandingAdapter & gemmaClient)
 * - Runs visual inference for disaster classification, flood depth, fire, collapse, hazards, and infrastructure damage
 */

const imageUnderstandingAdapter = require('../gemma/imageUnderstandingAdapter');
const logger = require('../../utils/logger');

class GemmaVisionAnalysisService {
  /**
   * Executes Gemma 4 Vision Analysis on preprocessed image payload
   * @param {Object} preprocessed - { photoId, processedData, mimeType }
   * @param {string} promptText
   * @param {Object} context
   * @returns {Promise<Object>} Raw Gemma vision analysis result
   */
  async analyzeVision(preprocessed = {}, promptText = '', context = {}) {
    const startTime = Date.now();
    const photoId = preprocessed.photoId || `img_${Date.now()}`;

    logger.info(`[GemmaVisionAnalysisService] Initiating Gemma 4 Vision Inference for photo '${photoId}'...`);

    const rawResult = await imageUnderstandingAdapter.processImage({
      imageData: preprocessed.processedData,
      mimeType: preprocessed.mimeType || 'image/jpeg',
      promptText,
      context,
    });

    const durationMs = Date.now() - startTime;
    logger.info(`[GemmaVisionAnalysisService] Gemma 4 Vision Inference complete for photo '${photoId}' in ${durationMs}ms.`);

    return {
      photoId,
      rawAnalysis: rawResult,
      durationMs,
      analyzedAt: new Date().toISOString(),
    };
  }
}

const gemmaVisionAnalysisService = new GemmaVisionAnalysisService();
module.exports = gemmaVisionAnalysisService;
