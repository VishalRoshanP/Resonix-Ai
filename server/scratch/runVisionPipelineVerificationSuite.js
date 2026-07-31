/**
 * Vision Intelligence Pipeline End-to-End Verification Suite
 */

const visionPipelineOrchestrator = require('../services/vision/visionPipelineOrchestrator');
const imageValidationService = require('../services/vision/imageValidationService');
const imagePreprocessingService = require('../services/vision/imagePreprocessingService');
const visionPromptBuilderService = require('../services/vision/visionPromptBuilderService');
const gemmaVisionAnalysisService = require('../services/vision/gemmaVisionAnalysisService');
const visionJsonValidationService = require('../services/vision/visionJsonValidationService');
const visionMongoStorageService = require('../services/vision/visionMongoStorageService');
const visionDashboardNotificationService = require('../services/vision/visionDashboardNotificationService');

async function runVisionPipelineVerificationSuite() {
  console.log('================================================================');
  console.log('   VISION INTELLIGENCE PIPELINE 7-STAGE VERIFICATION SUITE      ');
  console.log('================================================================\n');

  const checks = [];
  function recordCheck(id, title, passed, details) {
    checks.push({ id, title, passed, details });
    const mark = passed ? '✓ PASS' : '❌ FAIL';
    console.log(`${mark} [Vision Pipeline Stage ${id}] ${title}`);
    console.log(`        Details: ${details}\n`);
  }

  // 1. Generate realistic Base64 image payload (valid 100-character mock buffer string)
  const sampleBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const samplePhotoId = `photo_qa_${Date.now()}`;

  const imagePayload = {
    photoId: samplePhotoId,
    data: sampleBase64,
    mimeType: 'image/png',
    sizeBytes: 1500,
    context: {
      sector: 'Sector 4',
      category: 'BUILDING_COLLAPSE',
      citizenNotes: 'QA Emergency Photo: 3-story concrete building collapse near market',
    },
  };

  // ─── Stage 1: Image Validation Service Test ─────────────────────────────────
  const stage1Result = imageValidationService.validateImage(imagePayload);
  recordCheck(1, 'Stage 1: Image Validation (MIME, Size <= 15MB, Payload Integrity)',
    stage1Result.isValid === true,
    `Validated ${stage1Result.mimeType} photo '${stage1Result.photoId}'. Size: ${stage1Result.sizeBytes} bytes.`
  );

  // ─── Stage 2: Image Preprocessing Service Test ──────────────────────────────
  const stage2Result = imagePreprocessingService.preprocess(imagePayload);
  const stage2Ok = Boolean(stage2Result.dataUrl && stage2Result.checksum && stage2Result.targetWidth === 1024);
  recordCheck(2, 'Stage 2: Image Preprocessing (1024x1024 Max, SHA256 Checksum)',
    stage2Ok,
    `Preprocessed photo. Checksum: '${stage2Result.checksum}'. Max dimensions: ${stage2Result.targetWidth}x${stage2Result.targetHeight}.`
  );

  // ─── Stage 3: Vision Prompt Builder Service Test ───────────────────────────
  const stage3Prompt = visionPromptBuilderService.buildVisionPrompt(imagePayload.context);
  const stage3Ok = typeof stage3Prompt === 'string' && stage3Prompt.includes('VISUAL INSPECTION TASK') && stage3Prompt.includes('Sector 4');
  recordCheck(3, 'Stage 3: Vision Prompt Builder (Spatial Grid & NDMA Categories)',
    stage3Ok,
    `Constructed Gemma vision prompt (${stage3Prompt.length} chars) for Sector 4.`
  );

  // ─── Stage 4: Gemma Vision Analysis Service Test ───────────────────────────
  const stage4Result = await gemmaVisionAnalysisService.analyzeVision(stage2Result, stage3Prompt, imagePayload.context);
  const stage4Ok = Boolean(stage4Result.rawAnalysis && stage4Result.durationMs >= 0);
  recordCheck(4, 'Stage 4: Gemma Vision Analysis (Multimodal Visual Inference)',
    stage4Ok,
    `Executed Gemma 4 vision inference for photo '${stage4Result.photoId}' in ${stage4Result.durationMs}ms.`
  );

  // ─── Stage 5: Vision JSON Validation Service Test ──────────────────────────
  const stage5Result = visionJsonValidationService.validateVisionJson(stage4Result);
  const visionRec = stage5Result.sanitizedVisionRecord;
  const stage5Ok = stage5Result.isValid === true && Boolean(visionRec.visibleDisaster && visionRec.confidence);
  recordCheck(5, 'Stage 5: Vision JSON Validation (Strict Visual Schema Enforcement)',
    stage5Ok,
    `Validated vision JSON: Disaster='${visionRec.visibleDisaster}', Damage='${visionRec.infrastructureDamage}', Confidence=${visionRec.confidence}.`
  );

  // ─── Stage 6: Vision MongoDB Storage Service Test ──────────────────────────
  const stage6Doc = await visionMongoStorageService.storeVisionRecord(visionRec, imagePayload.context);
  const stage6Ok = Boolean(stage6Doc._id && stage6Doc.photoId === samplePhotoId);
  recordCheck(6, 'Stage 6: Vision MongoDB Storage (ImageUnderstanding Collection)',
    stage6Ok,
    `Persisted ImageUnderstanding record '${stage6Doc._id}' in MongoDB.`
  );

  // ─── Stage 7: Vision Dashboard Notification Service Test ──────────────────
  const stage7Result = visionDashboardNotificationService.dispatchVisualAlert(stage6Doc, imagePayload.context);
  const stage7Ok = stage7Result.dispatched === true && Boolean(stage7Result.alertId);
  recordCheck(7, 'Stage 7: Vision Dashboard Notification (Real-Time Visual Hazard Alert)',
    stage7Ok,
    `Dispatched visual alert '${stage7Result.alertId}' to client-responder dashboard: "${stage7Result.alertSummary}".`
  );

  // ─── Complete Orchestrator Integration Test ───────────────────────────────
  const orchestratorResult = await visionPipelineOrchestrator.executeVisionPipeline(imagePayload);
  const orchOk = orchestratorResult.success === true && orchestratorResult.totalDurationMs >= 0;

  recordCheck(8, 'End-to-End Vision Pipeline Orchestrator Integration',
    orchOk,
    `Executed complete 7-stage Vision Intelligence Pipeline in ${orchestratorResult.totalDurationMs}ms.`
  );

  // ─── Final Summary ────────────────────────────────────────────────────────
  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.length - passed;

  console.log('================================================================');
  console.log(`  VISION PIPELINE SUMMARY: ${passed} / ${checks.length} CHECKS PASSED (${failed} FAILED)`);
  console.log('================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runVisionPipelineVerificationSuite();
