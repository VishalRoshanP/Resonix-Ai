/**
 * Dedicated Concise Emergency Summary Generator Integration Test
 */

const gemmaService = require('../services/gemma');
const reportPipeline = require('../pipeline/reportPipeline');
const reportController = require('../controllers/reportController');

async function runConciseSummaryTests() {
  console.log('--- STARTING CONCISE EMERGENCY SUMMARY GENERATION INTEGRATION TEST ---');
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

  // 1. Direct Concise Summary Generator Test
  try {
    const summaryResult = await gemmaService.generateConciseSummary({
      inputData: {
        disasterType: 'FLOOD',
        childrenCount: 3,
        peopleCount: 5,
        medicalNeed: true,
        possibleHazards: ['House partially submerged', 'Road inaccessible'],
      },
    });

    assert(typeof summaryResult.shortSummary === 'string' && summaryResult.shortSummary.includes('\n'), 'generateConciseSummary generates line-separated responder bullet facts');
    assert(Array.isArray(summaryResult.shortSummaryLines) && summaryResult.shortSummaryLines.length >= 3, 'shortSummaryLines contains 3-5 individual bullet lines');
    assert(!summaryResult.shortSummary.includes('\n\n') && summaryResult.shortSummary.length < 250, 'Concise summary avoids long paragraphs and remains rapid-scannable');
    assert(typeof summaryResult.detailedAiOutput === 'object' && summaryResult.detailedAiOutput.rawInput, 'Dual storage generates detailedAiOutput object alongside short summary');
  } catch (err) {
    assert(false, 'generateConciseSummary failed: ' + err.message);
  }

  // 2. Unified Pipeline Dual Storage Test
  try {
    const pipelineExec = await reportPipeline.execute({
      text: 'Flood reported. 3 children trapped in house.',
      language: 'en',
    });

    const unifiedData = pipelineExec.result;
    assert(typeof unifiedData.shortSummary === 'string' && unifiedData.shortSummary.length > 0, 'Unified emergency output includes shortSummary string');
    assert(Array.isArray(unifiedData.shortSummaryLines), 'Unified emergency output includes shortSummaryLines array');
    assert(typeof unifiedData.detailedAiOutput === 'object', 'Unified emergency output includes detailedAiOutput object');
  } catch (err) {
    assert(false, 'Pipeline dual storage test failed: ' + err.message);
  }

  // 3. Controller Dual Storage Response Test
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
          text: 'Flash flood reported. 2 people trapped on roof.',
          language: 'en',
        },
      },
      mockRes,
      (err) => { throw err; }
    );

    const data = mockRes.data.data.pipeline.result;
    assert(data.shortSummary && data.detailedAiOutput, 'reportController response contains both shortSummary and detailedAiOutput');
  } catch (err) {
    assert(false, 'Controller dual storage test failed: ' + err.message);
  }

  console.log(`\n--- CONCISE SUMMARY TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ---`);
  if (failed > 0) process.exit(1);
  process.exit(0);
}

runConciseSummaryTests();
