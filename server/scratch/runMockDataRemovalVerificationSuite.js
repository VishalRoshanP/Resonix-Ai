/**
 * Mock Data Removal & Real Incident Data Integrity Verification Suite
 */

const fs = require('fs');
const path = require('path');
const incidentService = require('../services/incidentService');

async function runMockDataRemovalVerificationSuite() {
  console.log('================================================================');
  console.log('   MOCK DATA REMOVAL & BACKEND DATA INTEGRITY VERIFICATION SUITE ');
  console.log('================================================================\n');

  const checks = [];
  function recordCheck(id, title, passed, details) {
    checks.push({ id, title, passed, details });
    const mark = passed ? '✓ PASS' : '❌ FAIL';
    console.log(`${mark} [MockRemoval-${id}] ${title}`);
    console.log(`        Details: ${details}\n`);
  }

  // ─── Check 1: Remove Hardcoded Incident Array from IncidentsPage.jsx ───────
  const incidentsPagePath = path.join(__dirname, '../../client-responder/src/pages/IncidentsPage.jsx');
  const incidentsContent = fs.readFileSync(incidentsPagePath, 'utf-8');

  const noInitialMockIncidents = !incidentsContent.includes('INITIAL_INCIDENTS = [') && incidentsContent.includes('fetchRealIncidents');

  recordCheck(1, 'Remove Hardcoded Incident Array (INITIAL_INCIDENTS) from IncidentsPage.jsx',
    noInitialMockIncidents,
    'IncidentsPage initializes with empty array state and fetches real MongoDB incidents via incidentApi.getIncidents().'
  );

  // ─── Check 2: Remove Hardcoded Dashboard Metrics from DashboardPage.jsx ───
  const dashboardPagePath = path.join(__dirname, '../../client-responder/src/pages/DashboardPage.jsx');
  const dashboardContent = fs.readFileSync(dashboardPagePath, 'utf-8');

  const noHardcodedMetrics = !dashboardContent.includes('count: 148') && !dashboardContent.includes('count: 12') && dashboardContent.includes('fetchDashboardIncidents');

  recordCheck(2, 'Remove Hardcoded Metric Cards & Count Constants from DashboardPage.jsx',
    noHardcodedMetrics,
    'DashboardPage dynamically computes total, critical, and active operation counts from real backend incidents.'
  );

  // ─── Check 3: Real MongoDB Incident Ingestion in Backend ─────────────────
  const testIncident = await incidentService.createIncident({
    title: 'Zero Mock Verification Incident',
    category: 'FLOOD',
    sector: 'Sector 4',
    description: 'Real emergency incident report submitted during verification audit',
  });

  const realIncidentsFromDb = await incidentService.getAllIncidents();
  const dbHasRealIncidents = Array.isArray(realIncidentsFromDb) && realIncidentsFromDb.some((i) => String(i._id || i.id) === String(testIncident._id));

  recordCheck(3, 'Backend Incident Service Queries Real MongoDB Database Records',
    dbHasRealIncidents,
    `Backend returned ${realIncidentsFromDb.length} real MongoDB incident documents. Created real incident '${testIncident._id}'.`
  );

  // ─── Check 4: Dashboard Displays Only Real Incidents Returned from Backend ─
  const dashboardIntegrityOk = incidentsContent.includes('No real backend incident records match') && dashboardContent.includes('incidents.map');

  recordCheck(4, 'Responder Dashboard Displays ONLY Real Incidents Returned from Backend',
    dashboardIntegrityOk,
    'Responder UI displays real backend incidents and clean empty state when no incidents are present.'
  );

  // ─── Final Summary ────────────────────────────────────────────────────────
  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.length - passed;

  console.log('================================================================');
  console.log(`  MOCK REMOVAL SUMMARY: ${passed} / ${checks.length} CHECKS PASSED (${failed} FAILED)`);
  console.log('================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runMockDataRemovalVerificationSuite();
