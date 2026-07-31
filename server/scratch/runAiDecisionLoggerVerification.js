/**
 * AI Decision Logging & Responder Audit Trail Verification Suite
 */

const aiDecisionLoggerService = require('../services/tools/aiDecisionLoggerService');
const secureToolExecutionLayer = require('../services/tools/secureToolExecutionLayer');
const incidentService = require('../services/incidentService');

async function runAiDecisionLoggerVerification() {
  console.log('================================================================');
  console.log('      AI DECISION LOGGING & AUDIT TRAIL VERIFICATION SUITE       ');
  console.log('================================================================\n');

  const checks = [];
  function recordCheck(id, title, passed, details) {
    checks.push({ id, title, passed, details });
    const mark = passed ? '✓ PASS' : '❌ FAIL';
    console.log(`${mark} [AiDecisionLog-${id}] ${title}`);
    console.log(`        Details: ${details}\n`);
  }

  // 1. Setup real test incident
  const testIncident = await incidentService.createIncident({
    title: 'AI Decision Logging QA Incident',
    category: 'FLOOD',
    sector: 'Sector 4',
    description: 'Dam release alert inundating low-lying residential sector',
  });
  const incidentId = String(testIncident._id);

  // ─── Check 1: Store 7 Required Decision Fields ─────────────────────────────
  const testDecision = await aiDecisionLoggerService.logDecision({
    incidentId,
    toolSelected: 'dispatch_rescue_team',
    parameters: { incidentId, teamType: 'NDRF_WATER_RESCUE', sector: 'Sector 4', priority: 'CRITICAL' },
    confidence: 0.98,
    reasoning: 'Rising inundation water levels demand immediate water rescue squad dispatch per NDMA flood SOPs.',
    executionResult: { status: 'DISPATCHED', dispatchId: 'dsp_88192' },
    gatesPassed: 6,
    status: 'SUCCESS',
    authContext: { isAuthenticated: true, role: 'commander', user: 'Incident Commander' },
  });

  const hasAllFields = Boolean(
    testDecision.incidentId &&
    testDecision.toolSelected &&
    testDecision.parameters &&
    testDecision.confidence === 0.98 &&
    testDecision.reasoning &&
    testDecision.executionResult &&
    testDecision.timestamp
  );

  recordCheck(1, 'Store 7 Required Decision Fields (Incident ID, Tool, Params, Confidence, Reasoning, Result, Timestamp)',
    hasAllFields,
    `Logged Decision ID '${testDecision.decisionId}'. IncidentID: '${testDecision.incidentId}', Tool: '${testDecision.toolSelected}', Confidence: ${testDecision.confidence}.`
  );

  // ─── Check 2: Secure Layer Automated Decision Logging ─────────────────────
  const secureReq = {
    tool_name: 'broadcast_emergency_alert',
    parameters: {
      sector: 'Sector 4',
      message: 'Evacuate immediately to designated relief shelters',
      alertLevel: 'RED',
    },
    confidence: 0.96,
    reasoning: 'RED alert broadcast required for Sector 4 dam overflow emergency.',
  };

  const execRes = await secureToolExecutionLayer.executeToolCall(secureReq, { isAuthenticated: true, role: 'commander', user: 'Dispatch Chief' });
  const autoLogged = Boolean(execRes.success && execRes.decisionLog?.decisionId && execRes.decisionLog?.toolSelected === 'broadcast_emergency_alert');

  recordCheck(2, 'Automated Secure Execution Decision Logging Integration',
    autoLogged,
    `Secure layer automatically logged decision '${execRes.decisionLog?.decisionId}' for tool '${execRes.toolName}'.`
  );

  // ─── Check 3: Maintain Audit Trail for Responder Review ───────────────────
  const history = await aiDecisionLoggerService.getDecisionHistory({ incidentId });
  const auditTrailOk = Array.isArray(history) && history.length >= 1;

  recordCheck(3, 'Maintain Filterable Audit Trail for Responder Review',
    auditTrailOk,
    `Retrieved ${history.length} decision records for incident '${incidentId}'. Latest tool: '${history[0]?.toolSelected}'.`
  );

  // ─── Check 4: Decision Record Lookup by DecisionID ────────────────────────
  const singleRec = await aiDecisionLoggerService.getDecisionById(testDecision.decisionId);
  const lookupOk = Boolean(singleRec && singleRec.decisionId === testDecision.decisionId);

  recordCheck(4, 'Get Single Decision Record by Decision ID',
    lookupOk,
    `Retrieved record '${singleRec?.decisionId}': Reasoning="${singleRec?.reasoning.substring(0, 50)}...".`
  );

  // ─── Print AI Decision Record JSON Example ───────────────────────────────
  console.log('--- AI DECISION RECORD AUDIT TRAIL SAMPLE ---');
  console.log(JSON.stringify({
    decisionId: testDecision.decisionId,
    incidentId: testDecision.incidentId,
    toolSelected: testDecision.toolSelected,
    parameters: testDecision.parameters,
    confidence: testDecision.confidence,
    reasoning: testDecision.reasoning,
    executionResult: testDecision.executionResult,
    timestamp: testDecision.timestamp,
  }, null, 2));
  console.log('');

  // ─── Final Summary ────────────────────────────────────────────────────────
  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.length - passed;

  console.log('================================================================');
  console.log(`  AI DECISION LOGGING SUMMARY: ${passed} / ${checks.length} CHECKS PASSED (${failed} FAILED)`);
  console.log('================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runAiDecisionLoggerVerification();
