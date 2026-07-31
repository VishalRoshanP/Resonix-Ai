/**
 * RAG Pipeline Integration Verification Suite
 */

const promptBuilderService = require('../services/pipeline/promptBuilderService');
const aiPipelineOrchestrator = require('../services/aiPipelineOrchestrator');
const knowledgeRetrievalService = require('../services/pipeline/knowledgeRetrievalService');

async function runRagIntegrationVerification() {
  console.log('================================================================');
  console.log('       RAG PIPELINE INTEGRATION VERIFICATION SUITE              ');
  console.log('================================================================\n');

  const checks = [];
  function recordCheck(id, title, passed, details) {
    checks.push({ id, title, passed, details });
    console.log(`${passed ? '✓ PASS' : '❌ FAIL'}  [RAG-${id}] ${title}`);
    console.log(`        ${details}\n`);
  }

  const sampleIncident = {
    packetId: 'pkt_rag_pipeline_test',
    description: 'Catastrophic dam breach caused flash flooding across 3 residential sectors, 15 citizens trapped on roofs',
    category: 'FLOOD',
    latitude: 12.9716,
    longitude: 77.5946,
    sector: 'Sector 4',
  };

  // ─── 1. Incident Understanding Task receives Citizen Report & Guidance ───────
  const p1 = promptBuilderService.buildIncidentUnderstandingPrompt(sampleIncident);
  const p1Ok = (
    p1.userPrompt.includes('[CITIZEN EMERGENCY REPORT]') &&
    p1.userPrompt.includes('[OFFICIAL DISASTER GUIDANCE') &&
    p1.ragContext.retrievedChunks.length > 0
  );
  recordCheck(1, 'Reasoning Task 1: Incident Understanding receives Report & Guidance',
    p1Ok,
    `System Prompt target: ${p1.targetModel}. User Prompt includes Citizen Telemetry & RAG Context snippet.`
  );

  // ─── 2. Severity Analysis Task receives Citizen Report & Guidance ────────────
  const p2 = promptBuilderService.buildSeverityAnalysisPrompt(sampleIncident);
  const p2Ok = (
    p2.userPrompt.includes('[CITIZEN SEVERITY REPORT]') &&
    p2.userPrompt.includes('[OFFICIAL DISASTER GUIDANCE') &&
    p2.ragContext.retrievedChunks.length > 0
  );
  recordCheck(2, 'Reasoning Task 2: Severity Analysis receives Report & Guidance',
    p2Ok,
    `User Prompt includes Severity Report & official RAG guidelines (${p2.ragContext.retrievedChunks.length} chunks).`
  );

  // ─── 3. Priority Analysis Task receives Citizen Report & Guidance ────────────
  const p3 = promptBuilderService.buildPriorityAnalysisPrompt(sampleIncident);
  const p3Ok = (
    p3.userPrompt.includes('[DISPATCH PRIORITY EVALUATION]') &&
    p3.userPrompt.includes('[OFFICIAL DISASTER GUIDANCE') &&
    p3.ragContext.retrievedChunks.length > 0
  );
  recordCheck(3, 'Reasoning Task 3: Priority Analysis receives Report & Guidance',
    p3Ok,
    `User Prompt includes Priority Evaluation & official SOP guidelines.`
  );

  // ─── 4. Resource Recommendation Task receives Citizen Report & Guidance ──────
  const p4 = promptBuilderService.buildResourceRecommendationPrompt(sampleIncident);
  const p4Ok = (
    p4.userPrompt.includes('[RESOURCE ALLOCATION MATRIX]') &&
    p4.userPrompt.includes('[OFFICIAL DISASTER GUIDANCE') &&
    p4.ragContext.retrievedChunks.length > 0
  );
  recordCheck(4, 'Reasoning Task 4: Resource Recommendation receives Report & Guidance',
    p4Ok,
    `User Prompt includes Resource Matrix & official rescue squad guidelines.`
  );

  // ─── 5. No Retrieval Bypass Guarantee ────────────────────────────────────────
  // Pass an object WITHOUT knowledgeContext — PromptBuilder must auto-retrieve knowledge
  const unaugmentedIncident = { description: 'Chemical warehouse fire with toxic gas cloud', category: 'FIRE' };
  const p5 = promptBuilderService.buildPrompt({ validatedPayload: unaugmentedIncident });
  const p5Ok = (
    p5.userPrompt.includes('[OFFICIAL DISASTER GUIDANCE') &&
    p5.ragContext !== null &&
    p5.ragContext.retrievedChunks.length > 0
  );
  recordCheck(5, 'Do Not Bypass Retrieval (Auto-Triggers RAG if Context Missing)',
    p5Ok,
    `PromptBuilder auto-retrieved RAG context for unaugmented payload. Chunks attached: ${p5.ragContext?.retrievedChunks?.length}.`
  );

  // ─── 6. End-to-End Updated Pipeline Execution ─────────────────────────────────
  // Citizen Report -> Speech-to-Text -> Language Detection -> Knowledge Retrieval -> Prompt Builder -> Gemma -> Structured JSON
  let pipelineOutput = null;
  let pipelineOk = false;
  try {
    pipelineOutput = await aiPipelineOrchestrator.executePipeline({
      packetId: 'pkt_e2e_rag_001',
      description: 'Earthquake magnitude 6.5 caused massive structural wall collapse, emergency first aid needed for 5 injured victims',
      category: 'SEISMIC',
      gpsCoordinates: { latitude: 12.9716, longitude: 77.5946, sector: 'Sector 4' },
    });

    pipelineOk = Boolean(
      pipelineOutput &&
      pipelineOutput.disaster_type &&
      pipelineOutput.ragRecord &&
      pipelineOutput.ragRecord.bypassed === false &&
      pipelineOutput.ragRecord.ragContextInjected === true
    );
  } catch (err) {
    console.error('Pipeline execution error:', err.message);
  }

  recordCheck(6, 'Full Updated Pipeline Execution (Report → Speech → Lang → RAG → Prompt → Gemma → JSON)',
    pipelineOk,
    `Pipeline completed. RAG Telemetry: Bypassed=${pipelineOutput?.ragRecord?.bypassed}, ChunksCount=${pipelineOutput?.ragRecord?.retrievedChunksCount}, Latency=${pipelineOutput?.ragRecord?.retrievalLatencyMs}ms.`
  );

  // ─── 7. Final Output RAG Telemetry Record ─────────────────────────────────────
  const ragRec = pipelineOutput?.ragRecord || {};
  const recOk = Boolean(ragRec.sourceDocuments && ragRec.similarityScores && ragRec.ragContextInjected);
  recordCheck(7, 'Structured JSON Contains Complete RAG Telemetry Record (ragRecord)',
    recOk,
    `ragRecord stored in output payload with ${ragRec.sourceDocuments?.length || 0} source docs & ${ragRec.similarityScores?.length || 0} similarity scores.`
  );

  // ─── Sample RAG Context View ──────────────────────────────────────────────────
  console.log('--- SAMPLE INJECTED RAG PROMPT SNIPPET ---');
  if (p1.ragContext?.ragContextFormatted) {
    console.log(p1.ragContext.ragContextFormatted.substring(0, 350) + '...\n');
  }

  // ─── Final Summary ────────────────────────────────────────────────────────────
  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.length - passed;

  console.log('================================================================');
  console.log(`  RAG INTEGRATION SUMMARY: ${passed} / ${checks.length} CHECKS PASSED (${failed} FAILED)`);
  console.log('================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runRagIntegrationVerification();
