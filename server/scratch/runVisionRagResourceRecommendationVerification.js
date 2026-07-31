/**
 * Vision-RAG Resource Recommendation Verification Suite
 */

const visionRagFusionService = require('../services/vision/visionRagFusionService');
const visionPipelineOrchestrator = require('../services/vision/visionPipelineOrchestrator');

async function runVisionRagResourceRecommendationVerification() {
  console.log('================================================================');
  console.log('   VISION-RAG RESOURCE RECOMMENDATION VERIFICATION SUITE        ');
  console.log('================================================================\n');

  const checks = [];
  function recordCheck(id, title, passed, details) {
    checks.push({ id, title, passed, details });
    const mark = passed ? '✓ PASS' : '❌ FAIL';
    console.log(`${mark} [VisionRag-${id}] ${title}`);
    console.log(`        Details: ${details}\n`);
  }

  // ─── Check 1: Support 7 Explicit Responder Team Types ────────────────────
  const supportedTeams = [
    'Fire Service',
    'Ambulance',
    'Police',
    'NDRF',
    'Rescue Boats',
    'Medical Teams',
    'Heavy Equipment',
  ];

  const allTeamsSupported = supportedTeams.every((t) => visionRagFusionService.supportedTeams.includes(t));

  recordCheck(1, 'Support All 7 Required Responder Team Types',
    allTeamsSupported,
    `Supported 7 responder teams: [${supportedTeams.join(', ')}].`
  );

  // ─── Check 2: 3 Required Output Fields (Resources, Reasoning, Confidence)
  const mockVisionRec = {
    photoId: 'photo_rag_001',
    disaster_type: 'FLOOD',
    severity_level: 'CRITICAL',
    overall_scene_description: 'Deep flood water inundating residential sector with citizens stranded on roofs',
    waterPresent: true,
    visibleInjuries: true,
  };

  const context = {
    sector: 'Sector 4',
    citizenNotes: 'Paani ka bahaav fast hai, 15 log chhat par hain, urgent rescue boat and NDRF bhejiye',
  };

  const recRes = visionRagFusionService.recommendResources(mockVisionRec, context);

  const has3Fields = Boolean(
    Array.isArray(recRes.recommended_resources) &&
    typeof recRes.reasoning === 'string' &&
    typeof recRes.confidence === 'number'
  );

  recordCheck(2, 'Return 3 Required Fields (recommended_resources, reasoning, confidence)',
    has3Fields,
    `Recommended Teams: [${recRes.recommended_resources.join(', ')}]. Confidence: ${recRes.confidence}.`
  );

  // ─── Check 3: Synthesize 3 Grounded Knowledge Sources (Image + Citizen + RAG)
  const reasoningText = recRes.reasoning;
  const multiSourceOk = (
    reasoningText.includes('Visual Evidence') &&
    reasoningText.includes('Citizen Report') &&
    reasoningText.includes('RAG Knowledge')
  );

  recordCheck(3, 'Synthesize 3 Knowledge Sources (Image + Citizen Report + NDMA RAG Guidelines)',
    multiSourceOk,
    `Reasoning synthesizes Image, Citizen report, and RAG knowledge chunks (${recRes.groundedKnowledge?.retrievedChunksCount} chunks retrieved).`
  );

  // ─── Check 4: Grounded Recommendations Filtering (No Unsupported Teams) ──
  const recTeams = recRes.recommended_resources;
  const noUnsupportedOk = recTeams.every((t) => supportedTeams.includes(t)) && recTeams.includes('Rescue Boats') && recTeams.includes('NDRF');

  recordCheck(4, 'Grounded Recommendation Filtering (Zero Unsupported Teams)',
    noUnsupportedOk,
    `Verified 100% grounded team filter. Selected flood rescue teams: [${recTeams.join(', ')}].`
  );

  // ─── Check 5: End-to-End Vision Pipeline Orchestrator Integration ──────────
  const base64Data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const pipelineResult = await visionPipelineOrchestrator.executeVisionPipeline({
    photoId: `photo_rag_${Date.now()}`,
    data: base64Data,
    mimeType: 'image/png',
    sizeBytes: 1200,
    context: {
      sector: 'Sector 4',
      citizenNotes: 'Building collapse near market, people trapped under concrete debris',
    },
  });

  const orchestratorRagOk = Boolean(pipelineResult.success && pipelineResult.resourceRecommendations?.recommended_resources?.length >= 1);

  recordCheck(5, 'End-to-End Vision Pipeline Resource Recommendation Integration',
    orchestratorRagOk,
    `Orchestrator recommended [${pipelineResult.resourceRecommendations?.recommended_resources?.join(', ')}] in ${pipelineResult.totalDurationMs}ms.`
  );

  // ─── Print Sample Recommendation JSON Output ─────────────────────────────
  console.log('--- VISION-RAG RESOURCE RECOMMENDATION JSON SAMPLE ---');
  console.log(JSON.stringify({
    recommended_resources: recRes.recommended_resources,
    confidence: recRes.confidence,
    reasoning: recRes.reasoning,
  }, null, 2));
  console.log('');

  // ─── Final Summary ────────────────────────────────────────────────────────
  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.length - passed;

  console.log('================================================================');
  console.log(`  VISION-RAG SUMMARY: ${passed} / ${checks.length} CHECKS PASSED (${failed} FAILED)`);
  console.log('================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runVisionRagResourceRecommendationVerification();
