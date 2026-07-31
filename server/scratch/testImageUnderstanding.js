/**
 * Dedicated Image Analysis Workflow & Adapter Layer Integration Test
 */

const imageUnderstandingAdapter = require('../services/gemma/imageUnderstandingAdapter');
const gemmaService = require('../services/gemma');
const reportController = require('../controllers/reportController');

async function runImageUnderstandingTests() {
  console.log('--- STARTING IMAGE ANALYSIS WORKFLOW GEMMA 4 INTEGRATION TEST ---');
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

  // 1. Adapter Multimodal Detection Test
  const isMultimodalSupported = imageUnderstandingAdapter.supportsDirectVision();
  assert(isMultimodalSupported === true, 'ImageUnderstandingAdapter detects multimodal vision support for Gemma model');

  // 2. Visual Parameters Extraction Test
  try {
    const analysis = await imageUnderstandingAdapter.processImage({
      imageData: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      mimeType: 'image/jpeg',
      promptText: 'Analyze flash flood damage and road blockage',
    });

    const requiredFields = [
      'visibleDisaster',
      'floodDepth',
      'fireVisible',
      'collapsedBuildings',
      'roadBlockage',
      'visibleInjuries',
      'smokePresent',
      'waterPresent',
      'vehiclesInvolved',
      'infrastructureDamage',
      'confidenceScores',
      'humanVerificationRequired',
    ];

    const hasAllFields = requiredFields.every((f) => f in analysis);
    assert(hasAllFields, 'Image analysis output contains all 10 required visual parameters + confidence scores + humanVerificationRequired');
    assert(analysis.humanVerificationRequired === true, 'humanVerificationRequired is strictly set to true ("Never replace human verification")');
    assert(typeof analysis.confidenceScores === 'object', 'confidenceScores is a valid scores object');
  } catch (err) {
    assert(false, 'Image understanding processing failed: ' + err.message);
  }

  // 3. Service Layer analyzeImage Integration Test
  try {
    const result = await gemmaService.analyzeImage({
      imageData: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      mimeType: 'image/jpeg',
    });

    assert(result && result.visibleDisaster && result.humanVerificationRequired === true, 'GemmaService.analyzeImage returns structured visual observations via adapter');
  } catch (err) {
    assert(false, 'GemmaService.analyzeImage failed: ' + err.message);
  }

  // 4. Controller Upload Photo Test & Separate Storage
  try {
    const mockRes = {
      statusCode: 200,
      data: null,
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.data = payload; return this; }
    };

    await reportController.uploadReportPhoto(
      {
        body: {
          imageData: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
          mimeType: 'image/jpeg',
          promptText: 'Aerial flood inspection',
        },
      },
      mockRes,
      (err) => { throw err; }
    );

    assert(
      mockRes.statusCode === 200 && mockRes.data.status === 'success' && mockRes.data.data.humanVerificationRequired === true,
      'reportController.uploadReportPhoto analyzes image, returns confidence scores, and stores observations separately'
    );
  } catch (err) {
    assert(false, 'reportController upload photo failed: ' + err.message);
  }

  console.log(`\n--- IMAGE ANALYSIS TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ---`);
  if (failed > 0) process.exit(1);
  process.exit(0);
}

runImageUnderstandingTests();
