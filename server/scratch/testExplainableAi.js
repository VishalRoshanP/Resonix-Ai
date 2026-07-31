/**
 * Dedicated Explainable AI (XAI) Responses Integration Test
 */

const gemmaService = require('../services/gemma');
const reportPipeline = require('../pipeline/reportPipeline');
const reportController = require('../controllers/reportController');

async function runExplainableAiTests() {
  console.log('--- STARTING EXPLAINABLE AI (XAI) RESPONSES INTEGRATION TEST ---');
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

  // 1. Pipeline Execution & XAI Object Test
  try {
    const pipelineExec = await reportPipeline.execute({
      voice: { transcript: 'Flash flood alert in Sector 4! 3 children trapped.' },
      text: 'Water entering homes, road blocked.',
      language: 'en',
    });

    const unifiedData = pipelineExec.result;
    const xai = unifiedData.explainableAi;

    assert(xai && typeof xai === 'object', 'Unified emergency output contains explainableAi object');
    assert(
      typeof xai.disasterExplanation === 'string' && xai.disasterExplanation.includes('classified as'),
      `disasterExplanation provides transparent rationale: "${xai.disasterExplanation}"`
    );
    assert(
      typeof xai.urgencyExplanation === 'string' && xai.urgencyExplanation.includes('Urgency marked'),
      `urgencyExplanation provides transparent rationale: "${xai.urgencyExplanation}"`
    );
    assert(
      typeof xai.fieldRationales === 'object' && xai.fieldRationales.disasterType && xai.fieldRationales.urgencyTier,
      'fieldRationales object maps rationales for every extracted emergency field'
    );
    assert(
      unifiedData.shortSummary !== xai.disasterExplanation && unifiedData.detailedAiOutput !== xai,
      'Explanations are stored separately from emergency summary and detailed AI output'
    );
  } catch (err) {
    assert(false, 'Explainable AI pipeline test failed: ' + err.message);
  }

  // 2. Controller Endpoint XAI Response Test
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
          text: 'Flash flood in sector 4. Medical assistance required.',
          language: 'en',
        },
      },
      mockRes,
      (err) => { throw err; }
    );

    const data = mockRes.data.data.pipeline.result;
    assert(data.explainableAi && data.explainableAi.disasterExplanation, 'reportController response includes explainableAi rationale envelope');
  } catch (err) {
    assert(false, 'Controller XAI test failed: ' + err.message);
  }

  console.log(`\n--- EXPLAINABLE AI TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ---`);
  if (failed > 0) process.exit(1);
  process.exit(0);
}

runExplainableAiTests();
