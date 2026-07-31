/**
 * Secure Tool Execution Layer Verification Suite
 */

const secureToolExecutionLayer = require('../services/tools/secureToolExecutionLayer');
const incidentService = require('../services/incidentService');
const gemmaFunctionCallingService = require('../services/pipeline/gemmaFunctionCallingService');

async function runSecureExecutionLayerVerification() {
  console.log('================================================================');
  console.log('    SECURE TOOL EXECUTION LAYER 6-GATE VERIFICATION SUITE       ');
  console.log('================================================================\n');

  const checks = [];
  function recordCheck(id, title, passed, details) {
    checks.push({ id, title, passed, details });
    const mark = passed ? '✓ PASS' : '❌ FAIL';
    console.log(`${mark} [SecurityGate-${id}] ${title}`);
    console.log(`        Details: ${details}\n`);
  }

  // 1. Setup real test incident for Gate 4 validation
  const testIncident = await incidentService.createIncident({
    title: 'Secure Layer Verification Incident',
    category: 'BUILDING_COLLAPSE',
    sector: 'Sector 4',
    description: 'Structure inspection required',
  });
  const validIncidentId = String(testIncident._id);

  // ─── Check 1: Gate 1 — Schema Validation ──────────────────────────────────
  const malformedReq = {
    tool_name: 'dispatch_rescue_team',
    parameters: { sector: 'Sector 4' },
    confidence: 1.95, // Out of bounds > 1.0
    reasoning: '', // Empty
  };

  const res1 = await secureToolExecutionLayer.executeToolCall(malformedReq, { isAuthenticated: true, role: 'responder' });
  recordCheck(1, 'Gate 1: Schema Validation (Rejects Malformed JSON Request)',
    res1.success === false && res1.failedGate === 1,
    `Gate 1 caught malformed schema. Status: '${res1.status}'. Errors: [${res1.errors.join('; ')}].`
  );

  // ─── Check 2: Gate 2 — Permission Validation (Unauthenticated / Unauthorized)
  const unauthCall = {
    tool_name: 'escalateIncident',
    parameters: {
      incidentId: validIncidentId,
      escalationLevel: 'LEVEL_1_CRITICAL',
      escalationReason: 'Test unauth',
    },
    confidence: 0.95,
    reasoning: 'Test unauthenticated execution',
  };

  const res2 = await secureToolExecutionLayer.executeToolCall(unauthCall, { isAuthenticated: false });
  recordCheck(2, 'Gate 2: Permission Validation (Rejects Unauthenticated Execution)',
    res2.success === false && res2.failedGate === 2,
    `Gate 2 caught unauthenticated access: "${res2.errors[0]}".`
  );

  const unauthorizedCall = {
    tool_name: 'escalateIncident',
    parameters: {
      incidentId: validIncidentId,
      escalationLevel: 'LEVEL_1_CRITICAL',
      escalationReason: 'Test unauthorized citizen',
    },
    confidence: 0.95,
    reasoning: 'Test citizen escalation request',
  };

  const res2b = await secureToolExecutionLayer.executeToolCall(unauthorizedCall, { isAuthenticated: true, role: 'citizen' });
  const gate2Ok = res2.failedGate === 2 && res2b.failedGate === 2;

  recordCheck(2, 'Gate 2: Permission Validation (Rejects Unauthorized RBAC Access)',
    gate2Ok,
    `Gate 2 caught unauthorized citizen role: "${res2b.errors[0]}".`
  );

  // ─── Check 3: Gate 3 — Parameter Validation ───────────────────────────────
  const badParamReq = {
    tool_name: 'dispatch_rescue_team',
    parameters: {
      incidentId: validIncidentId,
      teamType: 'BAD_SQUAD_TYPE', // Invalid enum
      sector: 'Sector 4',
      // missing priority
    },
    confidence: 0.95,
    reasoning: 'Valid reasoning justification string',
  };

  const res3 = await secureToolExecutionLayer.executeToolCall(badParamReq, { isAuthenticated: true, role: 'responder' });
  recordCheck(3, 'Gate 3: Parameter Validation (Rejects Invalid Type / Missing Field)',
    res3.success === false && res3.failedGate === 3,
    `Gate 3 caught parameter mismatch. Errors count: ${res3.errors.length}: [${res3.errors.join('; ')}].`
  );

  // ─── Check 4: Gate 4 — Incident Existence Validation ─────────────────────
  const nonExistentReq = {
    tool_name: 'updateIncidentStatus',
    parameters: {
      incidentId: 'inc_non_existent_9999',
      status: 'DISPATCHED',
      responderNotes: 'Dispatching squad to invalid incident ID',
    },
    confidence: 0.95,
    reasoning: 'Valid reasoning justification',
  };

  const res4 = await secureToolExecutionLayer.executeToolCall(nonExistentReq, { isAuthenticated: true, role: 'responder' });
  recordCheck(4, 'Gate 4: Incident Existence Validation (Rejects Non-Existent Incident ID)',
    res4.success === false && res4.failedGate === 4,
    `Gate 4 caught non-existent incident ID: "${res4.errors[0]}".`
  );

  // ─── Check 5: Gate 5 & 6 — Successful 6-Gate Execution & Audit Logging ────
  const validSecureCall = {
    tool_name: 'updateIncidentPriority',
    parameters: {
      incidentId: validIncidentId,
      priority: 'CRITICAL',
      priorityCode: 'P1',
      reason: 'Verified trapped victim under debris per NDMA guidelines',
    },
    confidence: 0.97,
    reasoning: 'Triage confirms P1 Critical priority requirement.',
  };

  const res5 = await secureToolExecutionLayer.executeToolCall(validSecureCall, { isAuthenticated: true, role: 'commander', user: 'Chief Commander' });
  const execOk = res5.success === true && res5.gatesPassed === 6 && Boolean(res5.auditLog?.auditId);

  recordCheck(5, 'Pass All 6 Security Gates & Generate Audit Log Entry',
    execOk,
    `Executed securely (${res5.durationMs}ms). Audit Log ID: '${res5.auditLog?.auditId}'. User: '${res5.auditLog?.user}' (${res5.auditLog?.role}).`
  );

  // ─── Check 6: Audit Log Inspection & Security Verification ───────────────
  const logs = secureToolExecutionLayer.getAuditLogs();
  const logsOk = Array.isArray(logs) && logs.length >= 5;

  recordCheck(6, 'Central Security Audit Logging & Execution History',
    logsOk,
    `Recorded ${logs.length} audit entries. Latest status: '${logs[logs.length - 1].status}'.`
  );

  // ─── Print Audit Log Snippet ──────────────────────────────────────────────
  console.log('--- RECENT SECURITY AUDIT LOG ENTRIES ---');
  for (const entry of logs.slice(-3)) {
    console.log(`  [Audit #${entry.auditId}] Tool: '${entry.toolName}' | User: ${entry.user} (${entry.role}) | Status: ${entry.status} | Gates: ${entry.gatesPassed}/6`);
  }
  console.log('');

  // ─── Final Summary ────────────────────────────────────────────────────────
  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.length - passed;

  console.log('================================================================');
  console.log(`  SECURITY LAYER SUMMARY: ${passed} / ${checks.length} CHECKS PASSED (${failed} FAILED)`);
  console.log('================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runSecureExecutionLayerVerification();
