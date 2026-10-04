/**
 * Gemma Reasoning Service — Pipeline Stage 6
 * 
 * Sends the RAG-augmented prompt directly to Gemma via generateJson() instead
 * of routing through analyzeVoice(). This ensures the carefully built prompt
 * from promptBuilderService (with RAG context, citizen report, and language info)
 * is sent to the model, rather than being discarded.
 */

const gemmaConfig = require('../../config/gemma');
const gemmaClient = require('../gemma/gemmaClient');
const responseParser = require('../gemma/responseParser');
const aiReliabilityService = require('./aiReliabilityService');
const logger = require('../../utils/logger');

class GemmaReasoningService {
  async executeInference({ builtPrompt, rawPayload }) {
    const primaryModel = process.env.PRIMARY_REASONING_MODEL || 'gemini-3.8-flash';
    const verifierModel = gemmaConfig.gemmaModel || 'gemma-4-26b-a4b-it';

    try {
      const primaryResult = await aiReliabilityService.executeWithRetry(async () => {
        const fullPrompt = `${builtPrompt.systemPrompt}\n\n${builtPrompt.userPrompt}`;

        logger.info(`[GemmaReasoningService] Sending RAG-augmented prompt to primary reasoning model '${primaryModel}' (${fullPrompt.length} chars)`);

        const response = await gemmaClient.generateJson(fullPrompt, {
          model: primaryModel,
          parameters: {
            temperature: 0.1,
          },
          timeoutMs: gemmaConfig.timeoutMs || 25000,
        });

        if (!response || response.success === false) {
          throw new Error(response?.error?.message || `Primary model ${primaryModel} inference returned error`);
        }

        const parsed = responseParser.parseJson(response, null);

        if (!parsed) {
          throw new Error('Failed to parse JSON from primary reasoning response');
        }

        return {
          summary: parsed.summary || parsed.responderBriefing || null,
          disasterType: parsed.category || parsed.disasterCategory || parsed.disaster_type || parsed.incidentType || null,
          category: parsed.category || parsed.disasterCategory || parsed.disaster_type || null,
          disasterCategory: parsed.category || parsed.disasterCategory || parsed.disaster_type || null,
          urgency: parsed.severity || parsed.urgency || parsed.recommendedPriority || null,
          severity: parsed.severity || null,
          recommendedPriority: parsed.recommendedPriority || parsed.priority || null,
          confidenceScore: typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : (typeof parsed.confidence === 'number' ? parsed.confidence : null),
          confidence: typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : (typeof parsed.confidence === 'number' ? parsed.confidence : null),
          reasoningExplanation: parsed.reason || parsed.reasoningExplanation || parsed.explanation || parsed.reasoning || null,
          reason: parsed.reason || parsed.reasoningExplanation || parsed.explanation || null,
          keyEvidence: Array.isArray(parsed.keyEvidence) ? parsed.keyEvidence : (Array.isArray(parsed.evidence) ? parsed.evidence : []),
          contradictionDetected: Boolean(parsed.contradictionDetected),
          recommendedResponseTeam: parsed.recommendedResponseTeam || null,
          affectedCount: typeof parsed.affected_people_estimate === 'number' ? parsed.affected_people_estimate : null,
          evidence: Array.isArray(parsed.evidence) ? parsed.evidence : null,
          analysis: typeof parsed.analysis === 'object' && parsed.analysis ? parsed.analysis : null,
          rawParsed: parsed,
        };
      }, 'GEMINI_3_8_FLASH_PRIMARY_INFERENCE');

      if (primaryResult && (primaryResult.summary || primaryResult.disasterType) && !primaryResult.isError) {
        const conf = typeof primaryResult.confidence === 'number' ? primaryResult.confidence : 0.85;
        const isConflict = Boolean(primaryResult.contradictionDetected);

        // Fast path: if high confidence and no conflict, return immediately
        if (conf >= 0.70 && !isConflict) {
          return {
            rawResponse: primaryResult,
            inferenceSource: 'GEMINI_3_8_FLASH_PRIMARY_MODEL',
            model: primaryModel,
          };
        }

        // Conditional Verification: Gemma 4 verification for low confidence or contradiction
        try {
          logger.info(`[GemmaReasoningService] Triggering Gemma 4 verification for incident (conf: ${conf}, conflict: ${isConflict})`);
          const verifyPrompt = `<start_of_turn>user\n${builtPrompt.systemPrompt}\n\n${builtPrompt.userPrompt}\nPreliminary Assessment: ${primaryResult.disasterType} (Conf: ${conf})\nAdjudicate and confirm final emergency category.<end_of_turn>\n<start_of_turn>model\n`;
          const verifyRes = await gemmaClient.generateJson(verifyPrompt, {
            model: verifierModel,
            parameters: { temperature: 0.1 },
            timeoutMs: 25000,
          });

          if (verifyRes && verifyRes.success) {
            const verifiedParsed = responseParser.parseJson(verifyRes, null);
            if (verifiedParsed && (verifiedParsed.category || verifiedParsed.disasterCategory)) {
              return {
                rawResponse: {
                  ...primaryResult,
                  ...verifiedParsed,
                  disasterType: verifiedParsed.category || verifiedParsed.disasterCategory || primaryResult.disasterType,
                  category: verifiedParsed.category || verifiedParsed.disasterCategory || primaryResult.category,
                },
                inferenceSource: 'GEMMA_4_VERIFIED',
                model: verifierModel,
              };
            }
          }
        } catch (vErr) {
          logger.warn(`[GemmaReasoningService] Gemma 4 verification skipped: ${vErr.message}`);
        }

        return {
          rawResponse: primaryResult,
          inferenceSource: 'GEMINI_3_8_FLASH_PRIMARY_MODEL',
          model: primaryModel,
        };
      }
    } catch (err) {
      logger.warn(`[GemmaReasoningService] Primary inference failed: ${err.message}`);
      aiReliabilityService.logAiFailure({
        errorType: 'PRIMARY_INFERENCE_FAILED',
        stage: 'GEMMA_REASONING',
        message: err.message,
      });
    }

    // Return structured unavailable output if AI model inference is unreachable
    const fallbackResponse = aiReliabilityService.buildZeroDataLossFallback(rawPayload);

    return {
      rawResponse: {
        summary: fallbackResponse.summary,
        disasterType: fallbackResponse.disaster_type,
        urgency: fallbackResponse.severity,
        confidenceScore: fallbackResponse.confidence,
        reasoningExplanation: fallbackResponse.explanation,
        aiStatus: 'AI_MODEL_UNAVAILABLE',
      },
      inferenceSource: 'RESONIX_RELIABILITY_FALLBACK_ENGINE',
      model: verifierModel,
    };
  }
}

const gemmaReasoningService = new GemmaReasoningService();
module.exports = gemmaReasoningService;
