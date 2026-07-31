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
   * Executes the AI Pipeline sequentially for an incoming citizen report:
   * Citizen Report -> Validation -> Speech -> Language -> Knowledge Retrieval -> Prompt Builder -> Gemma 4 -> Validator -> Grounding -> Attribution -> JSON -> Persistence
   * @param {Object} rawReportPayload - Citizen report payload
   * @returns {Promise<Object>} Final structured AI reasoning output
   */
  async executePipeline(rawReportPayload = {}) {
    const packetId = rawReportPayload.packetId || `pkt_${Date.now()}`;
    const startRecord = aiObservabilityService.startProcessing({ packetId, category: rawReportPayload.category || 'FLOOD' });

    try {
      // Stage 1: Input Validation
      const validationResult = inputValidationService.validate(rawReportPayload);
      if (!validationResult.isValid) {
        logger.warn('[AiPipelineOrchestrator] Input validation warning:', validationResult.errors.join(', '));
      }
      const validatedPayload = validationResult.sanitizedPayload;

      // Stage 2: Speech Processing
      const speechResult = speechProcessingService.process(validatedPayload);

      // Stage 3: Language Detection
      const languageInfo = languageDetectionService.detect(speechResult, validatedPayload);

      // Stage 4: Semantic Knowledge Retrieval (RAG)
      const knowledgeContext = knowledgeRetrievalService.retrieveRelevantKnowledge({
        ...validatedPayload,
        processedTranscript: speechResult.processedTranscript,
      });
      validatedPayload.knowledgeContext = knowledgeContext;

      // Stage 5: Prompt Builder (with RAG Context)
      const builtPrompt = promptBuilderService.buildPrompt({
        validatedPayload,
        processedSpeech: speechResult,
        languageInfo,
        knowledgeContext,
      });

      // Stage 6: Gemma 4 Reasoning
      const gemmaOutput = await gemmaReasoningService.executeInference({
        builtPrompt,
        rawPayload: validatedPayload,
      });

      // Stage 7: Response Validator
      const validatedResponse = responseValidatorService.validate(gemmaOutput, validatedPayload);

      // Stage 8: Grounding Engine (Enforces Summary, Actions, Safety Precautions, Resources grounded in RAG)
      const groundedOutput = aiGroundingService.groundRecommendations(
        validatedResponse.validatedOutput,
        knowledgeContext
      );

      // Stage 9: Knowledge Source Attribution Engine
      const attributionRecord = knowledgeAttributionService.generateAttribution(
        groundedOutput,
        knowledgeContext
      );
      validatedPayload.attributionRecord = attributionRecord;

      // Stage 10: Structured JSON Formatter
      const finalStructuredJson = structuredJsonService.format({
        validatedOutput: groundedOutput,
        languageInfo,
        speechMeta: speechResult,
        inferenceSource: gemmaOutput.inferenceSource,
        rawPayload: validatedPayload,
      });

      // Stage 8: AI Observability Log
      const observabilityMeta = aiObservabilityService.finishProcessing(startRecord, {
        success: true,
        failureReason: null,
        inputText: builtPrompt.formattedInputText,
        outputText: finalStructuredJson.summary,
      });

      finalStructuredJson.pipelineExecutionMeta.observability = observabilityMeta;
      return finalStructuredJson;
    } catch (err) {
      const failureMeta = aiObservabilityService.finishProcessing(startRecord, {
        success: false,
        failureReason: err.message,
      });

      throw err;
    }
  }
}

const aiPipelineOrchestrator = new AiPipelineOrchestrator();
module.exports = aiPipelineOrchestrator;
