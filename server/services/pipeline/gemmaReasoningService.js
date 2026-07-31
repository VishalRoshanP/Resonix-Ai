const gemmaConfig = require('../../config/gemma');
const gemmaService = require('../gemma');
const aiReliabilityService = require('./aiReliabilityService');

class GemmaReasoningService {
  async executeInference({ builtPrompt, rawPayload }) {
    const targetModel = gemmaConfig.ollamaModel || 'gemma4:e4b';

    try {
      const gemmaResult = await aiReliabilityService.executeWithRetry(async () => {
        return await gemmaService.analyzeVoice({
          transcript: builtPrompt.formattedInputText,
          context: {
            description: rawPayload.description,
            category: rawPayload.category,
            gps: rawPayload.gpsCoordinates,
          },
        });
      }, 'GEMMA_4_PRIMARY_INFERENCE');

      if (gemmaResult && gemmaResult.summary && !gemmaResult.isError) {
        return {
          rawResponse: gemmaResult,
          inferenceSource: 'GEMMA_4_PRIMARY_MODEL',
          model: targetModel,
        };
      }
    } catch (err) {
      aiReliabilityService.logAiFailure({
        errorType: 'PRIMARY_INFERENCE_FAILED',
        stage: 'GEMMA_REASONING',
        message: err.message,
      });
    }

    // Return structured unavailable output if Gemma 4 E4B model inference is unreachable
    const fallbackResponse = aiReliabilityService.buildZeroDataLossFallback(rawPayload);

    return {
      rawResponse: {
        summary: fallbackResponse.summary,
        disasterType: fallbackResponse.disaster_type,
        urgency: fallbackResponse.severity,
        confidenceScore: fallbackResponse.confidence,
        reasoningExplanation: fallbackResponse.explanation,
        gemmaStatus: 'GEMMA_4_E4B_UNAVAILABLE',
      },
      inferenceSource: 'RESONIX_RELIABILITY_FALLBACK_ENGINE',
      model: targetModel,
    };
  }
}

const gemmaReasoningService = new GemmaReasoningService();
module.exports = gemmaReasoningService;
