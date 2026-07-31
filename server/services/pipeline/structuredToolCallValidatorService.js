/**
 * Structured Tool Call Validator Service for RESONIX AI
 * 
 * Capabilities:
 * - Enforces the required Structured Tool Call Schema for Gemma AI Function Calling:
 *   {
 *     "tool_name": string (must be registered in ToolRegistry),
 *     "parameters": object (must pass ToolRegistry parameter validation),
 *     "confidence": number (float between 0.00 and 1.00),
 *     "reasoning": string (non-empty justification explanation)
 *   }
 * - Validates every incoming AI tool request.
 * - Rejects malformed, incomplete, or invalid tool calls safely without executing.
 * - Returns structured validation report with detailed diagnostic feedback.
 */

const toolRegistry = require('../tools/toolRegistry');
const logger = require('../../utils/logger');

class StructuredToolCallValidatorService {
  /**
   * Validates a candidate tool call request against the strict Structured Tool Call Schema
   * @param {Object} candidateRequest - Candidate object from Gemma response
   * @returns {Object} Validation result { isValid, toolName, parameters, confidence, reasoning, errors, sanitizedRequest }
   */
  validateToolCall(candidateRequest = {}) {
    const errors = [];
    const typeErrors = [];

    if (!candidateRequest || typeof candidateRequest !== 'object' || Array.isArray(candidateRequest)) {
      return {
        isValid: false,
        errors: ['Candidate tool request must be a valid JSON object.'],
        sanitizedRequest: null,
      };
    }

    // 1. Validate `tool_name`
    const rawToolName = candidateRequest.tool_name || candidateRequest.toolName || candidateRequest.name;
    let toolName = '';

    if (typeof rawToolName !== 'string' || !rawToolName.trim()) {
      errors.push("Missing or invalid 'tool_name': must be a non-empty string.");
    } else {
      toolName = rawToolName.trim();
      if (!toolRegistry.isValidTool(toolName)) {
        errors.push(`Unknown tool '${toolName}': tool is not registered in central ToolRegistry.`);
      }
    }

    // 2. Validate `parameters`
    const rawParams = candidateRequest.parameters || candidateRequest.params;
    let sanitizedParams = null;

    if (!rawParams || typeof rawParams !== 'object' || Array.isArray(rawParams)) {
      errors.push("Missing or invalid 'parameters': must be a valid JSON object.");
    } else if (toolName && toolRegistry.isValidTool(toolName)) {
      const paramCheck = toolRegistry.validateParameters(toolName, rawParams);
      if (!paramCheck.isValid) {
        errors.push(...paramCheck.errors);
      } else {
        sanitizedParams = paramCheck.sanitizedParams;
      }
    }

    // 3. Validate `confidence`
    const rawConfidence = candidateRequest.confidence !== undefined ? candidateRequest.confidence : candidateRequest.confidenceScore;
    let confidence = 0.0;

    if (rawConfidence === undefined || rawConfidence === null || isNaN(Number(rawConfidence))) {
      errors.push("Missing or invalid 'confidence': must be a number between 0.00 and 1.00.");
    } else {
      confidence = Number(rawConfidence);
      if (confidence < 0.0 || confidence > 1.0) {
        errors.push(`Invalid 'confidence' value ${confidence}: must be between 0.00 and 1.00.`);
      }
    }

    // 4. Validate `reasoning`
    const rawReasoning = candidateRequest.reasoning || candidateRequest.reason || candidateRequest.urgencyJustification;
    let reasoning = '';

    if (typeof rawReasoning !== 'string' || !rawReasoning.trim()) {
      errors.push("Missing or invalid 'reasoning': must be a non-empty string explaining the tool call rationale.");
    } else {
      reasoning = rawReasoning.trim();
    }

    const isValid = errors.length === 0;

    if (!isValid) {
      logger.warn(`[StructuredToolCallValidator] Rejected malformed tool call request for '${toolName || 'UNKNOWN'}':`, errors.join(' | '));
    } else {
      logger.info(`[StructuredToolCallValidator] Tool call schema PASSED for '${toolName}' (Confidence: ${confidence}).`);
    }

    return {
      isValid,
      toolName,
      parameters: sanitizedParams,
      confidence,
      reasoning,
      errors,
      sanitizedRequest: isValid ? {
        tool_name: toolName,
        parameters: sanitizedParams,
        confidence: Number(confidence.toFixed(2)),
        reasoning,
        validatedAt: new Date().toISOString(),
      } : null,
    };
  }

  /**
   * Helper to format tool call declaration schema prompt snippet for Gemma
   * @returns {string}
   */
  getStructuredToolCallFormatPrompt() {
    return `[STRUCTURED JSON TOOL CALL FORMAT]
When requesting a backend operation, you MUST return a strict JSON object with fields:
{
  "tool_name": "<registered_tool_name>",
  "parameters": { ... },
  "confidence": 0.95,
  "reasoning": "<1-sentence operational justification>"
}

Do not return free-form text instructions. Use the exact structured JSON tool call schema above.`;
  }
}

const structuredToolCallValidatorService = new StructuredToolCallValidatorService();
module.exports = structuredToolCallValidatorService;
