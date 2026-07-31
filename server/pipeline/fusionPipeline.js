/**
 * Fusion Pipeline for Gemma 4 E4B
 * Multi-step pipeline that evaluates incoming reports against active incidents
 * to detect duplicates and merge related incident clusters.
 */

const gemmaService = require('../services/gemma');
const logger = require('../utils/logger');

class FusionPipeline {
  /**
   * Executes incident fusion and deduplication workflow
   * @param {Object} params
   * @param {Object} params.targetIncident - New or candidate incident
   * @param {Array<Object>} params.existingIncidents - Array of active incidents
   * @returns {Promise<Object>} Fusion analysis & merged incident payload
   */
  async execute({ targetIncident, existingIncidents = [] } = {}) {
    logger.info('[FusionPipeline] Starting incident fusion pipeline');
    const startTime = Date.now();

    try {
      let isMerged = false;
      let mergedIncidentResult = null;
      let fusedWithId = null;

      for (const existing of existingIncidents) {
        const mergeAnalysis = await gemmaService.mergeIncidents({
          incidentA: targetIncident,
          incidentB: existing,
        });

        if (mergeAnalysis.isDuplicate || mergeAnalysis.confidenceScore > 0.8) {
          isMerged = true;
          fusedWithId = existing.id || existing._id;
          mergedIncidentResult = mergeAnalysis;
          logger.info(`[FusionPipeline] Candidate incident fused with existing incident ${fusedWithId}`);
          break;
        }
      }

      const durationMs = Date.now() - startTime;
      return {
        success: true,
        pipeline: 'INCIDENT_FUSION',
        durationMs,
        result: {
          isMerged,
          fusedWithId,
          mergedIncident: mergedIncidentResult,
          standaloneIncident: isMerged ? null : targetIncident,
        },
      };
    } catch (error) {
      logger.error('[FusionPipeline] Fusion pipeline failed:', error.message);
      return {
        success: false,
        pipeline: 'INCIDENT_FUSION',
        error: error.message,
        durationMs: Date.now() - startTime,
      };
    }
  }
}

module.exports = new FusionPipeline();
