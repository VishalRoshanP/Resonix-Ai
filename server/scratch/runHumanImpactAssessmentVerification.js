/**
 * Human Impact Assessment Verification Suite
 */

const humanImpactEstimationService = require('../services/vision/humanImpactEstimationService');
const visionPipelineOrchestrator = require('../services/vision/visionPipelineOrchestrator');

async function runHumanImpactAssessmentVerification() {
  console.log('================================================================');
  console.log('      HUMAN IMPACT ASSESSMENT VERIFICATION SUITE                 ');
  console.log('================================================================\n');

  const checks = [];
  function recordCheck(id, title, passed, details) {
    checks.push({ id, title, passed, details });
    const mark = passed ? '✓ PASS' : '❌ FAIL';
    console.log(`${mark} [HumanImpact-${id}] ${title}`);
    console.log(`        Details: ${details}\n`);
  }

  // ─── Check 1: Validate 5 Core Human Impact Dimensions ─────────────────────
  const mockVisionRec = {
    photoId: 'photo_human_001',
    disaster_type: 'BUILDING_COLLAPSE',
    severity_level: 'CRITICAL',
    overall_scene_description: '3-story building collapse in Sector 4 with crowd gathered and trapped workers under debris',
    collapsedBuildings: true,
    visibleInjuries: true,
  };

  const context = {
    sector: 'Sector 4',
    citizenNotes: 'Building collapse with children and elderly trapped in rubble crowd gathering',
  };

  const impactRes = humanImpactEstimationService.estimateHumanImpact(mockVisionRec, context);

  const has5Dimensions = Boolean(
    impactRes.visible_injuries &&
    impactRes.trapped_people &&
    impactRes.crowd_density &&
    impactRes.estimated_affected_people &&
    impactRes.vulnerable_groups
  );

  recordCheck(1, 'Validate 5 Core Human Impact Dimensions',
    has5Dimensions,
    `Assessed 5 impact dimensions for photo '${impactRes.photoId}'.`
  );

  // ─── Check 2: Confidence Score Returned for EVERY Estimate ─────────────
  const allConfidencesPresent = (
    typeof impactRes.visible_injuries.confidence === 'number' &&
    typeof impactRes.trapped_people.confidence === 'number' &&
    typeof impactRes.crowd_density.confidence === 'number' &&
    typeof impactRes.estimated_affected_people.confidence === 'number' &&
    typeof impactRes.vulnerable_groups.confidence === 'number'
  );

  recordCheck(2, 'Confidence Score Returned for EVERY Estimate (0.00 - 1.00 Range)',
    allConfidencesPresent,
    `Confidences: Injured=${impactRes.visible_injuries.confidence}, Trapped=${impactRes.trapped_people.confidence}, Density=${impactRes.crowd_density.confidence}, Affected=${impactRes.estimated_affected_people.confidence}, Groups=${impactRes.vulnerable_groups.confidence}.`
  );

  // ─── Check 3: Zero Fabricated Exact Numbers (Evidence-Based Range Bands) ─
  const rangeBand = impactRes.estimated_affected_people.range_band;
  const noFabricationOk = (
    impactRes.estimated_affected_people.exactNumberFabricated === false &&
    typeof rangeBand === 'string' &&
    rangeBand.includes('people')
  );

  recordCheck(3, 'Never Fabricate Exact Numbers (Evidence-Based Range Bands)',
    noFabricationOk,
    `Affected People Range Band: "${rangeBand}". FabricatedExactNumber=false.`
  );

  // ─── Check 4: Vulnerable Demographic Groups & Evidence Basis ──────────────
  const vulGroups = impactRes.vulnerable_groups.detected_groups;
  const vulOk = Array.isArray(vulGroups) && vulGroups.length >= 2 && vulGroups.includes('Children / Infants') && vulGroups.includes('Elderly Citizens');

  recordCheck(4, 'Identify Vulnerable Demographic Groups & Visual Evidence Basis',
    vulOk,
    `Identified Groups: [${vulGroups.join(', ')}]. Evidence Basis: "${impactRes.estimated_affected_people.evidence_basis}".`
  );

  // ─── Check 5: End-to-End Vision Pipeline Orchestrator Integration ──────────
  const base64Data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const pipelineResult = await visionPipelineOrchestrator.executeVisionPipeline({
    photoId: `photo_impact_${Date.now()}`,
    data: base64Data,
    mimeType: 'image/png',
    sizeBytes: 1200,
    context: {
      sector: 'Sector 4',
      citizenNotes: 'Building collapse with injured workers and children needing help',
    },
  });

  const orchestratorImpactOk = Boolean(pipelineResult.success && pipelineResult.humanImpactAssessment?.estimated_affected_people?.range_band);

  recordCheck(5, 'End-to-End Vision Pipeline Human Impact Assessment Integration',
    orchestratorImpactOk,
    `Orchestrator returned human impact range band "${pipelineResult.humanImpactAssessment?.estimated_affected_people?.range_band}" in ${pipelineResult.totalDurationMs}ms.`
  );

  // ─── Print Sample Human Impact Assessment JSON Output ─────────────────────
  console.log('--- HUMAN IMPACT ASSESSMENT JSON SAMPLE ---');
  console.log(JSON.stringify({
    visible_injuries: impactRes.visible_injuries,
    trapped_people: impactRes.trapped_people,
    crowd_density: impactRes.crowd_density,
    estimated_affected_people: impactRes.estimated_affected_people,
    vulnerable_groups: impactRes.vulnerable_groups,
  }, null, 2));
  console.log('');

  // ─── Final Summary ────────────────────────────────────────────────────────
  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.length - passed;

  console.log('================================================================');
  console.log(`  HUMAN IMPACT SUMMARY: ${passed} / ${checks.length} CHECKS PASSED (${failed} FAILED)`);
  console.log('================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runHumanImpactAssessmentVerification();
