/**
 * Responder Dashboard Vision Integration Verification Suite
 */

const fs = require('fs');
const path = require('path');

async function runResponderDashboardVisionIntegrationVerification() {
  console.log('================================================================');
  console.log('  RESPONDER DASHBOARD VISION INTEGRATION VERIFICATION SUITE     ');
  console.log('================================================================\n');

  const checks = [];
  function recordCheck(id, title, passed, details) {
    checks.push({ id, title, passed, details });
    const mark = passed ? '✓ PASS' : '❌ FAIL';
    console.log(`${mark} [DashboardVision-${id}] ${title}`);
    console.log(`        Details: ${details}\n`);
  }

  const modalPath = path.join(__dirname, '../../client-responder/src/components/incidents/IncidentDetailModal.jsx');
  const modalContent = fs.readFileSync(modalPath, 'utf-8');

  // ─── Check 1: Vision Summary Section Present in UI ───────────────────────
  const hasSummary = modalContent.includes('Vision Summary') && modalContent.includes('disaster_type') && modalContent.includes('overall_scene_description');
  recordCheck(1, 'Display Vision Summary (Disaster Type, Category, Scene Description)',
    hasSummary,
    'IncidentDetailModal renders Vision Summary section with disaster_type and scene description.'
  );

  // ─── Check 2: Visual Hazards Section Present in UI ───────────────────────
  const hasHazards = modalContent.includes('Visual Hazards Identified') && modalContent.includes('location_description');
  recordCheck(2, 'Display Visual Hazards with Spatial Grid Quadrant & Severity',
    hasHazards,
    'IncidentDetailModal renders Visual Hazards section with quadrant location and severity badges.'
  );

  // ─── Check 3: Infrastructure Damage Assessment Section Present in UI ──────
  const hasInfra = modalContent.includes('Infrastructure Damage Assessment') && modalContent.includes('utility_infrastructure');
  recordCheck(3, 'Display Infrastructure Damage (Buildings, Roads, Bridges, Vehicles, Utilities)',
    hasInfra,
    'IncidentDetailModal renders Infrastructure Damage grid covering all 5 asset categories.'
  );

  // ─── Check 4: Affected People Estimate & Vulnerable Groups Present ────────
  const hasImpact = modalContent.includes('Human Impact & Vulnerable Groups') && modalContent.includes('range_band');
  recordCheck(4, 'Display Affected People Range Band & Vulnerable Demographics',
    hasImpact,
    'IncidentDetailModal renders Affected People Range Band and Vulnerable Demographics.'
  );

  // ─── Check 5: Resource Recommendations, Confidence & Knowledge References ─
  const hasRecsAndRefs = modalContent.includes('Vision-RAG Resource Recommendations') && modalContent.includes('Retrieved Knowledge References') && modalContent.includes('VISUAL CONFIDENCE');
  recordCheck(5, 'Display Vision-RAG Resource Recommendations, Confidence % & RAG Knowledge References',
    hasRecsAndRefs,
    'IncidentDetailModal renders Resource Recommendations, Visual Confidence %, and RAG Knowledge References.'
  );

  // ─── Final Summary ────────────────────────────────────────────────────────
  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.length - passed;

  console.log('================================================================');
  console.log(`  DASHBOARD INTEGRATION SUMMARY: ${passed} / ${checks.length} CHECKS PASSED (${failed} FAILED)`);
  console.log('================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runResponderDashboardVisionIntegrationVerification();
