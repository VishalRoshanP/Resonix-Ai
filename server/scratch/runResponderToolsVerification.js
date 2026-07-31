/**
 * Responder Operational Tools Verification Suite
 */

const toolRegistry = require('../services/tools/toolRegistry');
const gemmaFunctionCallingService = require('../services/pipeline/gemmaFunctionCallingService');
const incidentService = require('../services/incidentService');
const responderOperationService = require('../services/responderOperationService');

async function runResponderToolsVerification() {
  console.log('================================================================');
  console.log('    RESPONDER OPERATIONAL TOOLS VERIFICATION SUITE              ');
  console.log('================================================================\n');

  const checks = [];
  function recordCheck(id, title, passed, details) {
    checks.push({ id, title, passed, details });
    const mark = passed ? '✓ PASS' : '❌ FAIL';
    console.log(`${mark} [ResponderTools-${id}] ${title}`);
    console.log(`        Details: ${details}\n`);
  }

  // 1. Setup real test incident
  const testIncident = await incidentService.createIncident({
    title: 'Responder Operations Test Incident',
    category: 'FIRE',
    sector: 'Sector 4',
    description: 'Factory fire with chemical smoke hazard',
  });

  const incidentId = String(testIncident._id);

  // ─── Check 1: Tool Registry Registration ──────────────────────────────────
  const requiredTools = ['assignResponder', 'notifyResponder', 'escalateIncident', 'generateResponderSummary'];
  const allRegistered = requiredTools.every((t) => toolRegistry.isValidTool(t));

  recordCheck(1, 'Expose Responder Operations to Gemma in ToolRegistry',
    allRegistered,
    `Registered 4 required responder tools: [${requiredTools.join(', ')}].`
  );

  // ─── Check 2: Tool 1 — assignResponder Execution & Auth Check ───────────────
  const assignCall = {
    tool_name: 'assignResponder',
    parameters: {
      incidentId,
      responderId: 'resp_ndrf_squad_04',
      squadName: 'NDRF Chemical Hazard Squad #4',
      authContext: { isAuthenticated: true, role: 'responder', user: 'Commander Officer' },
    },
    confidence: 0.96,
    reasoning: 'Chemical fire requires assigning specialized NDRF squad.',
  };

  const assignRes = await gemmaFunctionCallingService.processToolCallRequest(assignCall);
  const assignOk = assignRes.executed === true && assignRes.result?.status === 'RESPONDER_ASSIGNED';

  recordCheck(2, 'Tool 1: assignResponder() Execution & Auth Verification',
    assignOk,
    `Assigned squad '${assignRes.result?.squadName}' to incident '${incidentId}' by '${assignRes.result?.assignedBy}'.`
  );

  // ─── Check 3: Tool 2 — notifyResponder Execution ───────────────────────────
  const notifyCall = {
    tool_name: 'notifyResponder',
    parameters: {
      responderId: 'resp_ndrf_squad_04',
      sector: 'Sector 4',
      message: 'Deploy chemical foam units to Sector 4 factory immediately',
      priority: 'CRITICAL',
      authContext: { isAuthenticated: true, role: 'responder', user: 'Dispatch Command' },
    },
    confidence: 0.97,
    reasoning: 'Critical chemical fire alert broadcast.',
  };

  const notifyRes = await gemmaFunctionCallingService.processToolCallRequest(notifyCall);
  const notifyOk = notifyRes.executed === true && notifyRes.result?.status === 'NOTIFICATION_DELIVERED';

  recordCheck(3, 'Tool 2: notifyResponder() Dispatch Execution',
    notifyOk,
    `Notification '${notifyRes.result?.notificationId}' delivered to responder '${notifyRes.result?.responderId}'.`
  );

  // ─── Check 4: Tool 3 — escalateIncident Execution (Commander Authorization)
  const escalateCall = {
    tool_name: 'escalateIncident',
    parameters: {
      incidentId,
      escalationLevel: 'LEVEL_1_CRITICAL',
      escalationReason: 'Chemical storage tanks at risk of secondary explosion',
      authContext: { isAuthenticated: true, role: 'commander', user: 'Chief Incident Commander' },
    },
    confidence: 0.98,
    reasoning: 'Explosion risk requires Level 1 Critical escalation.',
  };

  const escalateRes = await gemmaFunctionCallingService.processToolCallRequest(escalateCall);
  const escalateOk = escalateRes.executed === true && escalateRes.result?.status === 'INCIDENT_ESCALATED';

  recordCheck(4, 'Tool 3: escalateIncident() Execution (Commander Auth Verified)',
    escalateOk,
    `Escalated incident '${incidentId}' to '${escalateRes.result?.escalationLevel}' (Priority: ${escalateRes.result?.newPriority}).`
  );

  // ─── Check 5: Tool 4 — generateResponderSummary Execution & Privacy Controls
  const summaryCall = {
    tool_name: 'generateResponderSummary',
    parameters: {
      incidentId,
      userRole: 'responder',
      authContext: { isAuthenticated: true, role: 'responder', user: 'Tactical Reviewer' },
    },
    confidence: 0.95,
    reasoning: 'Generate tactical summary for responder review.',
  };

  const summaryRes = await gemmaFunctionCallingService.processToolCallRequest(summaryCall);
  const summaryOk = summaryRes.executed === true && summaryRes.result?.accessLevel === 'FULL_TACTICAL_ACCESS';

  recordCheck(5, 'Tool 4: generateResponderSummary() Execution & Privacy Access Level',
    summaryOk,
    `Tactical summary generated: "${summaryRes.result?.tacticalSummary}". Access: '${summaryRes.result?.accessLevel}'.`
  );

  // ─── Check 6: Authentication & Authorization Security Enforcer Audit ────────
  let unauthRejected = false;
  let unauthorizedRejected = false;

  try {
    // Test 1: Unauthenticated request must fail
    await responderOperationService.escalateIncident({
      incidentId,
      escalationLevel: 'LEVEL_1_CRITICAL',
      escalationReason: 'Test unauth',
      authContext: { isAuthenticated: false },
    });
  } catch (err) {
    unauthRejected = err.message.includes('Authentication required');
  }

  try {
    // Test 2: Citizen role attempting commander escalation must fail
    await responderOperationService.escalateIncident({
      incidentId,
      escalationLevel: 'LEVEL_1_CRITICAL',
      escalationReason: 'Test unauthorized citizen',
      authContext: { isAuthenticated: true, role: 'citizen' },
    });
  } catch (err) {
    unauthorizedRejected = err.message.includes('Access denied');
  }

  recordCheck(6, 'Do Not Bypass Authentication or Authorization Security Audit',
    unauthRejected && unauthorizedRejected,
    `Unauthenticated request blocked: ${unauthRejected}. Unauthorized role request blocked: ${unauthorizedRejected}.`
  );

  // ─── Final Summary ────────────────────────────────────────────────────────
  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.length - passed;

  console.log('================================================================');
  console.log(`  RESPONDER TOOLS SUMMARY: ${passed} / ${checks.length} CHECKS PASSED (${failed} FAILED)`);
  console.log('================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runResponderToolsVerification();
