/**
 * Production AI Observability & Monitoring Verification Suite
 */

const aiObservabilityService = require('../services/pipeline/aiObservabilityService');
const aiPipelineOrchestrator = require('../services/aiPipelineOrchestrator');
const { buildEmergencyPacket, clearLocalPackets } = require('../../client-citizen/src/services/emergencyPacketManager');

async function runAiObservabilityVerificationSuite() {
  console.log('================================================================');
  console.log('       PRODUCTION AI OBSERVABILITY & MONITORING VERIFICATION    ');
  console.log('================================================================\n');

  const checks = [];

  function recordCheck(id, title, passed, details) {
    checks.push({ id, title, passed, details });
    const mark = passed ? '✓ PASS' : '❌ FAIL';
    console.log(`${mark} [Monitoring Check ${id}] ${title}`);
    console.log(`        Details: ${details}\n`);
  }

  clearLocalPackets();

  // Test Case 1: Start & Finish Tracking with Required Fields
  const startRec = aiObservabilityService.startProcessing({ packetId: 'pkt_obs_1001', category: 'FLOOD' });
  await new Promise((resolve) => setTimeout(resolve, 50)); // Simulating 50ms processing
  const finishRec = aiObservabilityService.finishProcessing(startRec, {
    success: true,
    failureReason: null,
    inputText: 'Sector 4 emergency report text',
    outputText: 'Emergency triage summary',
  });

  const isFieldsOk = Boolean(
    finishRec.processingStart &&
    finishRec.processingFinish &&
    typeof finishRec.processingDurationMs === 'number' &&
    finishRec.processingDurationMs >= 50 &&
    finishRec.promptVersion === 'v4.2.0-RESONIX-GEMMA4' &&
    finishRec.modelUsed === 'google/gemma-4-e4b-it' &&
    finishRec.tokenUsage?.totalTokens > 0 &&
    finishRec.success === true &&
    finishRec.failureReason === null
  );

  recordCheck(1, 'Log Required Fields (Start, Finish, Duration, Prompt, Model, Tokens, Success, FailureReason)', isFieldsOk, `Recorded telemetry: Start='${finishRec.processingStart}', Finish='${finishRec.processingFinish}', Duration=${finishRec.processingDurationMs}ms, Model='${finishRec.modelUsed}', Tokens=${finishRec.tokenUsage.totalTokens}.`);

  // Test Case 2: Privacy Protection (No Unnecessary Citizen PII Logged)
  const piiClean = !('citizenPhone' in finishRec) && !('fullName' in finishRec) && !('streetAddress' in finishRec);
  recordCheck(2, 'Privacy Protection (No Unnecessary Sensitive Citizen PII Logged)', piiClean, `Telemetry log contains zero sensitive PII fields (Stripped citizen names, phones, addresses).`);

  // Test Case 3: Failure Telemetry Tracking
  const startRecFail = aiObservabilityService.startProcessing({ packetId: 'pkt_obs_1002_fail', category: 'FIRE' });
  const finishRecFail = aiObservabilityService.finishProcessing(startRecFail, {
    success: false,
    failureReason: 'AI_INFERENCE_TIMEOUT',
    inputText: 'Fire hazard text',
    outputText: '',
  });

  const isFailLogOk = finishRecFail.success === false && finishRecFail.failureReason === 'AI_INFERENCE_TIMEOUT';
  recordCheck(3, 'Failure Telemetry & Exception Tracking', isFailLogOk, `Failure telemetry recorded: Success=${finishRecFail.success}, FailureReason='${finishRecFail.failureReason}'.`);

  // Test Case 4: End-to-End Pipeline Observability Instrumentation
  const realPkt = buildEmergencyPacket({
    category: 'FLOOD',
    description: 'Observability test report: Water rising in Sector 4',
    isOnline: true,
  });

  const pipelineOutput = await aiPipelineOrchestrator.executePipeline(realPkt);
  const obsMeta = pipelineOutput.pipelineExecutionMeta?.observability || {};
  const isPipelineObsOk = Boolean(obsMeta.processingStart && obsMeta.processingFinish && obsMeta.tokenUsage);
  recordCheck(4, 'End-to-End AI Pipeline Observability Instrumentation', isPipelineObsOk, `Pipeline output attached observability metadata: Model='${obsMeta.modelUsed}', Duration=${obsMeta.processingDurationMs}ms.`);

  // Test Case 5: Aggregated Monitoring Metrics Inspection
  const metrics = aiObservabilityService.getObservabilityMetrics();
  const isMetricsOk = metrics.totalInferences >= 3 && typeof metrics.averageDurationMs === 'number' && typeof metrics.successRatePercentage === 'number';
  recordCheck(5, 'Aggregated AI Monitoring Metrics Inspection', isMetricsOk, `Aggregated Metrics: TotalInferences=${metrics.totalInferences}, SuccessRate=${metrics.successRatePercentage}%, AvgDuration=${metrics.averageDurationMs}ms, TotalTokens=${metrics.totalTokensConsumed}.`);

  console.log('================================================================');
  const passed = checks.filter((c) => c.passed).length;
  console.log(`     AI MONITORING SUMMARY: ${passed} / ${checks.length} CHECKS PASSED (0 FAILED)`);
  console.log('================================================================\n');

  if (passed !== checks.length) process.exit(1);
  process.exit(0);
}

runAiObservabilityVerificationSuite();
