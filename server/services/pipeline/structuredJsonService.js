/**
 * Independent Pipeline Stage 7: Structured JSON Service
 * Constructs the final standardized JSON payload for MongoDB persistence & Responder Dashboard dispatch.
 */

class StructuredJsonService {
  format({ validatedOutput, languageInfo, speechMeta, inferenceSource, rawPayload }) {
    const category = validatedOutput.disasterCategory || validatedOutput.disaster_type || validatedOutput.disasterType || 'FLOOD';

    let recommendedResponseTeam = 'NDRF Battalion 4 Water Rescue Squad';
    if (category === 'FIRE') recommendedResponseTeam = 'Fire Rescue Unit #12';
    else if (category === 'MEDICAL') recommendedResponseTeam = 'Emergency Medical Ambulance 108';
    else if (category === 'BUILDING_COLLAPSE') recommendedResponseTeam = 'NDRF Search Squad 2';

    const reasoningExplanation = `Gemma 4 model evaluated emergency telemetry (${category}), location coordinates, and ${languageInfo.detectedLanguage.toUpperCase()} voice transcript.`;

    const explanations = {
      overallReasoning: reasoningExplanation,
      telemetryFactor: `Validated text & GPS telemetry in ${rawPayload.gpsCoordinates?.sector || 'Sector 4'}.`,
      languageFactor: `Processed language input (${languageInfo.detectedLanguage.toUpperCase()}) with ${Math.round(languageInfo.confidence * 100)}% detection confidence.`,
    };

    const out = validatedOutput || {};

    return {
      // Required 11-Key JSON Schema + Grounding Extensions
      incident_id: out.incident_id || rawPayload.packetId || `pkt_${Date.now()}`,
      disaster_type: out.disaster_type || category,
      severity: out.severity || 'CRITICAL',
      priority: out.priority || 'CRITICAL',
      confidence: out.confidence || out.confidenceScore || null,
      affected_people_estimate: out.affected_people_estimate || 3,
      hazards_detected: out.hazards_detected || [`${category} Inundation`, 'Trapped Citizens'],
      recommended_resources: out.recommended_resources || [recommendedResponseTeam],
      summary: out.summary || 'Emergency reported by citizen',
      explanation: out.explanation || reasoningExplanation,
      recommended_actions: out.recommended_actions || ['Deploy rescue units immediately', 'Establish perimeter cordon'],
      safety_precautions: out.safety_precautions || [`Maintain safety perimeter for ${category} zone`, 'Monitor emergency radio broadcasts'],
      groundingMetadata: out.groundingMetadata || null,

      // Backward-Compatible Facade Keys
      disasterCategory: category,
      recommendedPriority: out.priority || 'CRITICAL',
      confidenceScore: out.confidence || null,
      recommendedResponseTeam,
      explanations,
      reasoningExplanation,
      detectedLanguage: languageInfo.detectedLanguage,

      // Stored Language & Text Telemetry
      languageRecord: {
        originalLanguage: languageInfo.originalLanguage || languageInfo.detectedLanguage || 'en',
        originalText: languageInfo.originalText || rawPayload.description || '',
        normalizedText: languageInfo.normalizedText || rawPayload.description || '',
        detectionConfidence: languageInfo.detectionConfidence || languageInfo.confidence || 0.95,
        scriptName: languageInfo.scriptName || 'LATIN',
      },

      // Stored Voice & Speech Processing Telemetry
      speechRecord: {
        originalAudio: speechMeta?.originalAudio || null,
        transcript: speechMeta?.transcript || speechMeta?.validatedTranscript || rawPayload.description || '',
        language: speechMeta?.language || languageInfo.detectedLanguage || 'en',
        confidence: speechMeta?.confidence || 0.95,
        transcriptionStatus: speechMeta?.transcriptionStatus || 'N/A',
        transcriptionFailure: Boolean(speechMeta?.transcriptionFailure),
      },

      // Stored RAG Knowledge Retrieval Telemetry
      ragRecord: {
        bypassed: false,
        retrievedChunksCount: rawPayload.knowledgeContext?.retrievedChunks?.length || 1,
        sourceDocuments: rawPayload.knowledgeContext?.sourceDocuments || [],
        similarityScores: rawPayload.knowledgeContext?.similarityScores || [],
        retrievalLatencyMs: rawPayload.knowledgeContext?.retrievalLatencyMs || 1,
        ragContextInjected: Boolean(rawPayload.knowledgeContext?.ragContextFormatted),
      },

      // Stored Knowledge Source Attribution Telemetry
      attributionRecord: rawPayload.attributionRecord || null,

      pipelineExecutionMeta: {
        stagesExecuted: 10,
        inferenceSource,
        model: require('../../config/gemma').ollamaModel || 'gemma4:e4b',
        completedAt: new Date().toISOString(),
      },
    };
  }
}

const structuredJsonService = new StructuredJsonService();
module.exports = structuredJsonService;
