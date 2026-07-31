/**
 * Infrastructure Damage Analysis Verification Suite
 */

const infrastructureDamageAnalysisService = require('../services/vision/infrastructureDamageAnalysisService');
const visionPipelineOrchestrator = require('../services/vision/visionPipelineOrchestrator');

async function runInfrastructureDamageVerification() {
  console.log('================================================================');
  console.log('   INFRASTRUCTURE DAMAGE ANALYSIS VERIFICATION SUITE            ');
  console.log('================================================================\n');

  const checks = [];
  function recordCheck(id, title, passed, details) {
    checks.push({ id, title, passed, details });
    const mark = passed ? '✓ PASS' : '❌ FAIL';
    console.log(`${mark} [InfraDamage-${id}] ${title}`);
    console.log(`        Details: ${details}\n`);
  }

  // ─── Check 1: Evaluate 5 Key Asset Categories ──────────────────────────────
  const mockVisionRec = {
    photoId: 'photo_infra_001',
    disaster_type: 'BUILDING_COLLAPSE',
    severity_level: 'CRITICAL',
    overall_scene_description: '3-story building collapse in Sector 4 blocking roads with downed power lines and damaged vehicles',
    collapsedBuildings: true,
    roadBlockage: true,
  };

  const context = {
    sector: 'Sector 4',
    citizenNotes: 'Building collapse near market, road blocked, electric wire snapped',
  };

  const evalRes = infrastructureDamageAnalysisService.evaluateInfrastructure(mockVisionRec, context);
  const assets = evalRes.assets;

  const has5Assets = Boolean(
    assets.buildings &&
    assets.roads &&
    assets.bridges &&
    assets.vehicles &&
    assets.utility_infrastructure
  );

  recordCheck(1, 'Evaluate All 5 Required Infrastructure Asset Categories',
    has5Assets,
    `Evaluated 5 asset categories: [Buildings, Roads, Bridges, Vehicles, Utility Infrastructure].`
  );

  // ─── Check 2: 4 Required Properties per Asset ──────────────────────────────
  const bldg = assets.buildings;
  const has4Properties = Boolean(
    bldg.damage_level &&
    bldg.operational_impact &&
    bldg.access_difficulty &&
    bldg.recommended_response_priority
  );

  recordCheck(2, 'Determine 4 Required Properties per Asset (Damage, Impact, Difficulty, Priority)',
    has4Properties,
    `Buildings Asset: Damage='${bldg.damage_level}', Impact='${bldg.operational_impact}', Difficulty='${bldg.access_difficulty}', Priority='${bldg.recommended_response_priority}'.`
  );

  // ─── Check 3: Critical Priority & Access Difficulty Escalation ───────────────
  const roads = assets.roads;
  const util = assets.utility_infrastructure;

  const escalationOk = Boolean(
    bldg.recommended_response_priority === 'P0_IMMEDIATE' &&
    roads.access_difficulty === 'IMPASSABLE' &&
    util.damage_level === 'CRITICAL'
  );

  recordCheck(3, 'Critical Priority & Access Difficulty Escalation Matrix',
    escalationOk,
    `Building Priority: '${bldg.recommended_response_priority}', Road Difficulty: '${roads.access_difficulty}', Utility Damage: '${util.damage_level}'.`
  );

  // ─── Check 4: Overall Summary Aggregation ──────────────────────────────────
  const summary = evalRes.overall_summary;
  const summaryOk = Boolean(
    summary &&
    summary.damage_level === 'CRITICAL' &&
    summary.operational_impact === 'HIGH_DISRUPTION' &&
    summary.recommended_response_priority === 'P0_IMMEDIATE'
  );

  recordCheck(4, 'Overall Infrastructure Assessment Summary Aggregation',
    summaryOk,
    `Overall Summary: Damage='${summary.damage_level}', Impact='${summary.operational_impact}', Priority='${summary.recommended_response_priority}'.`
  );

  // ─── Check 5: End-to-End Vision Pipeline Orchestrator Integration ──────────
  const base64Data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const pipelineResult = await visionPipelineOrchestrator.executeVisionPipeline({
    photoId: `photo_infra_${Date.now()}`,
    data: base64Data,
    mimeType: 'image/png',
    sizeBytes: 1200,
    context: {
      sector: 'Sector 4',
      citizenNotes: 'Damaged bridge and fallen electric power lines',
    },
  });

  const orchestratorInfraOk = Boolean(pipelineResult.success && pipelineResult.infrastructureDamageAssessment?.overall_summary?.damage_level);

  recordCheck(5, 'End-to-End Vision Pipeline Infrastructure Damage Integration',
    orchestratorInfraOk,
    `Orchestrator returned overall damage level '${pipelineResult.infrastructureDamageAssessment?.overall_summary?.damage_level}' in ${pipelineResult.totalDurationMs}ms.`
  );

  // ─── Print Sample Infrastructure JSON Output ──────────────────────────────
  console.log('--- INFRASTRUCTURE DAMAGE EVALUATION JSON SAMPLE ---');
  console.log(JSON.stringify({
    overall_summary: evalRes.overall_summary,
    assets: {
      buildings: evalRes.assets.buildings,
      roads: evalRes.assets.roads,
      utility_infrastructure: evalRes.assets.utility_infrastructure,
    },
  }, null, 2));
  console.log('');

  // ─── Final Summary ────────────────────────────────────────────────────────
  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.length - passed;

  console.log('================================================================');
  console.log(`  INFRASTRUCTURE SUMMARY: ${passed} / ${checks.length} CHECKS PASSED (${failed} FAILED)`);
  console.log('================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runInfrastructureDamageVerification();
