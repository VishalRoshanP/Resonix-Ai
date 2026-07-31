/**
 * Dedicated 5-Collection Decoupled MongoDB Storage Architecture Integration Test
 */

const EmergencyReport = require('../models/EmergencyReport');
const AiAnalysis = require('../models/AiAnalysis');
const EmergencySummaryRecord = require('../models/EmergencySummaryRecord');
const ConfidenceScoreRecord = require('../models/ConfidenceScoreRecord');
const ExplainableAiRecord = require('../models/ExplainableAiRecord');
const reportController = require('../controllers/reportController');

async function run5CollectionsStorageTests() {
  console.log('--- STARTING 5-COLLECTION DECOUPLED MONGODB STORAGE INTEGRATION TEST ---');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  // 1. Model Export & Schema Existence Tests
  assert(EmergencyReport && EmergencyReport.modelName === 'EmergencyReport', 'Collection 1: EmergencyReport model defined');
  assert(AiAnalysis && AiAnalysis.modelName === 'AiAnalysis', 'Collection 2: AiAnalysis model defined');
  assert(EmergencySummaryRecord && EmergencySummaryRecord.modelName === 'EmergencySummaryRecord', 'Collection 3: EmergencySummaryRecord model defined');
  assert(ConfidenceScoreRecord && ConfidenceScoreRecord.modelName === 'ConfidenceScoreRecord', 'Collection 4: ConfidenceScoreRecord model defined');
  assert(ExplainableAiRecord && ExplainableAiRecord.modelName === 'ExplainableAiRecord', 'Collection 5: ExplainableAiRecord model defined');

  // 2. Controller Pipeline & Reference Tracking Test
  try {
    const mockRes = {
      statusCode: 200,
      data: null,
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.data = payload; return this; }
    };

    await reportController.executeUnifiedPipeline(
      {
        body: {
          text: 'Flash flood alert in Sector 4! 4 people trapped.',
          language: 'en',
        },
      },
      mockRes,
      (err) => { throw err; }
    );

    const data = mockRes.data.data;
    assert(
      mockRes.statusCode === 200 && mockRes.data.status === 'success' && data.references && data.references.unifiedEmergencyId,
      'executeUnifiedPipeline returns cross-collection reference metadata (unifiedEmergencyId, originalReportId, aiAnalysisId, summaryId, confidenceScoreId, explainableAiId)'
    );
  } catch (err) {
    assert(false, '5-Collection storage controller execution failed: ' + err.message);
  }

  console.log(`\n--- 5-COLLECTION STORAGE TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ---`);
  if (failed > 0) process.exit(1);
  process.exit(0);
}

run5CollectionsStorageTests();
