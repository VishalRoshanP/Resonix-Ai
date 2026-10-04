/**
 * Modular AI Pipeline Orchestrator for RESONIX AI
 * 
 * Pipeline Execution Workflow:
 * 1. Citizen Report (Ingest)
 * 2. Input Validation (inputValidationService.js)
 * 3. Speech Processing (speechProcessingService.js)
 * 4. Language Detection (languageDetectionService.js)
 * 5. Prompt Builder (promptBuilderService.js)
 * 6. Gemma 4 Reasoning (gemmaReasoningService.js)
 * 7. Response Validator (responseValidatorService.js)
 * 8. Structured JSON Formatter (structuredJsonService.js)
 * 9. Database Persistence (MongoDB EmergencyPacket & Incident)
 * 10. Responder Dashboard Notification
 * 
 * IMPORTANT:
 * - Does NOT modify UI
 * - Does NOT change citizen workflow
 * - Does NOT change responder dashboard
 * - Does NOT redesign backend APIs
 * - Does NOT implement RAG or Function Calling
 */

const inputValidationService = require('./pipeline/inputValidationService');
const speechProcessingService = require('./pipeline/speechProcessingService');
const languageDetectionService = require('./pipeline/languageDetectionService');
const imagePreprocessingService = require('./vision/imagePreprocessingService');
const imageValidationService = require('./vision/imageValidationService');
const knowledgeRetrievalService = require('./pipeline/knowledgeRetrievalService');
const promptBuilderService = require('./pipeline/promptBuilderService');
const gemmaReasoningService = require('./pipeline/gemmaReasoningService');
const responseValidatorService = require('./pipeline/responseValidatorService');
const aiGroundingService = require('./pipeline/aiGroundingService');
const knowledgeAttributionService = require('./pipeline/knowledgeAttributionService');
const structuredJsonService = require('./pipeline/structuredJsonService');
const aiObservabilityService = require('./pipeline/aiObservabilityService');
const logger = require('../utils/logger');

class AiPipelineOrchestrator {
  /**
   * Executes the Multimodal AI Pipeline sequentially for an incoming citizen report:
   * Citizen Report (Text, Voice, Image, GPS) -> Validation -> Speech -> Language -> Image -> Knowledge Retrieval -> Prompt Builder -> Gemma 4 -> Validator -> Grounding -> Attribution -> Structured JSON
   * @param {Object} rawReportPayload - Citizen report payload
   * @returns {Promise<Object>} Final structured AI reasoning output
   */
  async executePipeline(rawReportPayload = {}) {
    const packetId = rawReportPayload.packetId || rawReportPayload.id || `pkt_${Date.now()}`;
    const startRecord = aiObservabilityService.startProcessing({ packetId, category: rawReportPayload.category || rawReportPayload.type || rawReportPayload.disasterCategory || 'GENERAL' });
    let validationResult = null;

    try {
      // Stage 1: Input Validation
      validationResult = inputValidationService.validate(rawReportPayload);
      if (!validationResult.isValid) {
        logger.warn('[AiPipelineOrchestrator] Input validation warning:', validationResult.errors.join(', '));
      }
      const validatedPayload = validationResult.sanitizedPayload;

      // Stage 2A: Speech Processing (Voice -> Text)
      const speechResult = await speechProcessingService.process(validatedPayload);

      // Stage 2B: Language Detection & Script Analysis
      const languageInfo = languageDetectionService.detect(speechResult, validatedPayload);

      // Stage 2C: Image Processing (Photo / Vision Telemetry)
      let imageMeta = {
        hasPhoto: false,
        status: 'IMAGE_ANALYSIS_UNAVAILABLE',
        reasoning: 'No photo evidence provided by citizen.',
        visionAnalysis: null,
      };
      const hasPhotoData = Boolean(
        validatedPayload.photoReference?.hasPhoto ||
        validatedPayload.photoReference?.dataUrl ||
        validatedPayload.photoReference?.data ||
        validatedPayload.imageData ||
        validatedPayload.imagePath
      );

      if (hasPhotoData) {
        try {
          const rawImgData = validatedPayload.photoReference?.dataUrl ||
            validatedPayload.photoReference?.data ||
            validatedPayload.imageData ||
            validatedPayload.imagePath;

          const imgValidation = imageValidationService.validateImage({
            data: rawImgData,
            mimeType: validatedPayload.photoReference?.mimeType || 'image/jpeg',
            sizeBytes: validatedPayload.photoReference?.sizeBytes || (typeof rawImgData === 'string' ? rawImgData.length : 0),
          });

          if (imgValidation.isValid) {
            const preprocessed = imagePreprocessingService.preprocess({
              photoId: validatedPayload.photoReference?.photoId || `img_${Date.now()}`,
              data: rawImgData,
              mimeType: validatedPayload.photoReference?.mimeType || 'image/jpeg',
            });

            let visionAnalysis = null;
            try {
              const gemmaVisionAnalysisService = require('./vision/gemmaVisionAnalysisService');
              const visionResult = await gemmaVisionAnalysisService.analyzeVision(
                preprocessed,
                validatedPayload.description || validatedPayload.text || 'Analyze emergency site photo for disaster features',
                validatedPayload
              );
              visionAnalysis = visionResult.rawAnalysis || visionResult;
            } catch (vErr) {
              logger.warn('[AiPipelineOrchestrator] Gemma Vision analysis warning:', vErr.message);
              visionAnalysis = { status: 'IMAGE_ANALYSIS_FAILED', error: vErr.message };
            }

            imageMeta = {
              hasPhoto: true,
              status: visionAnalysis?.status || 'AVAILABLE',
              photoId: preprocessed.photoId,
              checksum: preprocessed.checksum,
              mimeType: preprocessed.mimeType,
              targetWidth: preprocessed.targetWidth,
              targetHeight: preprocessed.targetHeight,
              dataUrl: preprocessed.dataUrl,
              visionAnalysis,
            };
          } else {
            logger.warn('[AiPipelineOrchestrator] Image validation warnings:', imgValidation.errors.join(', '));
            imageMeta = {
              hasPhoto: true,
              status: 'IMAGE_ANALYSIS_FAILED',
              reasoning: `Image validation failed: ${imgValidation.errors.join(', ')}`,
              visionAnalysis: null,
            };
          }
        } catch (imgErr) {
          logger.warn('[AiPipelineOrchestrator] Image preprocessing warning:', imgErr.message);
          imageMeta = {
            hasPhoto: true,
            status: 'IMAGE_ANALYSIS_FAILED',
            reasoning: `Image preprocessing failed: ${imgErr.message}`,
            visionAnalysis: null,
          };
        }
      }
      validatedPayload.imageMeta = imageMeta;

      // Stage 3: Semantic Knowledge Retrieval via Pinecone
      const knowledgeContext = await knowledgeRetrievalService.retrieveRelevantKnowledge({
        ...validatedPayload,
        processedTranscript: speechResult.processedTranscript,
      });
      validatedPayload.knowledgeContext = knowledgeContext;

      // Stage 4: Prompt Builder (with Multimodal Context & Retrieved RAG SOPs)
      const builtPrompt = promptBuilderService.buildPrompt({
        validatedPayload,
        processedSpeech: speechResult,
        languageInfo,
        imageMeta,
        knowledgeContext,
      });

      // Stage 5: Gemma 4 Reasoning
      const gemmaOutput = await gemmaReasoningService.executeInference({
        builtPrompt,
        rawPayload: validatedPayload,
      });

      // Stage 6: Response Validator & Schema Compliance
      const validatedResponse = responseValidatorService.validate(gemmaOutput, validatedPayload);

      // Stage 7: Grounding Engine (Grounds Output against Retrieved RAG SOPs)
      const groundedOutput = aiGroundingService.groundRecommendations(
        validatedResponse.validatedOutput,
        knowledgeContext
      );

      // Stage 8: Knowledge Source Attribution Engine
      const attributionRecord = knowledgeAttributionService.generateAttribution(
        groundedOutput,
        knowledgeContext
      );
      validatedPayload.attributionRecord = attributionRecord;

      // Stage 9: Structured JSON Formatter (Strict Separation: Citizen Facts vs AI Inferences)
      const finalStructuredJson = structuredJsonService.format({
        validatedOutput: groundedOutput,
        languageInfo,
        speechMeta: speechResult,
        imageMeta,
        inferenceSource: gemmaOutput.inferenceSource,
        rawPayload: validatedPayload,
      });

      // Stage 10: AI Observability Logging
      const observabilityMeta = aiObservabilityService.finishProcessing(startRecord, {
        success: true,
        failureReason: null,
        inputText: builtPrompt.formattedInputText,
        outputText: finalStructuredJson.summary,
      });

      finalStructuredJson.pipelineExecutionMeta.observability = observabilityMeta;
      return finalStructuredJson;
    } catch (err) {
      logger.error(`[AiPipelineOrchestrator] Pipeline execution error for packet '${packetId}':`, err.message);

      const failureMeta = aiObservabilityService.finishProcessing(startRecord, {
        success: false,
        failureReason: err.message,
      });

      const citizenData = validationResult?.sanitizedPayload?.citizenData || {
        packetId,
        victimName: rawReportPayload.victimName || rawReportPayload.citizenName || 'Anonymous Citizen',
        deviceId: rawReportPayload.deviceId || 'DEV_UNKNOWN',
        category: (rawReportPayload.category || 'GENERAL').toUpperCase(),
        description: rawReportPayload.description || rawReportPayload.text || '',
        transcript: rawReportPayload.transcript || rawReportPayload.voiceTranscript || '',
        gpsCoordinates: rawReportPayload.gpsCoordinates || { hasGps: false },
        photoReference: rawReportPayload.photoReference || { hasPhoto: false },
        audioReference: rawReportPayload.audioReference || { hasAudio: false },
        timestamp: rawReportPayload.timestamp || new Date().toISOString(),
      };

      // Explicit AI processing failure state without synthetic mock answers
      return {
        aiProcessingFailed: true,
        status: 'AI_PROCESSING_FAILED',
        error: err.message,
        incident_id: packetId,
        disaster_type: citizenData.category,
        disasterCategory: citizenData.category,
        severity: 'UNKNOWN',
        priority: 'HIGH',
        recommendedPriority: 'HIGH',
        confidence: null,
        confidenceScore: null,
        summary: 'AI processing unavailable. Manual responder triage required.',
        explanation: `AI processing encountered an explicit error: ${err.message}. Direct citizen facts preserved.`,
        reasoningExplanation: `AI processing encountered an explicit error: ${err.message}. Direct citizen facts preserved.`,
        affected_people_estimate: null,
        vulnerable_persons_detected: [],
        immediate_risks: [],
        hazards_detected: [],
        recommended_actions: ['Initiate manual responder triage', 'Dispatch field unit to confirm citizen telemetry'],
        recommended_resources: ['General Emergency Response Unit'],
        recommendedResponseTeam: 'General Emergency Response Unit',
        retrievedContextReferences: [],
        sourceDocuments: [],
        citizenData,
        evidence: ['Citizen telemetry (Raw payload preserved)'],
        analysis: {
          observed_facts: ['Citizen report received', `Category: ${citizenData.category}`],
          inferred_risks: ['Manual responder triage required due to AI processing exception'],
          uncertainty: [`AI analysis failed: ${err.message}`],
        },
        pipelineExecutionMeta: {
          stagesExecuted: 0,
          inferenceSource: 'AI_PROCESSING_FAILED',
          completedAt: new Date().toISOString(),
          observability: failureMeta,
        },
      };
    }
  }
}

const aiPipelineOrchestrator = new AiPipelineOrchestrator();
module.exports = aiPipelineOrchestrator;
