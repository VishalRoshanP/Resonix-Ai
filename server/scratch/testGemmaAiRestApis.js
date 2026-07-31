/**
 * Dedicated REST APIs for Gemma Intelligence Integration Test
 */

const aiController = require('../controllers/aiController');

async function runAiRestApiTests() {
  console.log('--- STARTING REST APIS FOR GEMMA INTELLIGENCE INTEGRATION TEST ---');
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

  let generatedId = null;

  // 1. Test POST /api/ai/analyze
  try {
    const mockRes = {
      statusCode: 200,
      data: null,
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.data = payload; return this; }
    };

    await aiController.analyzeEmergency(
      {
        body: {
          text: 'Flash flood alert in Sector 4! 3 children trapped.',
          language: 'en',
        },
      },
      mockRes,
      (err) => { throw err; }
    );

    const data = mockRes.data.data;
    generatedId = data.id;

    assert(
      mockRes.statusCode === 200 && mockRes.data.status === 'success' && data.analysis && data.references,
      'POST /api/ai/analyze executes Gemma 4 analysis and returns structured JSON with 5-collection references'
    );
  } catch (err) {
    assert(false, 'POST /api/ai/analyze failed: ' + err.message);
  }

  // 2. Test GET /api/ai/report/:id
  try {
    const mockRes = {
      statusCode: 200,
      data: null,
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.data = payload; return this; }
    };

    await aiController.getReportIntelligence(
      { params: { id: generatedId || 'ue_demo_101' } },
      mockRes,
      (err) => { throw err; }
    );

    const reportData = mockRes.data.data;
    assert(
      mockRes.statusCode === 200 && mockRes.data.status === 'success' && reportData.shortSummary && reportData.explainableAi,
      'GET /api/ai/report/:id retrieves full report intelligence bundle'
    );
  } catch (err) {
    assert(false, 'GET /api/ai/report/:id failed: ' + err.message);
  }

  // 3. Test GET /api/ai/summary/:id
  try {
    const mockRes = {
      statusCode: 200,
      data: null,
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.data = payload; return this; }
    };

    await aiController.getReportSummary(
      { params: { id: generatedId || 'ue_demo_101' } },
      mockRes,
      (err) => { throw err; }
    );

    const summaryData = mockRes.data.data;
    assert(
      mockRes.statusCode === 200 && mockRes.data.status === 'success' && summaryData.shortSummary && Array.isArray(summaryData.shortSummaryLines),
      'GET /api/ai/summary/:id retrieves responder short summary bullet lines'
    );
  } catch (err) {
    assert(false, 'GET /api/ai/summary/:id failed: ' + err.message);
  }

  // 4. Test GET /api/ai/explanation/:id
  try {
    const mockRes = {
      statusCode: 200,
      data: null,
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.data = payload; return this; }
    };

    await aiController.getReportExplanation(
      { params: { id: generatedId || 'ue_demo_101' } },
      mockRes,
      (err) => { throw err; }
    );

    const xaiData = mockRes.data.data;
    assert(
      mockRes.statusCode === 200 && mockRes.data.status === 'success' && xaiData.explainableAi && xaiData.explainableAi.disasterExplanation,
      'GET /api/ai/explanation/:id retrieves Explainable AI decision rationales'
    );
  } catch (err) {
    assert(false, 'GET /api/ai/explanation/:id failed: ' + err.message);
  }

  console.log(`\n--- GEMMA AI REST APIS TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ---`);
  if (failed > 0) process.exit(1);
  process.exit(0);
}

runAiRestApiTests();
