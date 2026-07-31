/**
 * Vision AI Explainability Verification Suite
 */

const visionExplainabilityService = require('../services/vision/visionExplainabilityService');
const visionPipelineOrchestrator = require('../services/vision/visionPipelineOrchestrator');
const visionMongoStorageService = require('../services/vision/visionMongoStorageService');

async function runVisionAiExplainabilityVerification() {
  console.log('================================================================');
  console.log('      VISION AI EXPLAINABILITY VERIFICATION SUITE               ');
  console.log('================================================================\n');

  const checks = [];
  function recordCheck(id, title, passed, details) {
    checks.push({ id, title, passed, details });
    const mark = passed ? '✓ PASS' : '❌ FAIL';
    console.log(`${mark} [VisionExplain-${id}] ${title}`);
    console.log(`        Details: ${details}\n`);
  }

  // ─── Check 1: 5 Core Explanation Elements Extraction ─────────────────────
  const mockVisionRec = {
    photoId: 'photo_exp_001',
    disaster_type: 'FLOOD',
    severity_level: 'CRITICAL',
    confidence_score: 0.96,
    overall_scene_description: 'Deep flood water inundating Sector 4 residential area with submerged vehicles',
  };

  const mockHazards = {
    hazards: [
      { hazard: 'FLOOD_WATER', severity: 'CRITICAL', location: { grid_quadrant: 'BOTTOM_CENTER' } },
    ],
  };

  const mockRagRes = {
    groundedKnowledge: {
      sourceDocuments: ['NDMA Flood Guidelines 2024'],
    },
  };

  const expRes = visionExplainabilityService.generateExplanation(mockVisionRec, mockHazards, {}, {}, mockRagRes);

  const has5Elements = Boolean(
    typeof expRes.confidence === 'number' &&
    Array.isArray(expRes.supporting_visual_evidence) && expRes.supporting_visual_evidence.length >= 1 &&
    Array.isArray(expRes.retrieved_knowledge_references) && expRes.retrieved_knowledge_references.length >= 1 &&
    typeof expRes.reasoning === 'string' &&
    expRes.alternative_assessment
  );

  recordCheck(1, 'Extract All 5 Core Explanation Elements (Confidence, Visual Evidence, RAG Refs, Reasoning, Alternative)',
    has5Elements,
    `Extracted 5 elements for photo '${expRes.photoId}'. Confidence: ${expRes.confidence}.`
  );

  // ─── Check 2: Low-Confidence Alternative Assessment Trigger (< 0.70) ──────
  const lowConfVisionRec = {
    photoId: 'photo_exp_low_002',
    disaster_type: 'LANDSLIDE',
    confidence_score: 0.62, // Low confidence trigger
    overall_scene_description: 'Hazy image with ambiguous mud accumulation near hillside road',
  };

  const lowExpRes = visionExplainabilityService.generateExplanation(lowConfVisionRec, {}, {}, {}, {});
  const alt = lowExpRes.alternative_assessment;

  const lowConfTriggerOk = Boolean(
    alt &&
    alt.is_low_confidence === true &&
    alt.alternative_hypothesis &&
    alt.recommended_human_verification === true
  );

  recordCheck(2, 'Trigger Alternative Assessment & Human Verification on Low Confidence (< 0.70)',
    lowConfTriggerOk,
    `Triggered Low Confidence (${lowExpRes.confidence}): Alternative Hypothesis: "${alt?.alternative_hypothesis}". Human Verification: ${alt?.recommended_human_verification}.`
  );

  // ─── Check 3: Store Explanations with Incident in MongoDB ─────────────────
  const storedDoc = await visionMongoStorageService.storeVisionRecord({
    photoId: 'photo_exp_001',
    visibleDisaster: 'FLOOD',
    explanation: expRes,
  }, { incidentId: 'inc_exp_qa_99' });

  const mongoStorageOk = Boolean(storedDoc._id && storedDoc.photoId === 'photo_exp_001');

  recordCheck(3, 'Store Vision Explanations with Incident Record in MongoDB',
    mongoStorageOk,
    `Stored explanation record '${storedDoc._id}' in MongoDB.`
  );

  // ─── Check 4: Grounded NDMA/NDRF Knowledge References ───────────────────
  const refs = expRes.retrieved_knowledge_references;
  const refsOk = Array.isArray(refs) && refs.length >= 1 && refs[0].includes('NDMA');

  recordCheck(4, 'Grounded NDMA / NDRF Guidelines Knowledge References',
    refsOk,
    `Knowledge References: [${refs.join(' | ')}].`
  );

  // ─── Check 5: End-to-End Vision Pipeline Orchestrator Integration ──────────
  const base64Data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const pipelineResult = await visionPipelineOrchestrator.executeVisionPipeline({
    photoId: `photo_exp_${Date.now()}`,
    data: base64Data,
    mimeType: 'image/png',
    sizeBytes: 1200,
    context: {
      sector: 'Sector 4',
      citizenNotes: 'Overturned truck spilling liquid on highway with smoke',
    },
  });

  const orchestratorExpOk = Boolean(pipelineResult.success && pipelineResult.explanation?.reasoning);

  recordCheck(5, 'End-to-End Vision Pipeline Self-Explanation Integration',
    orchestratorExpOk,
    `Orchestrator generated self-explanation (Confidence: ${pipelineResult.explanation?.confidence}) in ${pipelineResult.totalDurationMs}ms.`
  );

  // ─── Print Sample Explanation JSON Output ────────────────────────────────
  console.log('--- VISION AI EXPLAINABILITY JSON SAMPLE ---');
  console.log(JSON.stringify({
    photoId: expRes.photoId,
    confidence: expRes.confidence,
    supporting_visual_evidence: expRes.supporting_visual_evidence,
    retrieved_knowledge_references: expRes.retrieved_knowledge_references,
    reasoning: expRes.reasoning,
    alternative_assessment: expRes.alternative_assessment,
  }, null, 2));
  console.log('');

  // ─── Final Summary ────────────────────────────────────────────────────────
  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.length - passed;

  console.log('================================================================');
  console.log(`  EXPLAINABILITY SUMMARY: ${passed} / ${checks.length} CHECKS PASSED (${failed} FAILED)`);
  console.log('================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runVisionAiExplainabilityVerification();
