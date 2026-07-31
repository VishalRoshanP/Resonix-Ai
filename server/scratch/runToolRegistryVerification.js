/**
 * Tool Registry & Gemma Function Calling Framework Verification Suite
 */

const toolRegistry = require('../services/tools/toolRegistry');
const gemmaFunctionCallingService = require('../services/pipeline/gemmaFunctionCallingService');

async function runToolRegistryVerification() {
  console.log('================================================================');
  console.log('    GEMMA FUNCTION CALLING TOOL REGISTRY VERIFICATION SUITE     ');
  console.log('================================================================\n');

  const checks = [];
  function recordCheck(id, title, passed, details) {
    checks.push({ id, title, passed, details });
    const mark = passed ? '✓ PASS' : '❌ FAIL';
    console.log(`${mark} [ToolRegistry-${id}] ${title}`);
    console.log(`        Details: ${details}\n`);
  }

  // ─── Check 1: Central Tool Registration ───────────────────────────────────
  const schemas = toolRegistry.getAllToolSchemas();
  const regOk = schemas.length >= 4 && schemas.some((s) => s.name === 'dispatch_rescue_team');
  recordCheck(1, 'Register Tools Centrally in Tool Registry',
    regOk,
    `Registered ${schemas.length} core tools centrally. Tool names: [${schemas.map((s) => s.name).join(', ')}].`
  );

  // ─── Check 2: Validate Tool Names ──────────────────────────────────────────
  const validNameOk = toolRegistry.isValidTool('dispatch_rescue_team') === true;
  const invalidNameOk = toolRegistry.isValidTool('unauthorized_shell_exec') === false;
  recordCheck(2, 'Validate Tool Names Against Registry',
    validNameOk && invalidNameOk,
    `Valid tool ('dispatch_rescue_team'): ${validNameOk}. Unknown tool ('unauthorized_shell_exec'): ${invalidNameOk}.`
  );

  // ─── Check 3: Validate Tool Parameters ─────────────────────────────────────
  const validParamTest = toolRegistry.validateParameters('dispatch_rescue_team', {
    incidentId: 'pkt_test_9901',
    teamType: 'NDRF_WATER_RESCUE',
    sector: 'Sector 4',
    priority: 'CRITICAL',
  });

  const invalidParamTest = toolRegistry.validateParameters('dispatch_rescue_team', {
    incidentId: 'pkt_test_9901',
    teamType: 'INVALID_SQUAD_NAME', // Invalid enum value
    sector: 'Sector 4',
    // Missing required priority parameter
  });

  const paramOk = validParamTest.isValid === true && invalidParamTest.isValid === false;
  recordCheck(3, 'Validate Parameters Against Schema (Required & Enum Validation)',
    paramOk,
    `Valid params test passed: ${validParamTest.isValid}. Invalid params test correctly caught ${invalidParamTest.errors.length} errors: [${invalidParamTest.errors.join('; ')}].`
  );

  // ─── Check 4: Route Valid Tool Requests After Pre-Execution Validation ─────
  const execResult = await toolRegistry.executeTool('dispatch_rescue_team', {
    incidentId: 'pkt_route_001',
    teamType: 'NDRF_COLLAPSE_SEARCH',
    sector: 'Sector 2',
    priority: 'CRITICAL',
  });

  const routeOk = execResult.success === true && execResult.result?.status === 'DISPATCHED';
  recordCheck(4, 'Route Valid Tool Requests (Backend Pre-Execution Passed)',
    routeOk,
    `Execution status: ${execResult.result?.status}. Dispatch ID: ${execResult.result?.dispatchId}.`
  );

  // ─── Check 5: Reject Unknown Tools Safely ─────────────────────────────────
  const unknownExecResult = await toolRegistry.executeTool('delete_database_records', { confirm: true });
  const unknownOk = unknownExecResult.success === false && unknownExecResult.errors[0].includes('Unknown tool');
  recordCheck(5, 'Reject Unknown Tools Safely Without Unhandled Exceptions',
    unknownOk,
    `Execution safely rejected: "${unknownExecResult.errors[0]}".`
  );

  // ─── Check 6: Process Function Call Request via GemmaFunctionCallingService
  const rawGemmaOutputWithToolCall = {
    tool_call: {
      name: 'broadcast_emergency_alert',
      parameters: {
        sector: 'Sector 4',
        message: 'Evacuate low-lying areas immediately due to rising dam discharge',
        alertLevel: 'RED',
      },
    },
  };

  const processResult = await gemmaFunctionCallingService.processToolCallRequest(rawGemmaOutputWithToolCall);
  const processOk = processResult.processed === true && processResult.isValid === true && processResult.executed === true;
  recordCheck(6, 'Process Tool Call Request via GemmaFunctionCallingService',
    processOk,
    `Tool call '${processResult.toolName}' processed & executed safely. Result status: ${processResult.result?.status}.`
  );

  // ─── Check 7: Enforce Security Rule: Backend Always Validates Before Execution
  const rawGemmaMaliciousCall = {
    tool_call: {
      name: 'dispatch_rescue_team',
      parameters: {
        incidentId: 'pkt_malicious_001',
        teamType: 'MALICIOUS_HACK_TYPE', // Invalid teamType
        sector: 'Sector 4',
        priority: 'CRITICAL',
      },
    },
  };

  const maliciousResult = await gemmaFunctionCallingService.processToolCallRequest(rawGemmaMaliciousCall);
  const securityOk = maliciousResult.isValid === false && maliciousResult.executed === false;
  recordCheck(7, 'Backend Pre-Execution Validation Blocks Invalid AI Requests',
    securityOk,
    `Invalid AI request blocked before execution: isValid=${maliciousResult.isValid}, executed=${maliciousResult.executed}. Errors: [${maliciousResult.errors.join('; ')}].`
  );

  // ─── Print Tool Declaration Prompt Snippet ─────────────────────────────────
  console.log('--- GEMMA FUNCTION CALLING TOOL DECLARATION PROMPT ---');
  const declPrompt = gemmaFunctionCallingService.getToolDeclarationPrompt();
  console.log(declPrompt.substring(0, 320) + '...\n');

  // ─── Final Summary ─────────────────────────────────────────────────────────
  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.length - passed;

  console.log('================================================================');
  console.log(`  TOOL REGISTRY SUMMARY: ${passed} / ${checks.length} CHECKS PASSED (${failed} FAILED)`);
  console.log('================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runToolRegistryVerification();
