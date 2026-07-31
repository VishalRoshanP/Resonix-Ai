/**
 * Gemma Function Calling Framework Service for RESONIX AI
 * 
 * Capabilities:
 * - Provides Gemma 4 with declared backend tool schemas from ToolRegistry.
 * - Parses structured JSON function call requests ({ tool_name, parameters, confidence, reasoning }) from Gemma AI.
 * - Validates tool names, parameters, confidence, and reasoning against strict JSON schema.
 * - Rejects unknown or malformed tools safely without crashing or executing arbitrary code.
 * - STRICT SAFETY RULE: NEVER executes tools directly from raw AI strings. All requests MUST pass backend validation.
 */

const toolRegistry = require('../tools/toolRegistry');
const structuredToolCallValidatorService = require('./structuredToolCallValidatorService');
const logger = require('../../utils/logger');

class GemmaFunctionCallingService {
  /**
   * Generates Tool Declaration Prompt Snippet for Gemma 4 Prompt Builder
   * @returns {string} Formatted tool declaration prompt
   */
  getToolDeclarationPrompt() {
    const schemas = toolRegistry.getAllToolSchemas();
    const formatPrompt = structuredToolCallValidatorService.getStructuredToolCallFormatPrompt();
    let prompt = `${formatPrompt}\n\n[REGISTERED BACKEND OPERATIONAL TOOLS]\n`;

    for (const schema of schemas) {
      prompt += `- Tool: "${schema.name}"\n`;
      prompt += `  Description: ${schema.description}\n`;
      prompt += `  Parameters Schema: ${JSON.stringify(schema.parameters)}\n\n`;
    }

    return prompt.trim();
  }

  /**
   * Processes a candidate tool call request from Gemma AI reasoning
   * STRICT SAFETY STEP: Enforces Structured Tool Call Schema validation before execution!
   * @param {Object} rawGemmaOutput - Candidate AI response JSON or string
   * @returns {Promise<Object>} Processed function call result { processed: true, isValid, executed, toolName, result, errors }
   */
  async processToolCallRequest(rawGemmaOutput = {}) {
    const startTime = Date.now();

    // 1. Extract tool call candidate from Gemma response
    const candidate = this._extractToolCallCandidate(rawGemmaOutput);

    if (!candidate || (!candidate.tool_name && !candidate.name)) {
      return {
        processed: false,
        hasToolCall: false,
        reason: 'No structured tool call request detected in AI response.',
        durationMs: Date.now() - startTime,
      };
    }

    // 2. Route tool request through 6-Stage Secure Tool Execution Layer
    const secureExecutionLayer = require('../tools/secureToolExecutionLayer');
    const authContext = rawGemmaOutput.authContext || { isAuthenticated: true, role: 'responder', user: 'Gemma System Operator' };

    const secureResult = await secureExecutionLayer.executeToolCall(candidate, authContext);

    return {
      processed: true,
      hasToolCall: true,
      isValid: secureResult.success,
      executed: secureResult.success,
      toolName: secureResult.toolName,
      gatesPassed: secureResult.gatesPassed,
      confidence: candidate.confidence || 0.95,
      reasoning: candidate.reasoning || '',
      sanitizedParameters: candidate.parameters,
      result: secureResult.result,
      errors: secureResult.errors,
      auditLog: secureResult.auditLog,
      durationMs: Date.now() - startTime,
      executedAt: new Date().toISOString(),
    };
  }

  /**
   * Helper to extract candidate tool call JSON from raw AI output
   */
  _extractToolCallCandidate(rawOutput = {}) {
    if (!rawOutput) return null;

    // Direct structured JSON object matching schema: { tool_name, parameters, confidence, reasoning }
    if (rawOutput.tool_name && typeof rawOutput.tool_name === 'string') {
      return rawOutput;
    }

    // Nested tool_call / toolCall wrapper
    if (rawOutput.tool_call && typeof rawOutput.tool_call === 'object') {
      return rawOutput.tool_call;
    }
    if (rawOutput.toolCall && typeof rawOutput.toolCall === 'object') {
      return rawOutput.toolCall;
    }

    // Check string output for embedded tool_name JSON
    const textStr = typeof rawOutput === 'string' ? rawOutput : (rawOutput.rawText || rawOutput.userPrompt || '');
    if (textStr && (textStr.includes('tool_name') || textStr.includes('tool_call'))) {
      try {
        const jsonMatch = textStr.match(/\{[\s\S]*"tool_name"[\s\S]*\}/) || textStr.match(/\{[\s\S]*"tool_call"[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          return parsed.tool_call || parsed.toolCall || parsed;
        }
      } catch (err) {
        // Safe string parsing fallback
      }
    }

    return null;
  }
}

const gemmaFunctionCallingService = new GemmaFunctionCallingService();
module.exports = gemmaFunctionCallingService;
