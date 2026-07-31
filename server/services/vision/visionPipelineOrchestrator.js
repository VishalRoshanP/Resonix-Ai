/**
 * Vision Intelligence Pipeline Orchestrator for RESONIX AI
 * 
 * Modular 7-Stage Architecture:
 * Stage 1: Image Validation (imageValidationService)
 * Stage 2: Image Preprocessing (imagePreprocessingService)
 * Stage 3: Vision Prompt Builder (visionPromptBuilderService)
 * Stage 4: Gemma Vision Analysis (gemmaVisionAnalysisService)
 * Stage 5: JSON Validation (visionJsonValidationService)
 * Stage 6: MongoDB Storage (visionMongoStorageService)
 * Stage 7: Responder Dashboard (visionDashboardNotificationService)
 * 
 * Executes the complete Vision Intelligence pipeline seamlessly without breaking or changing existing REST APIs.
 */

const imageValidationService = require('./imageValidationService');
const imagePreprocessingService = require('./imagePreprocessingService');
const visionPromptBuilderService = require('./visionPromptBuilderService');
const gemmaVisionAnalysisService = require('./gemmaVisionAnalysisService');
const visionJsonValidationService = require('./visionJsonValidationService');
const visionMongoStorageService = require('./visionMongoStorageService');
const visionDashboardNotificationService = require('./visionDashboardNotificationService');

const logger = require('../../utils/logger');

class VisionPipelineOrchestrator {
  /**
   * Executes complete 7-stage Vision Intelligence Pipeline
   * @param {Object} imagePayload - { photoId, data, mimeType, sizeBytes, context }
   * @returns {Promise<Object>} Pipeline result containing output of all 7 stages
   */
  async executeVisionPipeline(imagePayload = {}) {
    const startTime = Date.now();
    const photoId = imagePayload.photoId || `photo_${Date.now()}`;
    const context = imagePayload.context || {};

    logger.info(`[VisionPipelineOrchestrator] Starting 7-Stage Vision Intelligence Pipeline for photo '${photoId}'...`);

    // ── STAGE 1: IMAGE VALIDATION ──────────────────────────────────────────
    const validationResult = imageValidationService.validateImage(imagePayload);
    if (!validationResult.isValid) {
      throw new Error(`Vision Pipeline Stage 1 Failed: ${validationResult.errors.join(' | ')}`);
    }

    // ── STAGE 2: IMAGE PREPROCESSING ────────────────────────────────────────
    const preprocessedRecord = imagePreprocessingService.preprocess(imagePayload);

    // ── STAGE 3: VISION PROMPT BUILDER ──────────────────────────────────────
    const formattedVisionPrompt = visionPromptBuilderService.buildVisionPrompt(context);

    // ── STAGE 4: GEMMA VISION ANALYSIS ──────────────────────────────────────
    const rawGemmaOutput = await gemmaVisionAnalysisService.analyzeVision(
      preprocessedRecord,
      formattedVisionPrompt,
      context
    );

    // ── STAGE 5: JSON VALIDATION ─────────────────────────────────────────────
    const validatedJsonRecord = visionJsonValidationService.validateVisionJson(rawGemmaOutput);

    // ── DISASTER HAZARD ANALYSIS ENHANCEMENT ──────────────────────────────
    const disasterHazardAnalysisService = require('./disasterHazardAnalysisService');
    const hazardAnalysisResult = disasterHazardAnalysisService.analyzeHazards(
      validatedJsonRecord.sanitizedVisionRecord,
      context
    );

    // Attach detected hazards to sanitized record for storage
    validatedJsonRecord.sanitizedVisionRecord.detectedHazards = hazardAnalysisResult.hazards;

    // ── HUMAN IMPACT ESTIMATION ENHANCEMENT ────────────────────────────────
    const humanImpactEstimationService = require('./humanImpactEstimationService');
    const humanImpactResult = humanImpactEstimationService.estimateHumanImpact(
      validatedJsonRecord.sanitizedVisionRecord,
      context
    );

    // Attach human impact estimation to sanitized record for storage
    validatedJsonRecord.sanitizedVisionRecord.humanImpactAssessment = humanImpactResult;

    // ── INFRASTRUCTURE DAMAGE ANALYSIS ENHANCEMENT ──────────────────────────
    const infrastructureDamageAnalysisService = require('./infrastructureDamageAnalysisService');
    const infraDamageResult = infrastructureDamageAnalysisService.evaluateInfrastructure(
      validatedJsonRecord.sanitizedVisionRecord,
      context
    );

    // Attach infrastructure assessment to sanitized record for storage
    validatedJsonRecord.sanitizedVisionRecord.infrastructureDamageAssessment = infraDamageResult;

    // ── VISION-RAG FUSION RESOURCE RECOMMENDATION ENHANCEMENT ───────────────
    const visionRagFusionService = require('./visionRagFusionService');
    const resourceRecResult = visionRagFusionService.recommendResources(
      validatedJsonRecord.sanitizedVisionRecord,
      context
    );

    // Attach resource recommendations to sanitized record for storage
    validatedJsonRecord.sanitizedVisionRecord.resourceRecommendations = resourceRecResult;

    // ── VISION AI EXPLAINABILITY ENHANCEMENT ─────────────────────────────────
    const visionExplainabilityService = require('./visionExplainabilityService');
    const explanationResult = visionExplainabilityService.generateExplanation(
      validatedJsonRecord.sanitizedVisionRecord,
      hazardAnalysisResult,
      humanImpactResult,
      infraDamageResult,
      resourceRecResult
    );

    // Attach explanation to sanitized record for MongoDB storage
    validatedJsonRecord.sanitizedVisionRecord.explanation = explanationResult;

    // ── STAGE 6: MONGODB STORAGE ─────────────────────────────────────────────
    const storedMongoDoc = await visionMongoStorageService.storeVisionRecord(
      validatedJsonRecord.sanitizedVisionRecord,
      context
    );

    // ── STAGE 7: RESPONDER DASHBOARD DISPATCH ────────────────────────────────
    const dashboardAlert = visionDashboardNotificationService.dispatchVisualAlert(
      storedMongoDoc,
      context
    );

    const totalDurationMs = Date.now() - startTime;
    logger.info(`[VisionPipelineOrchestrator] 7-Stage Vision Intelligence Pipeline completed successfully for photo '${photoId}' in ${totalDurationMs}ms.`);

    return {
      success: true,
      photoId,
      stage1_validation: validationResult,
      stage2_preprocessing: { photoId, checksum: preprocessedRecord.checksum, mimeType: preprocessedRecord.mimeType },
      stage3_prompt: { promptLength: formattedVisionPrompt.length },
      stage4_gemmaVision: { durationMs: rawGemmaOutput.durationMs },
      stage5_jsonValidation: validatedJsonRecord.sanitizedVisionRecord,
      hazardAnalysis: hazardAnalysisResult,
      humanImpactAssessment: humanImpactResult,
      infrastructureDamageAssessment: infraDamageResult,
      resourceRecommendations: resourceRecResult,
      explanation: explanationResult,
      stage6_mongoStorage: { recordId: storedMongoDoc._id, photoId: storedMongoDoc.photoId },
      stage7_dashboardDispatch: dashboardAlert,
      totalDurationMs,
      completedAt: new Date().toISOString(),
    };
  }
}

const visionPipelineOrchestrator = new VisionPipelineOrchestrator();
module.exports = visionPipelineOrchestrator;
