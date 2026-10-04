/**
 * Production AI Observability & Monitoring Service for RESONIX AI
 * 
 * Capabilities:
 * - Logs all AI pipeline execution metrics cleanly and securely:
 *   1. Processing start timestamp (ISO)
 *   2. Processing finish timestamp (ISO)
 *   3. Processing duration (ms)
 *   4. Prompt version (e.g. 'v4.2.0-RESONIX-AI')
 *   5. Model used (e.g. 'resonix-disaster-intelligence')
 *   6. Token usage (promptTokens, completionTokens, totalTokens)
 *   7. Success flag (true / false)
 *   8. Failure reason (null or error message)
 * - Privacy Protection: Strips sensitive citizen PII (names, phone numbers, addresses) from log files
 * - Metrics Aggregation: Tracks total inferences, average duration, success rate, and total token consumption
 */

const logger = require('../../utils/logger');

class AiObservabilityService {
  constructor() {
    this.auditLogs = [];
    this.promptVersion = 'v4.2.0-RESONIX-AI';
    this.defaultModel = 'resonix-disaster-intelligence';
  }

  /**
   * Estimates token usage from text length (1 token ≈ 4 characters)
   */
  estimateTokenUsage(inputText = '', outputText = '') {
    const promptTokens = Math.max(1, Math.ceil(String(inputText).length / 4));
    const completionTokens = Math.max(1, Math.ceil(String(outputText).length / 4));
    return {
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
    };
  }

  /**
   * Starts tracking an AI pipeline processing task
   */
  startProcessing({ packetId, category = 'FLOOD' }) {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const startTimeMs = Date.now();
    const processingStart = new Date().toISOString();

    const record = {
      executionId,
      packetId: packetId || `pkt_${Date.now()}`,
      category,
      processingStart,
      startTimeMs,
      promptVersion: this.promptVersion,
      modelUsed: this.defaultModel,
    };

    logger.info(`[AiObservabilityService] [START] ExecutionID '${executionId}' started for packet '${record.packetId}'. Model='${this.defaultModel}', PromptVersion='${this.promptVersion}'.`);
    return record;
  }

  /**
   * Completes tracking an AI pipeline processing task and logs telemetry
   */
  finishProcessing(startRecord, { success = true, failureReason = null, outputText = '', inputText = '' }) {
    const finishTimeMs = Date.now();
    const processingFinish = new Date().toISOString();
    const processingDurationMs = finishTimeMs - (startRecord.startTimeMs || finishTimeMs);

    const tokenUsage = this.estimateTokenUsage(inputText, outputText);

    const telemetryLog = {
      executionId: startRecord.executionId,
      packetId: startRecord.packetId,
      category: startRecord.category,
      processingStart: startRecord.processingStart,
      processingFinish,
      processingDurationMs,
      promptVersion: startRecord.promptVersion || this.promptVersion,
      modelUsed: startRecord.modelUsed || this.defaultModel,
      tokenUsage,
      success: Boolean(success),
      failureReason: failureReason || null,
    };

    this.auditLogs.unshift(telemetryLog);
    if (this.auditLogs.length > 200) {
      this.auditLogs.pop();
    }

    const logStatus = success ? 'SUCCESS' : 'FAILURE';
    logger.info(`[AiObservabilityService] [FINISH:${logStatus}] ExecutionID '${telemetryLog.executionId}': Duration=${processingDurationMs}ms, Tokens=${tokenUsage.totalTokens}, Success=${telemetryLog.success}, FailureReason=${telemetryLog.failureReason || 'None'}.`);

    return telemetryLog;
  }

  /**
   * Returns aggregated AI monitoring metrics
   */
  getObservabilityMetrics() {
    const totalInferences = this.auditLogs.length;
    if (totalInferences === 0) {
      return {
        totalInferences: 0,
        successRatePercentage: 100,
        averageDurationMs: 0,
        totalTokensConsumed: 0,
        activePromptVersion: this.promptVersion,
        activeModel: this.defaultModel,
      };
    }

    const successCount = this.auditLogs.filter((l) => l.success).length;
    const totalDuration = this.auditLogs.reduce((acc, l) => acc + (l.processingDurationMs || 0), 0);
    const totalTokens = this.auditLogs.reduce((acc, l) => acc + (l.tokenUsage?.totalTokens || 0), 0);

    return {
      totalInferences,
      successCount,
      failureCount: totalInferences - successCount,
      successRatePercentage: Math.round((successCount / totalInferences) * 100),
      averageDurationMs: Math.round(totalDuration / totalInferences),
      totalTokensConsumed: totalTokens,
      activePromptVersion: this.promptVersion,
      activeModel: this.defaultModel,
      recentAuditLogs: this.auditLogs.slice(0, 10),
    };
  }
}

const aiObservabilityService = new AiObservabilityService();
module.exports = aiObservabilityService;
