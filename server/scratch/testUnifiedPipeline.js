/**
 * Dedicated Unified Emergency Understanding Pipeline Integration Test
 */

const gemmaService = require('../services/gemma');
const reportPipeline = require('../pipeline/reportPipeline');
const reportController = require('../controllers/reportController');

async function runUnifiedPipelineTests() {
  console.log('--- STARTING UNIFIED EMERGENCY UNDERSTANDING PIPELINE INTEGRATION TEST ---');
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

  // 1. Test 5-Modality Full Fusion
  try {
    const result = await gemmaService.processUnifiedPipeline({
      voice: { transcript: 'Flash flood alert in Sector 4! 4 people trapped including 1 child.' },
      image: { imageData: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==', mimeType: 'image/jpeg' },
      text: 'Emergency dispatch: Road blocked by flood waters.',
      gps: { latitude: 37.7749, longitude: -122.4194, accuracy: 8.5 },
      language: 'en',
    });

    assert(result && result.primaryDisasterType && result.primaryDisasterType.confidence > 0, 'Full 5-input pipeline generates structured object with field confidence scores');
    assert(Array.isArray(result.primaryDisasterType.sources) && result.primaryDisasterType.sources.length > 0, 'Field tracks source modalities');
    assert(result.inputsProcessed.voice === true && result.inputsProcessed.image === true && result.inputsProcessed.gps === true, 'Inputs processed map records all 5 modalities');
  } catch (err) {
    assert(false, '5-Modality fusion failed: ' + err.message);
  }

  // 2. Test Partial Modality Fusion (NO Image, NO GPS)
  try {
    const partialResult = await gemmaService.processUnifiedPipeline({
      voice: { transcript: 'Medical emergency in Sector 2.' },
      text: 'Requesting ambulance.',
      language: 'ta',
      // image and gps deliberately omitted
    });

    assert(partialResult && partialResult.primaryDisasterType, 'Pipeline continues gracefully without Image or GPS');
    assert(partialResult.locationData.hasLocation === false, 'locationData correctly indicates no GPS attached without throwing errors');
    assert(partialResult.inputsProcessed.image === false && partialResult.inputsProcessed.gps === false, 'inputsProcessed accurately reflects missing modalities');
  } catch (err) {
    assert(false, 'Partial modality fusion failed: ' + err.message);
  }

  // 3. Test Pipeline Execution Wrapper
  try {
    const pipelineExec = await reportPipeline.execute({
      text: 'Cyclone warning in coastal sector.',
      language: 'en',
    });

    assert(pipelineExec.success === true && pipelineExec.pipeline === 'UNIFIED_EMERGENCY_UNDERSTANDING', 'ReportPipeline.execute runs unified emergency understanding pipeline');
  } catch (err) {
    assert(false, 'ReportPipeline execution failed: ' + err.message);
  }

  // 4. Test Controller Endpoint
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
          text: 'Landslide in Sector 5.',
          language: 'hi',
        },
      },
      mockRes,
      (err) => { throw err; }
    );

    assert(
      mockRes.statusCode === 200 && mockRes.data.status === 'success' && mockRes.data.data.pipeline.result.primaryDisasterType,
      'reportController.executeUnifiedPipeline processes request and returns structured unified emergency JSON object'
    );
  } catch (err) {
    assert(false, 'Controller unified pipeline test failed: ' + err.message);
  }

  console.log(`\n--- UNIFIED PIPELINE TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ---`);
  if (failed > 0) process.exit(1);
  process.exit(0);
}

runUnifiedPipelineTests();
