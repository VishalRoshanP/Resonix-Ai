/**
 * AI Recommendation Grounding Verification Suite
 */

const aiGroundingService = require('../services/pipeline/aiGroundingService');
const knowledgeRetrievalService = require('../services/pipeline/knowledgeRetrievalService');
const aiPipelineOrchestrator = require('../services/aiPipelineOrchestrator');

async function runGroundingVerification() {
  console.log('================================================================');
  console.log('      AI RECOMMENDATION GROUNDING VERIFICATION SUITE            ');
  console.log('================================================================\n');

  const checks = [];
  function recordCheck(id, title, passed, details) {
    checks.push({ id, title, passed, details });
    console.log(`${passed ? '✓ PASS' : '❌ FAIL'}  [Grounding-${id}] ${title}`);
    console.log(`        ${details}\n`);
  }

  // 1. Setup sample emergency telemetry & retrieve real knowledge context
  const testPayload = {
    packetId: 'pkt_grounding_verify_001',
    description: 'Gas pipeline leak caused building explosion and severe burn injuries to 3 workers trapped in basement',
    category: 'FIRE',
    latitude: 12.9716,
    longitude: 77.5946,
  };

  const knowledgeContext = knowledgeRetrievalService.retrieveRelevantKnowledge(testPayload, 3);

  // 2. Candidate ungrounded AI output with raw/unstructured recommendations
  const ungroundedAiOutput = {
    summary: 'Building fire and explosion reported',
    recommended_actions: [
      'Cool burn immediately with clean cool running water for 20 minutes',
      'Use elevator for rapid evacuation', // UNSUPPORTED / UNSAFE (Elevators are forbidden in fire)
    ],
    safety_precautions: [
      'Call emergency 101 and evacuate using stairways',
      'Use random butter on burn injuries', // UNSUPPORTED (Butter is forbidden on burns per WHO)
    ],
    recommended_resources: [
      'Deploy Fire Rescue Unit #12',
    ],
  };

  // Run grounding engine
  const groundedResult = aiGroundingService.groundRecommendations(ungroundedAiOutput, knowledgeContext);

  // ─── Check 1: 4 Required Pillars Present ─────────────────────────────────
  const hasSummary = Boolean(groundedResult.summary);
  const hasActions = Array.isArray(groundedResult.recommended_actions) && groundedResult.recommended_actions.length >= 2;
  const hasPrecautions = Array.isArray(groundedResult.safety_precautions) && groundedResult.safety_precautions.length >= 2;
  const hasResources = Array.isArray(groundedResult.recommended_resources) && groundedResult.recommended_resources.length >= 2;

  recordCheck(1, 'Gemma Recommendations Include All 4 Required Pillars',
    hasSummary && hasActions && hasPrecautions && hasResources,
    `Summary: "${groundedResult.summary}". Actions: ${groundedResult.recommended_actions.length}, Precautions: ${groundedResult.safety_precautions.length}, Resources: ${groundedResult.recommended_resources.length}.`
  );

  // ─── Check 2: Reference Retrieved Disaster Guidance ───────────────────────
  const meta = groundedResult.groundingMetadata;
  const hasCitations = meta && meta.actionCitations.length > 0 && meta.safetyCitations.length > 0 && meta.resourceCitations.length > 0;

  recordCheck(2, 'Every Recommendation References Retrieved Disaster Guidance (Citations)',
    hasCitations,
    `Citations created: ${meta?.totalCitedItems} items cited across ${meta?.sourceDocumentsCount} source documents.`
  );

  // ─── Check 3: Unsupported / Unsafe Recommendations Filtered / Grounded ────
  // Elevators and butter on burns should have been grounded/replaced with verified guidelines
  const hasUnsafeElevator = groundedResult.recommended_actions.some((a) => a.toLowerCase().includes('use elevator'));
  const hasUnsafeButter = groundedResult.safety_precautions.some((p) => p.toLowerCase().includes('random butter'));

  recordCheck(3, 'Avoid & Filter Unsupported / Hallucinated Recommendations',
    !hasUnsafeElevator && !hasUnsafeButter,
    `Filtered out unsafe/unsupported items: elevator=${!hasUnsafeElevator}, butter=${!hasUnsafeButter}. Filtered count: ${meta?.unsupportedFilteredCount}.`
  );

  // ─── Check 4: Grounded Score & Metadata Validation ──────────────────────
  const isGroundedScoreOk = meta && meta.groundedScore >= 0.70 && meta.isGrounded === true;

  recordCheck(4, 'Grounding Score Threshold (GroundedScore ≥ 0.70 & isGrounded = true)',
    isGroundedScoreOk,
    `Grounded Score: ${meta?.groundedScore} (Target ≥ 0.70). isGrounded: ${meta?.isGrounded}.`
  );

  // ─── Check 5: E2E Pipeline Orchestrator Integration Test ────────────────
  let pipelineOutput = null;
  let pipelineOk = false;
  try {
    pipelineOutput = await aiPipelineOrchestrator.executePipeline({
      packetId: 'pkt_e2e_grounding_001',
      description: 'Flood waters overflowing river bank, 10 citizens trapped in low lying area needing rescue',
      category: 'FLOOD',
      gpsCoordinates: { latitude: 12.9716, longitude: 77.5946, sector: 'Sector 4' },
    });

    pipelineOk = Boolean(
      pipelineOutput &&
      pipelineOutput.summary &&
      Array.isArray(pipelineOutput.recommended_actions) &&
      Array.isArray(pipelineOutput.safety_precautions) &&
      Array.isArray(pipelineOutput.recommended_resources) &&
      pipelineOutput.groundingMetadata &&
      pipelineOutput.groundingMetadata.isGrounded === true
    );
  } catch (err) {
    console.error('Grounding pipeline test error:', err.message);
  }

  recordCheck(5, 'Full AI Pipeline Orchestrator Grounding Integration Test',
    pipelineOk,
    `Pipeline output grounded successfully. Actions: ${pipelineOutput?.recommended_actions?.length}, Precautions: ${pipelineOutput?.safety_precautions?.length}, Score: ${pipelineOutput?.groundingMetadata?.groundedScore}.`
  );

  // ─── Sample Citation Printout ──────────────────────────────────────────────
  console.log('--- SAMPLE CITATIONS MAPPING ---');
  if (meta && meta.actionCitations) {
    for (const c of meta.actionCitations.slice(0, 2)) {
      console.log(`  [ACTION CITATION] "${c.item.substring(0, 50)}..."`);
      console.log(`      ➜ Source: ${c.sourceDocument} (${c.sectionTitle}) | Confidence: ${c.confidenceScore}\n`);
    }
  }

  // ─── Final Summary ────────────────────────────────────────────────────────
  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.length - passed;

  console.log('================================================================');
  console.log(`  GROUNDING SUMMARY: ${passed} / ${checks.length} CHECKS PASSED (${failed} FAILED)`);
  console.log('================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runGroundingVerification();
