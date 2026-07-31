/**
 * Secure Tool Execution Layer for RESONIX AI
 * 
 * Capabilities:
 * Every tool call MUST pass through a mandatory 6-stage security pipeline:
 * 1. Schema Validation (Verifies top-level structured tool call schema)
 * 2. Permission Validation (RBAC check for role & authentication status)
 * 3. Parameter Validation (Verifies parameter property types, enums, required fields against ToolRegistry schema)
 * 4. Incident Existence Validation (Verifies target incidentId exists in database before executing)
 * 5. Audit Logging (Logs user identity, tool name, execution time, and status)
 * 6. Safe Error Handling (Catches exceptions safely without leaking internal stack traces)
 * 
 * Prevents unauthorized or invalid tool execution across all backend tools.
 */

const toolRegistry = require('./toolRegistry');
const incidentService = require('../incidentService');
const logger = require('../../utils/logger');

class SecureToolExecutionLayer {
  constructor() {
    this.auditLogs = [];
  }

  /**
   * Securely executes a tool call request through the mandatory 6-stage pipeline
   * @param {Object} toolRequest - { tool_name, parameters, confidence, reasoning }
   * @param {Object} authContext - { isAuthenticated, role, user }
   * @returns {Promise<Object>} Execution result { success, gatePassed, toolName, result, errors, auditLog }
   */
  async executeToolCall(toolRequest = {}, authContext = { isAuthenticated: true, role: 'responder', user: 'System Operator' }) {
    const startTime = Date.now();
    const gates = {
      schemaValidation: false,
      permissionValidation: false,
      parameterValidation: false,
      incidentExistenceValidation: false,
      logging: false,
      errorHandling: false,
    };

    const errors = [];
    let sanitizedParams = null;
    let toolName = '';

    // ─── GATE 1: TOP-LEVEL SCHEMA VALIDATION ────────────────────────────────────
    if (!toolRequest || typeof toolRequest !== 'object' || Array.isArray(toolRequest)) {
      errors.push('Schema Validation Failed: Request must be a valid JSON object.');
      return this._handleGateFailure(1, 'SCHEMA_VALIDATION_FAILED', 'UNKNOWN', errors, startTime, authContext, gates);
    }

    const rawToolName = toolRequest.tool_name || toolRequest.toolName || toolRequest.name;
    if (typeof rawToolName !== 'string' || !rawToolName.trim()) {
      errors.push("Schema Validation Failed: Missing or invalid 'tool_name'.");
      return this._handleGateFailure(1, 'SCHEMA_VALIDATION_FAILED', 'UNKNOWN', errors, startTime, authContext, gates);
    }
    toolName = rawToolName.trim();

    if (!toolRegistry.isValidTool(toolName)) {
      errors.push(`Schema Validation Failed: Unknown tool '${toolName}'. Tool is not registered in ToolRegistry.`);
      return this._handleGateFailure(1, 'SCHEMA_VALIDATION_FAILED', toolName, errors, startTime, authContext, gates);
    }

    const rawConfidence = toolRequest.confidence !== undefined ? toolRequest.confidence : toolRequest.confidenceScore;
    if (rawConfidence === undefined || rawConfidence === null || isNaN(Number(rawConfidence)) || Number(rawConfidence) < 0.0 || Number(rawConfidence) > 1.0) {
      errors.push(`Schema Validation Failed: Invalid 'confidence' value ${rawConfidence}: must be a float between 0.00 and 1.00.`);
      return this._handleGateFailure(1, 'SCHEMA_VALIDATION_FAILED', toolName, errors, startTime, authContext, gates);
    }

    const rawReasoning = toolRequest.reasoning || toolRequest.reason;
    if (typeof rawReasoning !== 'string' || !rawReasoning.trim()) {
      errors.push("Schema Validation Failed: Missing or invalid 'reasoning' justification.");
      return this._handleGateFailure(1, 'SCHEMA_VALIDATION_FAILED', toolName, errors, startTime, authContext, gates);
    }

    gates.schemaValidation = true;
    sanitizedParams = toolRequest.parameters || {};

    // ─── GATE 2: PERMISSION VALIDATION (RBAC & AUTHENTICATION) ───────────────
    const permissionCheck = this._validatePermissions(toolName, authContext);
    if (!permissionCheck.isAuthorized) {
      errors.push(permissionCheck.reason);
      return this._handleGateFailure(2, 'PERMISSION_DENIED', toolName, errors, startTime, authContext, gates);
    }
    gates.permissionValidation = true;

    // ─── GATE 3: PARAMETER SCHEMA VALIDATION ────────────────────────────────────
    const paramCheck = toolRegistry.validateParameters(toolName, sanitizedParams);
    if (!paramCheck.isValid) {
      errors.push(...paramCheck.errors);
      return this._handleGateFailure(3, 'PARAMETER_VALIDATION_FAILED', toolName, errors, startTime, authContext, gates);
    }
    gates.parameterValidation = true;
    sanitizedParams = paramCheck.sanitizedParams;

    // ─── GATE 4: INCIDENT EXISTENCE VALIDATION ─────────────────────────────────
    const targetIncidentId = sanitizedParams.incidentId || sanitizedParams.primaryIncidentId;
    if (targetIncidentId) {
      try {
        const incidentExists = await incidentService.getIncidentById(targetIncidentId, authContext.role);
        if (!incidentExists) {
          errors.push(`Incident Existence Validation Failed: Target incident '${targetIncidentId}' does not exist in database.`);
          return this._handleGateFailure(4, 'INCIDENT_NOT_FOUND', toolName, errors, startTime, authContext, gates);
        }
      } catch (err) {
        errors.push(`Incident Existence Validation Exception: ${err.message}`);
        return this._handleGateFailure(4, 'INCIDENT_LOOKUP_ERROR', toolName, errors, startTime, authContext, gates);
      }
    }
    gates.incidentExistenceValidation = true;

    // ─── GATE 5 & 6: SAFE ERROR HANDLING & HANDLER EXECUTION ────────────────────
    gates.errorHandling = true;
    let executionResult = null;

    try {
      logger.info(`[SecureExecutionLayer] All 4 pre-execution security gates PASSED for '${toolName}'. Executing tool.`);
      
      // Inject verified authContext into params for handlers
      sanitizedParams.authContext = authContext;

      executionResult = await toolRegistry.executeTool(toolName, sanitizedParams);
      if (!executionResult.success) {
        errors.push(...executionResult.errors);
        return this._handleGateFailure(6, 'HANDLER_EXECUTION_FAILED', toolName, errors, startTime, authContext, gates);
      }
    } catch (runtimeErr) {
      logger.error(`[SecureExecutionLayer] Runtime Exception in tool '${toolName}':`, runtimeErr.message);
      errors.push(`Tool Execution Runtime Error: ${runtimeErr.message}`);
      return this._handleGateFailure(6, 'RUNTIME_EXCEPTION', toolName, errors, startTime, authContext, gates);
    }

    // ─── GATE 5: AUDIT LOGGING & AI DECISION PERSISTENCE ─────────────────────
    gates.logging = true;
    const durationMs = Date.now() - startTime;
    const aiDecisionLoggerService = require('./aiDecisionLoggerService');

    const auditEntry = {
      auditId: `aud_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      toolName,
      user: authContext.user || 'Anonymous',
      role: authContext.role || 'citizen',
      status: 'SUCCESS',
      gatesPassed: 6,
      durationMs,
      timestamp: new Date().toISOString(),
    };

    this.auditLogs.push(auditEntry);

    // Store comprehensive AI Decision Record with all required fields
    const decisionLog = await aiDecisionLoggerService.logDecision({
      incidentId: targetIncidentId || null,
      toolSelected: toolName,
      parameters: sanitizedParams,
      confidence: toolRequest.confidence !== undefined ? toolRequest.confidence : 0.95,
      reasoning: toolRequest.reasoning || toolRequest.reason || 'Operational tool execution',
      executionResult: executionResult.result,
      gatesPassed: 6,
      status: 'SUCCESS',
      authContext,
    });

    logger.info(`[SecureExecutionLayer] AUDIT LOG: ${auditEntry.auditId} | DecisionID: '${decisionLog.decisionId}' | Tool '${toolName}' executed successfully by ${auditEntry.user} (${auditEntry.role}) in ${durationMs}ms.`);

    return {
      success: true,
      status: 'EXECUTED_SECURELY',
      toolName,
      gatesPassed: 6,
      result: executionResult.result,
      errors: [],
      durationMs,
      auditLog: auditEntry,
      decisionLog,
    };
  }

  /**
   * Helper for Role-Based Permission Check
   */
  _validatePermissions(toolName, authContext = {}) {
    if (!authContext || !authContext.isAuthenticated) {
      return {
        isAuthorized: false,
        reason: 'Authentication Failed: User is not authenticated.',
      };
    }

    const role = (authContext.role || 'citizen').toLowerCase();

    // Map tools to minimum required roles
    const toolRoleRequirements = {
      escalateIncident: ['commander', 'admin'],
      escalate_incident: ['commander', 'admin'],
      mergeIncident: ['commander', 'admin'],
      merge_incident: ['commander', 'admin'],
      dispatch_rescue_team: ['responder', 'commander', 'admin'],
      assignResponder: ['responder', 'commander', 'admin'],
      assign_responder: ['responder', 'commander', 'admin'],
      notifyResponder: ['responder', 'commander', 'admin'],
      notify_responder: ['responder', 'commander', 'admin'],
      updateIncidentPriority: ['responder', 'commander', 'admin'],
      update_incident_priority: ['responder', 'commander', 'admin'],
      updateIncidentStatus: ['responder', 'commander', 'admin'],
      update_incident_status: ['responder', 'commander', 'admin'],
      broadcast_emergency_alert: ['commander', 'admin'],
    };

    const allowedRoles = toolRoleRequirements[toolName];
    if (allowedRoles && !allowedRoles.includes(role)) {
      return {
        isAuthorized: false,
        reason: `Authorization Denied: Tool '${toolName}' requires role [${allowedRoles.join(', ')}]. User has role '${role}'.`,
      };
    }

    return { isAuthorized: true };
  }

  /**
   * Helper to build security gate failure response
   */
  _handleGateFailure(gateNumber, failureCode, toolName, errors, startTime, authContext, gates) {
    const durationMs = Date.now() - startTime;
    const auditEntry = {
      auditId: `aud_fail_${Date.now()}`,
      toolName,
      user: authContext.user || 'Anonymous',
      role: authContext.role || 'unauthenticated',
      status: `FAILED_GATE_${gateNumber}_${failureCode}`,
      gatesPassed: gateNumber - 1,
      errors,
      durationMs,
      timestamp: new Date().toISOString(),
    };

    this.auditLogs.push(auditEntry);
    logger.warn(`[SecureExecutionLayer] SECURITY GATE ${gateNumber} FAILED (${failureCode}) for tool '${toolName}':`, errors.join(' | '));

    return {
      success: false,
      status: `REJECTED_GATE_${gateNumber}_${failureCode}`,
      toolName,
      failedGate: gateNumber,
      failureCode,
      gatesPassed: gateNumber - 1,
      result: null,
      errors,
      durationMs,
      auditLog: auditEntry,
    };
  }

  /**
   * Returns security execution audit trail history
   */
  getAuditLogs() {
    return this.auditLogs;
  }
}

const secureToolExecutionLayer = new SecureToolExecutionLayer();
module.exports = secureToolExecutionLayer;
