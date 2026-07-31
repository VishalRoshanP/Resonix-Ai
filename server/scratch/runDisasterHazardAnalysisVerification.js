/**
 * Disaster Hazard Analysis Verification Suite
 */

const disasterHazardAnalysisService = require('../services/vision/disasterHazardAnalysisService');
const visionPipelineOrchestrator = require('../services/vision/visionPipelineOrchestrator');

async function runDisasterHazardAnalysisVerification() {
  console.log('================================================================');
  console.log('     DISASTER HAZARD ANALYSIS VERIFICATION SUITE                ');
  console.log('================================================================\n');

  const checks = [];
  function recordCheck(id, title, passed, details) {
    checks.push({ id, title, passed, details });
    const mark = passed ? '✓ PASS' : '❌ FAIL';
    console.log(`${mark} [HazardAnalysis-${id}] ${title}`);
    console.log(`        Details: ${details}\n`);
  }

  // ─── Check 1: 10 Explicit Hazards Supported ──────────────────────────────
  const requiredHazards = [
    'FIRE',
    'SMOKE',
    'FLOOD_WATER',
    'BROKEN_BUILDINGS',
    'FALLEN_TREES',
    'BLOCKED_ROADS',
    'DOWNED_POWER_LINES',
    'RUBBLE_DEBRIS',
    'HAZARDOUS_MATERIALS',
    'STRUCTURAL_DAMAGE',
  ];

  const allSupported = requiredHazards.every((h) => disasterHazardAnalysisService.supportedHazards.includes(h));

  recordCheck(1, 'Support All 10 Explicit Disaster Hazards',
    allSupported,
    `Supported 10 required hazards: [${requiredHazards.join(', ')}].`
  );

  // ─── Check 2: Extract 4 Required Hazard Output Fields ──────────────────────
  const mockVisionRec = {
    photoId: 'photo_hazard_001',
    disaster_type: 'INDUSTRIAL_ACCIDENT',
    severity_level: 'CRITICAL',
    overall_scene_description: 'Industrial chemical leak with active fire, smoke, and toxic chemical spill in Sector 4.',
    fireVisible: true,
    smokePresent: true,
  };

  const hazardRes = disasterHazardAnalysisService.analyzeHazards(mockVisionRec, { sector: 'Sector 4' });
  const firstHazard = hazardRes.hazards[0];

  const has4Fields = Boolean(
    firstHazard &&
    firstHazard.hazard &&
    typeof firstHazard.confidence === 'number' &&
    firstHazard.severity &&
    firstHazard.location &&
    firstHazard.location.grid_quadrant &&
    Array.isArray(firstHazard.location.bounding_box)
  );

  recordCheck(2, 'Return 4 Required Fields per Hazard (Hazard, Confidence, Severity, Spatial Location)',
    has4Fields,
    `Hazard '${firstHazard?.hazard}': Confidence=${firstHazard?.confidence}, Severity='${firstHazard?.severity}', Quadrant='${firstHazard?.location?.grid_quadrant}'.`
  );

  // ─── Check 3: Spatial Bounding Box & Quadrant Calculation (No Placeholders)
  const isNoPlaceholder = Boolean(
    firstHazard?.location?.bounding_box.length === 4 &&
    !JSON.stringify(firstHazard).includes('placeholder')
  );

  recordCheck(3, 'Real Spatial Grid Bounding Box Coordinates (Zero Placeholders)',
    isNoPlaceholder,
    `Normalized Bounding Box: [${firstHazard?.location?.bounding_box.join(', ')}]. Location: "${firstHazard?.location?.location_description}".`
  );

  // ─── Check 4: Multi-Hazard Extraction Matrix ──────────────────────────────
  const multiHazardRec = {
    photoId: 'photo_hazard_002',
    disaster_type: 'BUILDING_COLLAPSE',
    severity_level: 'CRITICAL',
    overall_scene_description: 'Building collapse with rubble debris, downed power lines, and blocked roads.',
    collapsedBuildings: true,
    roadBlockage: true,
  };

  const multiRes = disasterHazardAnalysisService.analyzeHazards(multiHazardRec, { sector: 'Sector 4' });
  const detectedNames = multiRes.hazards.map((h) => h.hazard);
  const multiOk = multiRes.totalHazardsDetected >= 3 && detectedNames.includes('BROKEN_BUILDINGS') && detectedNames.includes('BLOCKED_ROADS');

  recordCheck(4, 'Multi-Hazard Scene Extraction (Collapses, Debris, Power Lines, Road Blockages)',
    multiOk,
    `Extracted ${multiRes.totalHazardsDetected} hazards: [${detectedNames.join(', ')}].`
  );

  // ─── Check 5: End-to-End Vision Pipeline Orchestrator Hazard Analysis Integration
  const base64Data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const pipelineResult = await visionPipelineOrchestrator.executeVisionPipeline({
    photoId: `photo_hz_${Date.now()}`,
    data: base64Data,
    mimeType: 'image/png',
    sizeBytes: 1200,
    context: {
      sector: 'Sector 4',
      citizenNotes: 'Overturned chemical tanker leaking hazmat with fire and smoke',
    },
  });

  const orchestratorHazardOk = Boolean(pipelineResult.success && pipelineResult.hazardAnalysis?.totalHazardsDetected >= 1);

  recordCheck(5, 'End-to-End Vision Pipeline Hazard Analysis Integration',
    orchestratorHazardOk,
    `Orchestrator returned ${pipelineResult.hazardAnalysis?.totalHazardsDetected} hazards in ${pipelineResult.totalDurationMs}ms.`
  );

  // ─── Print Sample Hazard JSON Output ──────────────────────────────────────
  console.log('--- DISASTER HAZARD ANALYSIS JSON SAMPLE ---');
  console.log(JSON.stringify(hazardRes.hazards.slice(0, 2), null, 2));
  console.log('');

  // ─── Final Summary ────────────────────────────────────────────────────────
  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.length - passed;

  console.log('================================================================');
  console.log(`  HAZARD ANALYSIS SUMMARY: ${passed} / ${checks.length} CHECKS PASSED (${failed} FAILED)`);
  console.log('================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runDisasterHazardAnalysisVerification();
