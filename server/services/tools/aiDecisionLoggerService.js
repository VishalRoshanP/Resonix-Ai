/**
 * AI Decision Logger Service for RESONIX AI
 * 
 * Capabilities:
 * - Logs every AI decision related to function calling.
 * - Stores:
 *   • incidentId
 *   • toolSelected
 *   • parameters
 *   • confidence
 *   • reasoning
 *   • executionResult
 *   • timestamp
 * - Maintains persistent audit trail in MongoDB (AiDecisionRecord) & in-memory buffer.
 * - Exposes audit trail APIs for responder review and command center auditability.
 */

const mongoose = require('mongoose');
const AiDecisionRecord = require('../../models/AiDecisionRecord');
const logger = require('../../utils/logger');

class AiDecisionLoggerService {
  constructor() {
    this.inMemoryDecisionLogs = [];
  }

  /**
   * Logs an AI function calling decision
   * @param {Object} decisionData - { incidentId, toolSelected, parameters, confidence, reasoning, executionResult, gatesPassed, status, authContext }
   * @returns {Promise<Object>} Logged decision record
   */
  async logDecision(decisionData = {}) {
    const {
      incidentId = null,
      toolSelected = 'unknown_tool',
      parameters = {},
      confidence = 0.95,
      reasoning = 'Gemma AI operational decision',
      executionResult = {},
      gatesPassed = 6,
      status = 'SUCCESS',
      authContext = {},
    } = decisionData;

    const user = authContext.user || 'Gemma AI Engine';
    const role = authContext.role || 'system_operator';
    const timestamp = new Date();
    const decisionId = `dec_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const logEntry = {
      decisionId,
      incidentId: incidentId ? String(incidentId) : null,
      toolSelected,
      parameters,
      confidence: Number(confidence),
      reasoning,
      executionResult,
      gatesPassed,
      status,
      user,
      role,
      timestamp,
    };

    // 1. Store in memory buffer for instant responder retrieval
    this.inMemoryDecisionLogs.push(logEntry);

    // 2. Persist to MongoDB if connected
    if (mongoose.connection.readyState === 1) {
      try {
        await AiDecisionRecord.create(logEntry);
        logger.info(`[AiDecisionLogger] Persisted decision '${decisionId}' for tool '${toolSelected}' to MongoDB.`);
      } catch (err) {
        logger.warn(`[AiDecisionLogger] MongoDB decision persistence warning: ${err.message}`);
      }
    }

    logger.info(`[AiDecisionLogger] AI DECISION LOGGED: ${decisionId} | Incident: '${incidentId || 'N/A'}' | Tool: '${toolSelected}' | Confidence: ${confidence} | User: ${user} (${role}).`);

    return logEntry;
  }

  /**
   * Get decision history for responder review
   * @param {Object} filters - { incidentId, toolSelected, limit }
   * @returns {Promise<Object[]>} Array of decision records
   */
  async getDecisionHistory(filters = {}) {
    const { incidentId, toolSelected, limit = 50 } = filters;

    if (mongoose.connection.readyState === 1) {
      try {
        const query = {};
        if (incidentId) query.incidentId = String(incidentId);
        if (toolSelected) query.toolSelected = toolSelected;

        return await AiDecisionRecord.find(query).sort({ timestamp: -1 }).limit(limit);
      } catch (err) {
        logger.warn(`[AiDecisionLogger] Mongo history lookup fallback: ${err.message}`);
      }
    }

    // In-memory fallback filtering
    let results = [...this.inMemoryDecisionLogs];
    if (incidentId) {
      results = results.filter((d) => String(d.incidentId) === String(incidentId));
    }
    if (toolSelected) {
      results = results.filter((d) => d.toolSelected === toolSelected);
    }

    return results.slice(-limit).reverse();
  }

  /**
   * Get specific decision log entry by decisionId
   */
  async getDecisionById(decisionId) {
    if (mongoose.connection.readyState === 1) {
      try {
        const dbRecord = await AiDecisionRecord.findOne({ decisionId });
        if (dbRecord) return dbRecord;
      } catch (err) {
        // Fallback
      }
    }

    return this.inMemoryDecisionLogs.find((d) => d.decisionId === decisionId) || null;
  }
}

const aiDecisionLoggerService = new AiDecisionLoggerService();
module.exports = aiDecisionLoggerService;
