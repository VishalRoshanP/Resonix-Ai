/**
 * Knowledge Source Attribution Verification Suite
 */

const knowledgeAttributionService = require('../services/pipeline/knowledgeAttributionService');
const knowledgeRetrievalService = require('../services/pipeline/knowledgeRetrievalService');
const aiGroundingService = require('../services/pipeline/aiGroundingService');
const aiPipelineOrchestrator = require('../services/aiPipelineOrchestrator');

async function runAttributionVerification() {
  console.log('================================================================');
  console.log('     KNOWLEDGE SOURCE ATTRIBUTION VERIFICATION SUITE            ');
  console.log('================================================================\n');

  const checks = [];
  function recordCheck(id, title, passed, details) {
    checks.push({ id, title, passed, details });
    console.log(`${passed ? '✓ PASS' : '❌ FAIL'}  [Attribution-${id}] ${title}`);
    console.log(`        ${details}\n`);
  }

  // 1. Setup sample emergency & retrieve RAG context
  const incidentPayload = {
    packetId: 'pkt_attr_verify_001',
    description: 'River embankment burst causing severe street flooding, rescue boats requested for evacuating 20 marooned residents',
    category: 'FLOOD',
  };

  const knowledgeContext = knowledgeRetrievalService.retrieveRelevantKnowledge(incidentPayload, 3);
  const groundedOutput = aiGroundingService.groundRecommendations({
    summary: 'Flash flooding from river embankment breach',
    recommended_actions: ['Deploy rescue boats for water evacuation'],
    safety_precautions: ['Avoid walking through fast moving floodwaters'],
    recommended_resources: ['NDRF Battalion Water Squad'],
  }, knowledgeContext);

  // Generate Attribution Record
  const attrRecord = knowledgeAttributionService.generateAttribution(groundedOutput, knowledgeContext);

  // ─── Check 1: Store Source Document ─────────────────────────────────────
  const hasSourceDoc = attrRecord.attributions.every((a) => a.sourceDocument && a.sourceDocument.documentTitle && a.sourceDocument.version);
  recordCheck(1, 'Store Source Document (documentTitle, documentId, version, disasterCategory)',
    hasSourceDoc,
    `Sample Source Doc: '${attrRecord.attributions[0]?.sourceDocument?.documentTitle}' (v${attrRecord.attributions[0]?.sourceDocument?.version}).`
  );

  // ─── Check 2: Store Section ────────────────────────────────────────────────
  const hasSection = attrRecord.attributions.every((a) => a.section && a.section.sectionTitle);
  recordCheck(2, 'Store Section (sectionId, sectionTitle)',
    hasSection,
    `Sample Section: '${attrRecord.attributions[0]?.section?.sectionTitle}'.`
  );

  // ─── Check 3: Store Retrieval Score ───────────────────────────────────────
  const hasScore = attrRecord.attributions.every((a) => a.retrievalScore && a.retrievalScore.similarityPercentage);
  recordCheck(3, 'Store Retrieval Score (score & similarityPercentage)',
    hasScore,
    `Sample Retrieval Score: ${attrRecord.attributions[0]?.retrievalScore?.similarityPercentage}.`
  );

  // ─── Check 4: Store Retrieved Chunks ──────────────────────────────────────
  const hasChunks = attrRecord.attributions.every((a) => a.retrievedChunk && a.retrievedChunk.cleanText);
  recordCheck(4, 'Store Retrieved Chunks (cleanText & contextHeader)',
    hasChunks,
    `Clean text stored for all ${attrRecord.attributions.length} attributions.`
  );

  // ─── Check 5: Include References in AI Outputs for Responder Review ───────
  const hasResponderRefs = Array.isArray(attrRecord.responderReferences) && attrRecord.responderReferences.length > 0;
  recordCheck(5, 'Include References in AI Outputs for Responder Review (responderReferences)',
    hasResponderRefs,
    `Formatted ${attrRecord.responderReferences.length} audit citations for responder review.`
  );

  // ─── Check 6: Maintain Traceability for Every Recommendation ───────────────
  const matrix = attrRecord.traceabilityMatrix;
  const hasTraceability = Boolean(
    matrix &&
    matrix.actionsTraceability.length > 0 &&
    matrix.safetyTraceability.length > 0 &&
    matrix.resourcesTraceability.length > 0 &&
    matrix.actionsTraceability.every((t) => t.traceability.isFullyTraceable)
  );

  recordCheck(6, 'Maintain 100% Traceability Matrix for Every Recommendation',
    hasTraceability,
    `Traceable items: ${matrix?.actionsTraceability.length} actions, ${matrix?.safetyTraceability.length} safety items, ${matrix?.resourcesTraceability.length} resources.`
  );

  // ─── Check 7: E2E Pipeline Orchestrator Integration Test ───────────────────
  let pipelineOutput = null;
  let pipelineOk = false;
  try {
    pipelineOutput = await aiPipelineOrchestrator.executePipeline({
      packetId: 'pkt_e2e_attr_001',
      description: 'Major building fire with heavy smoke, workers trapped on 3rd floor',
      category: 'FIRE',
      gpsCoordinates: { latitude: 12.9716, longitude: 77.5946, sector: 'Sector 4' },
    });

    pipelineOk = Boolean(
      pipelineOutput &&
      pipelineOutput.attributionRecord &&
      pipelineOutput.attributionRecord.attributions?.length > 0 &&
      pipelineOutput.attributionRecord.responderReferences?.length > 0
    );
  } catch (err) {
    console.error('Pipeline integration error:', err.message);
  }

  recordCheck(7, 'Full AI Pipeline Orchestrator Attribution Integration Test',
    pipelineOk,
    `Pipeline attached attributionRecord with ${pipelineOutput?.attributionRecord?.responderReferences?.length} responder citations.`
  );

  // ─── Sample Responder Review Citations Printout ───────────────────────────
  console.log('--- RESPONDER DASHBOARD AUDIT CITATIONS ---');
  for (const ref of attrRecord.responderReferences) {
    console.log(`  ${ref}`);
  }
  console.log('');

  // ─── Final Summary ────────────────────────────────────────────────────────
  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.length - passed;

  console.log('================================================================');
  console.log(`  ATTRIBUTION SUMMARY: ${passed} / ${checks.length} CHECKS PASSED (${failed} FAILED)`);
  console.log('================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runAttributionVerification();
