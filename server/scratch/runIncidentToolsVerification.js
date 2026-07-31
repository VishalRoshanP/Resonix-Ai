/**
 * Incident Management Tools Verification Suite
 */

const toolRegistry = require('../services/tools/toolRegistry');
const gemmaFunctionCallingService = require('../services/pipeline/gemmaFunctionCallingService');
const incidentService = require('../services/incidentService');

async function runIncidentToolsVerification() {
  console.log('================================================================');
  console.log('    INCIDENT MANAGEMENT TOOLS EXECUTION VERIFICATION SUITE      ');
  console.log('================================================================\n');

  const checks = [];
  function recordCheck(id, title, passed, details) {
    checks.push({ id, title, passed, details });
    const mark = passed ? '✓ PASS' : '❌ FAIL';
    console.log(`${mark} [IncidentTools-${id}] ${title}`);
    console.log(`        Details: ${details}\n`);
  }

  // ─── Check 1: Tool Registry Registration ──────────────────────────────────
  const requiredTools = ['createIncident', 'mergeIncident', 'updateIncidentPriority', 'updateIncidentStatus'];
  const allRegistered = requiredTools.every((t) => toolRegistry.isValidTool(t));

  recordCheck(1, 'Expose Incident Operations as Callable Tools in ToolRegistry',
    allRegistered,
    `Registered 4 required tools: [${requiredTools.join(', ')}].`
  );

  // ─── Check 2: Operation 1 — createIncident Tool Execution (MongoDB Real) ─────
  const createCall = {
    tool_name: 'createIncident',
    parameters: {
      title: 'Structural Wall Collapse near City Market',
      category: 'BUILDING_COLLAPSE',
      severity: 'CRITICAL',
      sector: 'Sector 4',
      description: 'Authentic QA Incident: 2-story brick wall collapsed on crowded walkway',
    },
    confidence: 0.95,
    reasoning: 'Citizen SOS report of structural wall collapse requires creating an active incident record.',
  };

  const createRes = await gemmaFunctionCallingService.processToolCallRequest(createCall);
  const createdIncidentId = createRes.result?.incidentId;
  const createOk = createRes.executed === true && Boolean(createdIncidentId);

  recordCheck(2, 'Operation 1: createIncident() Execution & MongoDB Persistence',
    createOk,
    `Created primary incident in MongoDB: ID='${createdIncidentId}', Status='${createRes.result?.status}'.`
  );

  // ─── Check 3: Operation 2 — updateIncidentPriority Tool Execution ──────────
  const updatePriorityCall = {
    tool_name: 'updateIncidentPriority',
    parameters: {
      incidentId: String(createdIncidentId),
      priority: 'CRITICAL',
      priorityCode: 'P1',
      reason: 'Multiple trapped victims confirmed under collapsed wall',
    },
    confidence: 0.97,
    reasoning: 'Trapped victims confirm P1 Critical dispatch priority.',
  };

  const priorityRes = await gemmaFunctionCallingService.processToolCallRequest(updatePriorityCall);
  const priorityOk = priorityRes.executed === true && priorityRes.result?.status === 'PRIORITY_UPDATED';

  recordCheck(3, 'Operation 2: updateIncidentPriority() Execution & Severity Sync',
    priorityOk,
    `Updated incident '${createdIncidentId}' priority to 'CRITICAL' (P1). Status: '${priorityRes.result?.status}'.`
  );

  // ─── Check 4: Operation 3 — updateIncidentStatus Tool Execution ────────────
  const updateStatusCall = {
    tool_name: 'updateIncidentStatus',
    parameters: {
      incidentId: String(createdIncidentId),
      status: 'DISPATCHED',
      responderNotes: 'NDRF Collapse Search Unit #2 dispatched to Sector 4 scene',
    },
    confidence: 0.98,
    reasoning: 'Rescue squad deployed to location.',
  };

  const statusRes = await gemmaFunctionCallingService.processToolCallRequest(updateStatusCall);
  const statusOk = statusRes.executed === true && statusRes.result?.status === 'STATUS_UPDATED';

  recordCheck(4, 'Operation 3: updateIncidentStatus() Execution & Field Notes',
    statusOk,
    `Updated incident status to 'DISPATCHED' with responder field notes.`
  );

  // ─── Check 5: Operation 4 — mergeIncident Tool Execution ───────────────────
  // Create a second secondary incident to test merging
  const secondaryDoc = await incidentService.createIncident({
    title: 'Duplicate Wall Collapse SOS Report',
    category: 'BUILDING_COLLAPSE',
    sector: 'Sector 4',
    description: 'Duplicate citizen report of wall collapse near City Market',
  });

  const mergeCall = {
    tool_name: 'mergeIncident',
    parameters: {
      primaryIncidentId: String(createdIncidentId),
      secondaryIncidentIds: [String(secondaryDoc._id)],
      mergeReason: 'Confirmed duplicate citizen report for same City Market wall collapse',
    },
    confidence: 0.94,
    reasoning: 'Duplicate location and telemetry matches primary incident ID.',
  };

  const mergeRes = await gemmaFunctionCallingService.processToolCallRequest(mergeCall);
  const mergeOk = mergeRes.executed === true && mergeRes.result?.status === 'MERGED';

  recordCheck(5, 'Operation 4: mergeIncident() Execution & Duplicate Resolution',
    mergeOk,
    `Merged secondary incident '${secondaryDoc._id}' into primary '${createdIncidentId}'. Merge Status: '${mergeRes.result?.status}'.`
  );

  // ─── Check 6: MongoDB Verification of Real Data Integrity ──────────────────
  const verifiedPrimary = await incidentService.getIncidentById(createdIncidentId, 'responder');
  const mongoOk = Boolean(verifiedPrimary && verifiedPrimary.status === 'active' && verifiedPrimary.severity === 'critical');

  recordCheck(6, 'MongoDB Document State Verification & API Compatibility',
    mongoOk,
    `Verified MongoDB record '${verifiedPrimary?._id}': Status='${verifiedPrimary?.status}', Severity='${verifiedPrimary?.severity}'. Title='${verifiedPrimary?.title}'.`
  );

  // ─── Final Summary ────────────────────────────────────────────────────────
  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.length - passed;

  console.log('================================================================');
  console.log(`  INCIDENT TOOLS SUMMARY: ${passed} / ${checks.length} CHECKS PASSED (${failed} FAILED)`);
  console.log('================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runIncidentToolsVerification();
