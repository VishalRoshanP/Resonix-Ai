/**
 * Priority & Resource Allocation Pipeline for Gemma 4 E4B
 * Multi-step pipeline that evaluates emergency priority, calculates optimal resource dispatch,
 * and generates transparent decision explanations.
 */

const gemmaService = require('../services/gemma');
const logger = require('../utils/logger');

class PriorityPipeline {
  /**
   * Executes priority evaluation, resource recommendation, and rationale generation
   * @param {Object} params
   * @param {Object} params.incident
   * @param {Array} [params.availableResources]
   * @returns {Promise<Object>} Formatted dispatch plan and rationale
   */
  async execute({ incident, availableResources = [] } = {}) {
    logger.info('[PriorityPipeline] Starting priority & resource calculation');
    const startTime = Date.now();

    try {
      // Step 1: Predict urgency score and priority tier
      const priorityPrediction = await gemmaService.predictPriority({
        incidentData: incident,
      });

      // Step 2: Recommend resource allocations based on priority
      const resourceRecommendations = await gemmaService.recommendResources({
        incidentData: incident,
        availableResources,
      });

      // Step 3: Generate human-understandable explanation for commanders
      const explanation = await gemmaService.generateExplanation({
        decisionData: {
          incident,
          priority: priorityPrediction,
          resources: resourceRecommendations,
        },
      });

      const durationMs = Date.now() - startTime;
      return {
        success: true,
        pipeline: 'PRIORITY_RESOURCE_ALLOCATION',
        durationMs,
        result: {
          priority: priorityPrediction,
          resources: resourceRecommendations,
          explanation: explanation.explanation,
        },
      };
    } catch (error) {
      logger.error('[PriorityPipeline] Priority pipeline failed:', error.message);
      return {
        success: false,
        pipeline: 'PRIORITY_RESOURCE_ALLOCATION',
        error: error.message,
        durationMs: Date.now() - startTime,
      };
    }
  }
}

module.exports = new PriorityPipeline();
