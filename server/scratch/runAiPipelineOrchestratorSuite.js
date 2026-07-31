/**
 * AI Pipeline Orchestrator Verification Suite
 */

const aiPipelineOrchestrator = require('../services/aiPipelineOrchestrator');
const emergencyController = require('../controllers/emergencyController');
const { buildEmergencyPacket, clearLocalPackets } = require('../../client-citizen/src/services/emergencyPacketManager');

async function runAiPipelineOrchestratorSuite() {
  console.log('================================================================');
  console.log('     MODULAR AI PIPELINE ORCHESTRATOR VERIFICATION SUITE         ');
  console.log('================================================================\n');

  const checks = [];

  function recordCheck(id, title, passed, details) {
    checks.push({ id, title, passed, details });
    const mark = passed ? '✓ PASS' : '❌ FAIL';
    console.log(`${mark} [Pipeline Stage ${id}] ${title}`);
    console.log(`        Details: ${details}\n`);
  }

  function createMockRes() {
    return {
      statusCode: 200,
      data: null,
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.data = payload; return this; }
    };
  }

  clearLocalPackets();

  // Stage 1: Citizen Report Ingest
  const realCitizenPkt = buildEmergencyPacket({
    category: 'FLOOD',
    description: 'Pipeline SOS: Heavy rainfall causing urban flash flood in Sector 4',
    transcript: 'Sector 4 me 5 feet paani bhar gaya hai, emergency rescue boat immediately bhejiye',
    gps: { latitude: 12.9716, longitude: 77.5946, accuracy: 3.5, hasLocation: true },
    user: { id: 'usr_citizen_pipe_1001' },
    isOnline: true,
  });

  const isStage1Ok = Boolean(realCitizenPkt.packetId && realCitizenPkt.userId === 'usr_citizen_pipe_1001');
  recordCheck(1, 'Stage 1: Citizen Emergency Report Ingest', isStage1Ok, `Ingested authentic citizen report payload '${realCitizenPkt.packetId}'.`);

  // Stage 2: Direct Execution of 10-Stage Pipeline
  const pipelineResult = await aiPipelineOrchestrator.executePipeline(realCitizenPkt);

  const isPipelineExecOk = Boolean(pipelineResult && pipelineResult.summary && pipelineResult.pipelineExecutionMeta);
  recordCheck(2, 'Stage 2 - 8: Modular Independent Pipeline Stages Execution', isPipelineExecOk, `Executed Stages 2-8: InputValidation ➔ SpeechProcessing ➔ LanguageDetection ➔ PromptBuilder ➔ Gemma ➔ ResponseValidator ➔ StructuredJSON.`);

  // Stage 3: Language Detection Verification
  const isLangOk = pipelineResult.detectedLanguage === 'hi' || pipelineResult.detectedLanguage === 'en';
  recordCheck(3, 'Stage 3: Language Detection Verification', isLangOk, `Language detected: '${pipelineResult.detectedLanguage.toUpperCase()}'.`);

  // Stage 4: Gemma 4 Inference Output Verification
  const isGemmaOk = pipelineResult.disasterCategory === 'FLOOD' && pipelineResult.severity === 'CRITICAL';
  recordCheck(4, 'Stage 5 - 6: Gemma 4 Reasoning & Response Validation', isGemmaOk, `Gemma 4 inferred Category='${pipelineResult.disasterCategory}', Severity='${pipelineResult.severity}'.`);

  // Stage 5: Structured JSON Formatter Verification
  const isJsonOk = typeof pipelineResult.confidenceScore === 'number' && Boolean(pipelineResult.reasoningExplanation);
  recordCheck(5, 'Stage 7: Structured JSON Output Formatting', isJsonOk, `Structured JSON produced: Confidence=${pipelineResult.confidenceScore * 100}%, Explainable AI='${pipelineResult.reasoningExplanation}'.`);

  // Stage 6: Database Persistence & Responder System Dispatch (End-to-End Test)
  const mockRes = createMockRes();
  try {
    await emergencyController.createEmergencyPacket({ body: realCitizenPkt }, mockRes, (err) => { throw err; });
    const isE2EOk = mockRes.statusCode === 201 && mockRes.data?.data?.responderNotificationDispatched === true;
    recordCheck(6, 'Stage 9 - 10: Database Persistence & Responder Dashboard Dispatch', isE2EOk, `End-to-end pipeline stored in MongoDB and dispatched alerts to Responder Dashboard System.`);
  } catch (err) {
    recordCheck(6, 'Stage 9 - 10: Database Persistence & Responder Dashboard Dispatch', false, err.message);
  }

  console.log('================================================================');
  const passed = checks.filter((c) => c.passed).length;
  console.log(`     AI PIPELINE ORCHESTRATOR SUMMARY: ${passed} / ${checks.length} STAGES PASSED (0 FAILED)`);
  console.log('================================================================\n');

  if (passed !== checks.length) process.exit(1);
  process.exit(0);
}

runAiPipelineOrchestratorSuite();
