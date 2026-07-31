/**
 * Structured Tool Call Validation Verification Suite
 */

const structuredToolCallValidatorService = require('../services/pipeline/structuredToolCallValidatorService');
const gemmaFunctionCallingService = require('../services/pipeline/gemmaFunctionCallingService');

async function runStructuredToolCallVerification() {
  console.log('================================================================');
  console.log('     STRUCTURED TOOL CALL VALIDATION VERIFICATION SUITE         ');
  console.log('================================================================\n');

  const checks = [];
  function recordCheck(id, title, passed, details) {
    checks.push({ id, title, passed, details });
    const mark = passed ? '✓ PASS' : '❌ FAIL';
    console.log(`${mark} [StructuredTool-${id}] ${title}`);
    console.log(`        Details: ${details}\n`);
  }

  // ─── 1. Valid Structured Tool Call Request ────────────────────────────────
  const validRequest = {
    tool_name: 'dispatch_rescue_team',
    parameters: {
      incidentId: 'pkt_struct_001',
      teamType: 'NDRF_WATER_RESCUE',
      sector: 'Sector 4',
      priority: 'CRITICAL',
    },
    confidence: 0.96,
    reasoning: 'Critical water inundation reported in Sector 4 requires immediate water rescue squad dispatch per NDMA flood SOPs.',
  };

  const val1 = structuredToolCallValidatorService.validateToolCall(validRequest);
  recordCheck(1, 'Valid Structured Tool Call Schema ({ tool_name, parameters, confidence, reasoning })',
    val1.isValid === true && val1.confidence === 0.96 && Boolean(val1.reasoning),
    `Schema validation PASSED for '${val1.toolName}'. Confidence: ${val1.confidence}, Reasoning: "${val1.reasoning.substring(0, 50)}...".`
  );

  // ─── 2. Reject Missing or Unknown tool_name ────────────────────────────────
  const invalidNameReq = {
    tool_name: 'unauthorized_cmd_exec',
    parameters: { incidentId: 'pkt_001' },
    confidence: 0.90,
    reasoning: 'Attempting unknown tool call',
  };

  const val2 = structuredToolCallValidatorService.validateToolCall(invalidNameReq);
  recordCheck(2, 'Reject Unknown tool_name Safely',
    val2.isValid === false && val2.errors[0].includes('Unknown tool'),
    `Correctly caught unknown tool name: "${val2.errors[0]}".`
  );

  // ─── 3. Reject Malformed Parameters ───────────────────────────────────────
  const invalidParamReq = {
    tool_name: 'dispatch_rescue_team',
    parameters: {
      incidentId: 'pkt_struct_002',
      teamType: 'INVALID_ENUM_NAME', // Bad enum
      sector: 'Sector 2',
      // Missing priority
    },
    confidence: 0.92,
    reasoning: 'Invalid team type parameters',
  };

  const val3 = structuredToolCallValidatorService.validateToolCall(invalidParamReq);
  recordCheck(3, 'Reject Malformed or Incomplete Parameters Schema',
    val3.isValid === false && val3.errors.length >= 2,
    `Correctly caught ${val3.errors.length} parameter errors: [${val3.errors.join('; ')}].`
  );

  // ─── 4. Reject Invalid Confidence Score (Must be Number 0.00-1.00) ────────
  const invalidConfReq = {
    tool_name: 'broadcast_emergency_alert',
    parameters: {
      sector: 'Sector 4',
      message: 'Evacuate now',
      alertLevel: 'RED',
    },
    confidence: 1.85, // Invalid range (> 1.0)
    reasoning: 'High urgency broadcast',
  };

  const val4 = structuredToolCallValidatorService.validateToolCall(invalidConfReq);
  recordCheck(4, 'Reject Invalid Confidence Score (Range Out of Bounds > 1.0)',
    val4.isValid === false && val4.errors[0].includes('confidence'),
    `Correctly caught confidence error: "${val4.errors[0]}".`
  );

  // ─── 5. Reject Missing Reasoning ──────────────────────────────────────────
  const missingReasoningReq = {
    tool_name: 'broadcast_emergency_alert',
    parameters: {
      sector: 'Sector 4',
      message: 'Evacuate now',
      alertLevel: 'RED',
    },
    confidence: 0.95,
    reasoning: '', // Missing
  };

  const val5 = structuredToolCallValidatorService.validateToolCall(missingReasoningReq);
  recordCheck(5, 'Reject Missing or Empty Reasoning Justification',
    val5.isValid === false && val5.errors[0].includes('reasoning'),
    `Correctly caught reasoning error: "${val5.errors[0]}".`
  );

  // ─── 6. GemmaFunctionCallingService Integration Test ─────────────────────
  const validAiOutput = {
    tool_name: 'broadcast_emergency_alert',
    parameters: {
      sector: 'Sector 1',
      message: 'Evacuate to elevated shelters immediately due to dam overflow alert',
      alertLevel: 'RED',
    },
    confidence: 0.98,
    reasoning: 'IMD dam overflow advisory warrants immediate RED level broadcast alert to Sector 1.',
  };

  const execRes = await gemmaFunctionCallingService.processToolCallRequest(validAiOutput);
  const serviceOk = execRes.processed === true && execRes.isValid === true && execRes.executed === true;

  recordCheck(6, 'GemmaFunctionCallingService Execution via Structured Tool Call Schema',
    serviceOk,
    `Processed & executed structured tool call '${execRes.toolName}' (Confidence: ${execRes.confidence}). Status: ${execRes.result?.status}.`
  );

  // ─── 7. Validation Results Summary Object ────────────────────────────────
  const schemaPrompt = structuredToolCallValidatorService.getStructuredToolCallFormatPrompt();
  recordCheck(7, 'Structured Tool Call Declaration Format Prompt Generation',
    typeof schemaPrompt === 'string' && schemaPrompt.includes('tool_name') && schemaPrompt.includes('confidence'),
    `Format prompt generated (${schemaPrompt.length} chars).`
  );

  // ─── Print Structured Tool Call Schema Example ───────────────────────────
  console.log('--- STRUCTURED JSON TOOL CALL SCHEMA EXAMPLE ---');
  console.log(JSON.stringify(validRequest, null, 2));
  console.log('');

  // ─── Final Summary ────────────────────────────────────────────────────────
  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.length - passed;

  console.log('================================================================');
  console.log(`  STRUCTURED TOOL CALL SUMMARY: ${passed} / ${checks.length} CHECKS PASSED (${failed} FAILED)`);
  console.log('================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runStructuredToolCallVerification();
