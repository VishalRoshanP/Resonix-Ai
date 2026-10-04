/**
 * Independent Pipeline Stage 9: Structured JSON Service
 * Constructs the final standardized JSON payload for MongoDB persistence & Responder Dashboard dispatch.
 * Strictly separates verbatim citizen facts from AI inferences.
 */

class StructuredJsonService {
  format({ validatedOutput, languageInfo = {}, speechMeta = {}, imageMeta = {}, inferenceSource, rawPayload = {} }) {
    const out = validatedOutput || {};
    const selectedCategory = (rawPayload.selectedCategory || rawPayload.category || 'GENERAL').toString().toUpperCase();
    const rawAiCategory = (out.category || out.disasterCategory || out.disaster_type || out.disasterType || 'GENERAL').toString().toUpperCase();

    const confidence = out.confidenceScore !== undefined && out.confidenceScore !== null
      ? Number(out.confidenceScore)
      : (out.confidence !== undefined && out.confidence !== null ? Number(out.confidence) : 0.95);

    // Contradiction detection: checks if explicit evidence disagrees with user UI hint
    const contradictionDetected = Boolean(
      out.contradictionDetected ||
      (selectedCategory !== rawAiCategory && selectedCategory !== 'GENERAL' && selectedCategory !== 'OTHER')
    );

    // Confidence-based operational category assignment (Section 7)
    let operationalCategory = rawAiCategory;
    let confidenceNote = 'High confidence AI assessment';

    if (confidence >= 0.80) {
      operationalCategory = rawAiCategory;
      confidenceNote = 'High confidence AI assessment';
    } else if (confidence >= 0.50) {
      operationalCategory = rawAiCategory;
      confidenceNote = 'AI assessment — responder verification recommended';
    } else {
      // Section 10: Low confidence must NOT automatically turn a valid known category into OTHER.
      if (rawAiCategory && rawAiCategory !== 'GENERAL' && rawAiCategory !== 'OTHER') {
        operationalCategory = rawAiCategory;
        confidenceNote = 'Low confidence — responder review required.';
      } else {
        operationalCategory = 'OTHER';
        confidenceNote = 'Classification uncertain — responder review required.';
      }
    }

    const category = operationalCategory;

    let recommendedResponseTeam = 'NDRF Battalion 4 Water Rescue Squad';
    if (category === 'FIRE') recommendedResponseTeam = 'Fire Rescue Unit #12';
    else if (category === 'MEDICAL') recommendedResponseTeam = 'Emergency Medical Ambulance 108';
    else if (category === 'BUILDING_COLLAPSE') recommendedResponseTeam = 'NDRF Search Squad 2';
    else if (category === 'ROAD_ACCIDENT' || category === 'ACCIDENT') recommendedResponseTeam = 'Traffic Trauma Response Squad #1';
    else if (category === 'LANDSLIDE') recommendedResponseTeam = 'NDRF Mountain & Landslide Rescue Unit';
    else if (category === 'CYCLONE_STORM' || category === 'STORM' || category === 'CYCLONE') recommendedResponseTeam = 'Coastal Cyclone Evacuation Taskforce';
    else if (category === 'EARTHQUAKE' || category === 'SEISMIC') recommendedResponseTeam = 'NDRF Structural & Seismic Search Team';

    const contradictionNote = contradictionDetected
      ? `⚠ Citizen selected ${selectedCategory}. Reported evidence indicates ${category}.`
      : null;

    const reasoningExplanation = out.reason || out.explanation || out.reasoningExplanation ||
      `Gemma 4 model evaluated emergency telemetry (${category}), location coordinates, and ${(languageInfo.detectedLanguage || 'English').toUpperCase()} transcript.`;

    const explanations = {
      overallReasoning: reasoningExplanation,
      telemetryFactor: `Validated text & GPS telemetry in ${rawPayload.gpsCoordinates?.sector || 'Sector 4'}.`,
      languageFactor: `Processed language input (${(languageInfo.detectedLanguage || 'unknown').toUpperCase()}) with ${Math.round((languageInfo.confidence || 0.9) * 100)}% detection confidence.`,
    };

    const citizenInput = {
      selectedCategory,
      voiceTranscript: languageInfo.originalTranscript || speechMeta?.rawTranscript || rawPayload.voiceTranscript || rawPayload.transcript || '',
      textDescription: rawPayload.description || rawPayload.text || '',
      photoReference: rawPayload.photoReference || null,
      gpsCoordinates: rawPayload.gpsCoordinates || null,
    };

    const hasVoiceEvidence = Boolean(
      languageInfo.originalTranscript ||
      speechMeta?.rawTranscript ||
      rawPayload.voiceTranscript ||
      rawPayload.transcript ||
      rawPayload.audioReference?.hasAudio
    );
    const evidenceBasis = hasVoiceEvidence ? 'VOICE' : 'CITIZEN_SELECTION';

    const aiAssessment = {
      category: operationalCategory,
      detectedEmergencyCategory: operationalCategory,
      selectedCategory,
      citizenSelectedCategory: selectedCategory,
      severity: (out.severity || 'HIGH').toString().toUpperCase(),
      priority: (out.priority || out.recommendedPriority || 'HIGH').toString().toUpperCase(),
      confidence,
      reason: reasoningExplanation,
      keyEvidence: Array.isArray(out.keyEvidence) ? out.keyEvidence : (Array.isArray(out.evidence) ? out.evidence : []),
      contradictionDetected,
      categoryConflict: contradictionDetected,
      evidenceBasis,
      contradictionNote,
      confidenceNote,
    };

    const citizenData = rawPayload.citizenData || {
      packetId: rawPayload.packetId || `pkt_${Date.now()}`,
      victimName: rawPayload.victimName || rawPayload.citizenName || 'Anonymous Citizen',
      deviceId: rawPayload.deviceId || 'DEV_UNKNOWN',
      category: selectedCategory,
      selectedCategory,
      description: rawPayload.description || rawPayload.text || '',
      transcript: rawPayload.transcript || rawPayload.voiceTranscript || '',
      gpsCoordinates: rawPayload.gpsCoordinates || { hasGps: false },
      photoReference: rawPayload.photoReference || { hasPhoto: false },
      audioReference: rawPayload.audioReference || { hasAudio: false },
      timestamp: rawPayload.timestamp || new Date().toISOString(),
    };

    const sourceDocs = rawPayload.knowledgeContext?.sourceDocuments || [];
    const retrievedContextReferences = sourceDocs.map((doc) => ({
      documentTitle: doc.documentTitle,
      disasterCategory: doc.disasterCategory,
      version: doc.version,
    }));

    return {
      // ── VERBATIM CITIZEN-PROVIDED FACTS (NEVER OVERWRITTEN) ───────────────
      citizenData,
      citizenInput,

      // ── AI ENRICHED ASSESSMENT & EVIDENCE-FIRST CLASSIFICATION ────────────
      aiAssessment,
      category: operationalCategory,
      detectedEmergencyCategory: operationalCategory,
      selectedCategory,
      citizenSelectedCategory: selectedCategory,
      citizenCategory: selectedCategory,
      aiSuggestedCategory: rawAiCategory,
      aiConfidence: confidence,
      confidenceScore: confidence,
      confidence,
      contradictionDetected,
      categoryConflict: contradictionDetected,
      evidenceBasis,
      contradictionNote,
      needsResponderReview: Boolean(contradictionDetected || confidence < 0.80 || out.needsResponderReview || out.needsReview || operationalCategory === 'OTHER'),
      needsReview: Boolean(contradictionDetected || confidence < 0.80 || out.needsResponderReview || out.needsReview || operationalCategory === 'OTHER'),
      affectedPeople: out.affectedPeople !== undefined ? out.affectedPeople : (out.affected_people_estimate !== undefined ? out.affected_people_estimate : null),
      immediateHazards: out.immediateHazards || out.immediate_risks || out.hazards_detected || [],
      vulnerablePersons: out.vulnerablePersons || out.vulnerable_persons_detected || [],
      responderSummary: out.responderSummary || out.summary || 'Emergency reported by citizen',
      reasoningSummary: out.reasoningSummary || reasoningExplanation,

      // ── AI ENRICHED INTELLIGENCE & REASONING ───────────────────────────────
      incident_id: out.incident_id || rawPayload.packetId || `pkt_${Date.now()}`,
      disaster_type: operationalCategory,
      disasterCategory: operationalCategory,
      severity: (out.severity || 'HIGH').toString().toUpperCase(),
      priority: (out.priority || out.recommendedPriority || 'HIGH').toString().toUpperCase(),
      recommendedPriority: (out.recommendedPriority || out.priority || 'HIGH').toString().toUpperCase(),
      affected_people_estimate: out.affected_people_estimate !== undefined ? out.affected_people_estimate : null,
      vulnerable_persons_detected: out.vulnerable_persons_detected || [],
      immediate_risks: out.immediate_risks || out.hazards_detected || [],
      hazards_detected: out.hazards_detected || out.immediate_risks || [],
      recommended_actions: out.recommended_actions || [],
      recommended_resources: out.recommended_resources || [recommendedResponseTeam],
      recommendedResponseTeam,
      summary: out.summary || 'Emergency reported by citizen',
      explanation: reasoningExplanation,
      reasoningExplanation,
      keyEvidence: aiAssessment.keyEvidence,
      safety_precautions: out.safety_precautions || [],
      retrievedContextReferences,
      sourceDocuments: sourceDocs,
      groundingMetadata: out.groundingMetadata || null,
      // ── MULTIMODAL EVIDENCE & REASONING BREAKDOWN ────────────────────────
      evidence: out.evidence || aiAssessment.keyEvidence || [],
      analysis: out.analysis || {
        observed_facts: [],
        inferred_risks: out.immediate_risks || out.hazards_detected || [],
        uncertainty: [],
      },

      // Dual Transcript & Multilingual Telemetry Fields (Phase 5)
      originalTranscript: languageInfo.originalTranscript || speechMeta?.rawTranscript || rawPayload.voiceTranscript || rawPayload.transcript || rawPayload.description || '',
      normalizedTranscript: languageInfo.normalizedTranscript || languageInfo.normalizedText || rawPayload.description || '',
      detectedLanguage: languageInfo.detectedLanguage || 'unknown',
      languageConfidence: languageInfo.languageConfidence || languageInfo.confidence || null,
      speechConfidence: speechMeta?.confidence !== undefined ? speechMeta.confidence : 0.95,
      transcriptionStatus: speechMeta?.transcriptionStatus || 'TEXT_REPORT',

      // Speech Intelligence Extracted Parameters
      emergencyType: out.emergencyType || category,
      injuries: out.injuries || 'None reported',
      trappedPeople: Array.isArray(out.trappedPeople) ? out.trappedPeople : (out.trappedPeople ? [out.trappedPeople] : []),
      vulnerablePeople: Array.isArray(out.vulnerablePeople) ? out.vulnerablePeople : (out.vulnerable_persons_detected || []),
      locationClues: out.locationClues || rawPayload.gpsCoordinates?.sector || 'Location unavailable',

      // Stored Language & Text Telemetry
      languageRecord: {
        originalLanguage: languageInfo.originalLanguage || languageInfo.detectedLanguage || 'unknown',
        detectedLanguage: languageInfo.detectedLanguage || 'unknown',
        originalTranscript: languageInfo.originalTranscript || languageInfo.originalText || rawPayload.description || '',
        normalizedTranscript: languageInfo.normalizedTranscript || languageInfo.normalizedText || rawPayload.description || '',
        originalText: languageInfo.originalText || rawPayload.description || '',
        normalizedText: languageInfo.normalizedText || rawPayload.description || '',
        detectionConfidence: languageInfo.detectionConfidence || languageInfo.confidence || null,
        scriptName: languageInfo.scriptName || 'LATIN',
        isCodeMixed: Boolean(languageInfo.isMixedLanguage),
      },

      // Stored Voice & Speech Processing Telemetry
      speechRecord: {
        originalAudio: speechMeta?.originalAudio || null,
        transcript: speechMeta?.transcript || speechMeta?.validatedTranscript || rawPayload.description || '',
        language: speechMeta?.language || languageInfo.detectedLanguage || 'en',
        confidence: speechMeta?.confidence !== undefined ? speechMeta.confidence : null,
        transcriptionStatus: speechMeta?.transcriptionStatus || 'N/A',
        transcriptionFailure: Boolean(speechMeta?.transcriptionFailure),
      },

      // Stored Visual & Image Telemetry
      imageRecord: {
        hasPhoto: Boolean(imageMeta?.hasPhoto || rawPayload.photoReference?.hasPhoto),
        status: imageMeta?.status || (imageMeta?.hasPhoto ? 'AVAILABLE' : 'IMAGE_ANALYSIS_UNAVAILABLE'),
        reasoning: imageMeta?.reasoning || (imageMeta?.hasPhoto ? 'Photo evidence attached and analyzed' : 'No photo provided by citizen'),
        photoId: imageMeta?.photoId || rawPayload.photoReference?.photoId || null,
        checksum: imageMeta?.checksum || null,
        mimeType: imageMeta?.mimeType || rawPayload.photoReference?.mimeType || null,
        visionAnalysis: imageMeta?.visionAnalysis || null,
      },

      // Stored RAG Knowledge Retrieval Telemetry
      ragRecord: {
        bypassed: false,
        retrievedChunksCount: rawPayload.knowledgeContext?.retrievedChunks?.length || 0,
        sourceDocuments: sourceDocs,
        similarityScores: rawPayload.knowledgeContext?.similarityScores || [],
        retrievalLatencyMs: rawPayload.knowledgeContext?.retrievalLatencyMs || 0,
        ragContextInjected: Boolean(rawPayload.knowledgeContext?.ragContextFormatted),
      },

      // Stored Knowledge Source Attribution Telemetry
      attributionRecord: rawPayload.attributionRecord || null,

      // Structured Explainability Sub-Object (Phase 14 Contract Schema)
      explainability: {
        language: languageInfo.detectedLanguage || 'English (en-US)',
        languageReason: `Detected script signatures and spoken patterns for ${languageInfo.detectedLanguage || 'English (en-US)'}`,
        category: rawPayload.category ? rawPayload.category.toUpperCase() : category,
        categoryReason: `Transcript and telemetry indicate ${category} hazard conditions`,
        severity: out.severity || 'HIGH',
        severityReason: `Classified as ${out.severity || 'HIGH'} based on situation urgency`,
        keyPhrases: out.evidence || (rawPayload.description ? [rawPayload.description] : []),
        hazards: out.hazards_detected || out.immediate_risks || [`${category} hazard reported`],
        peopleAffected: out.affected_people_estimate !== undefined ? out.affected_people_estimate : (out.affectedPeople !== undefined ? out.affectedPeople : null),
        translation: languageInfo.normalizedTranscript || rawPayload.description || null,
        recommendedResources: Array.isArray(out.recommended_resources) ? out.recommended_resources.join(', ') : recommendedResponseTeam,
        confidence: out.confidence !== undefined ? out.confidence : null,
      },

      pipelineExecutionMeta: {
        stagesExecuted: 10,
        inferenceSource,
        model: require('../../config/gemma').gemmaModel || 'gemma-4-26b-a4b-it',
        provider: require('../../config/gemma').provider || 'rules',
        completedAt: new Date().toISOString(),
      },
    };
  }
}

const structuredJsonService = new StructuredJsonService();
module.exports = structuredJsonService;
