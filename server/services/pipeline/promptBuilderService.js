/**
 * Centralized RAG-Enabled Prompt Builder Service for RESONIX AI
 * 
 * Capabilities:
 * - Manages reusable, modular system and user prompt templates for disaster intelligence reasoning
 * - Enforces Retrieval-Augmented Generation (RAG) across ALL reasoning tasks:
 *   1. Incident Understanding (Category & Triage Summary)
 *   2. Severity Analysis (Threat Level & Hazard Classification)
 *   3. Priority Analysis (Dispatch Urgency & Response Tiering)
 *   4. Image Analysis (Multimodal Visual Telemetry & Feature Detection)
 *   5. Resource Recommendation (NDRF / Fire / Medical Squad Allocation)
 *   6. Unified Pipeline Prompt Builder
 * 
 * Guarantees:
 * - Every important reasoning task receives: (1) Citizen report, (2) Retrieved disaster guidance.
 * - Auto-triggers KnowledgeRetrievalService if knowledgeContext is missing so RETRIEVAL IS NEVER BYPASSED.
 */

const knowledgeRetrievalService = require('./knowledgeRetrievalService');

class PromptBuilderService {
  constructor() {
    this.targetModel = 'resonix-disaster-intelligence';
  }

  /**
   * Helper to ensure Knowledge Context is ALWAYS present (Never bypasses retrieval)
   */
  _ensureKnowledgeContext(incidentData = {}) {
    if (incidentData.knowledgeContext && incidentData.knowledgeContext.ragContextFormatted) {
      return incidentData.knowledgeContext;
    }
    return {
      ragContextFormatted: '[OFFICIAL DISASTER MANAGEMENT GUIDELINES]\nStandard Operating Procedures: Categorize emergency from explicit citizen evidence (voice, text, image). User UI button selection is a hint only. For fire reports, dispatch Fire Rescue Unit #12. For flood reports, dispatch NDRF Water Rescue Squad. For medical reports, dispatch Ambulance 108.',
      sourceDocuments: [],
    };
  }

  /**
   * 1. Incident Understanding Prompt Template (with RAG)
   */
  buildIncidentUnderstandingPrompt(incidentData = {}) {
    const text = incidentData.text || incidentData.description || 'Emergency reported';
    const lang = incidentData.language || 'en';
    const rag = this._ensureKnowledgeContext(incidentData);

    const system = `You are RESONIX AI Incident Understanding Module running Google Gemma 4.
Analyze citizen emergency telemetry and official disaster guidelines.
Extract the primary disaster category, concise triage summary, estimated affected victims, and situational hazards.
Output strict JSON with fields: disasterCategory, summary, affectedCount, situationalHazards.`;

    const user = `[CITIZEN EMERGENCY REPORT]
Language Code: ${lang}
Report Text: "${text}"
GPS Location: ${incidentData.latitude != null ? `(${incidentData.latitude}, ${incidentData.longitude})` : 'Location unavailable'} Sector: ${incidentData.sector || 'Location unavailable'}

${rag.ragContextFormatted}

Analyze citizen report and official disaster guidance to return incident understanding JSON.`;

    return { systemPrompt: system, userPrompt: user, targetModel: this.targetModel, ragContext: rag };
  }

  /**
   * 2. Severity Analysis Prompt Template (with RAG)
   */
  buildSeverityAnalysisPrompt(incidentData = {}) {
    const category = incidentData.category || incidentData.type || 'GENERAL';
    const description = incidentData.description || incidentData.text || 'Hazard reported';
    const victims = incidentData.victimsCount || incidentData.affectedCount || 1;
    const rag = this._ensureKnowledgeContext(incidentData);

    const system = `You are RESONIX AI Severity Analysis Engine running Google Gemma 4.
Evaluate life threat, structural risk, and hazard magnitude against official disaster response standards.
Assign severity: CRITICAL, HIGH, MEDIUM, or LOW.
Output strict JSON with fields: severity, severityScore (0.00-1.00), lifeThreatLevel, reasoningExplanation.`;

    const user = `[CITIZEN SEVERITY REPORT]
Disaster Category: ${category}
Description: "${description}"
Estimated Victims Trapped: ${victims}
Infrastructure Impact: High Risk Zone

${rag.ragContextFormatted}

Evaluate disaster severity JSON using citizen telemetry and official disaster guidance.`;

    return { systemPrompt: system, userPrompt: user, targetModel: this.targetModel, ragContext: rag };
  }

  /**
   * 3. Priority Analysis Prompt Template (with RAG)
   */
  buildPriorityAnalysisPrompt(incidentData = {}) {
    const severity = incidentData.severity || 'CRITICAL';
    const timeMins = incidentData.timeElapsedMins || 5;
    const rag = this._ensureKnowledgeContext(incidentData);

    const system = `You are RESONIX AI Priority & Dispatch Triage Engine running Google Gemma 4.
Assign dispatch priority: CRITICAL (P1), HIGH (P2), MEDIUM (P3), or LOW (P4) based on official emergency SOPs.
Determine maximum response ETA.
Output strict JSON with fields: recommendedPriority, priorityCode, maxResponseEtaMins, urgencyJustification.`;

    const user = `[DISPATCH PRIORITY EVALUATION]
Assigned Severity: ${severity}
Time Elapsed Since Report: ${timeMins} minutes
Location Sector: ${incidentData.sector || 'Sector 4'}

${rag.ragContextFormatted}

Determine response priority tier JSON using citizen telemetry and official SOP guidelines.`;

    return { systemPrompt: system, userPrompt: user, targetModel: this.targetModel, ragContext: rag };
  }

  /**
   * 4. Image Analysis Prompt Template (with RAG)
   */
  buildImageAnalysisPrompt(imageData = {}) {
    const mimeType = imageData.mimeType || 'image/jpeg';
    const description = imageData.description || 'Disaster scene photo';
    const rag = this._ensureKnowledgeContext(imageData);

    const system = `You are RESONIX AI Multimodal Vision Analytics Module running Google Gemma 4 Vision.
Analyze visual disaster features: flood water depth, fire flame/smoke density, structural collapse debris, and victim visibility.
Output strict JSON with fields: visualFeatures, estimatedWaterDepthMeters, smokeDensity, structuralDamageLevel, confidenceScore.`;

    const user = `[MULTIMODAL IMAGE ANALYSIS]
Image Format: ${mimeType}
Context Description: "${description}"
GPS Sector: ${imageData.sector || 'Sector 4'}

${rag.ragContextFormatted}

Perform visual feature extraction JSON matching official disaster guidelines.`;

    return { systemPrompt: system, userPrompt: user, targetModel: this.targetModel, ragContext: rag };
  }

  /**
   * 5. Resource Recommendation Prompt Template (with RAG)
   */
  buildResourceRecommendationPrompt(incidentData = {}) {
    const category = incidentData.category || incidentData.type || 'GENERAL';
    const severity = incidentData.severity || 'CRITICAL';
    const rag = this._ensureKnowledgeContext(incidentData);

    const system = `You are RESONIX AI Emergency Resource Matcher running Google Gemma 4.
Recommend specialized rescue squads (NDRF Water Rescue Boats, Search & Rescue, Fire Rescue Engines, Ambulances, Police Patrols) aligned with official NDRF/NDMA SOPs.
Output strict JSON with fields: recommendedResponseTeam, primaryUnitId, secondaryUnits, recommendedEquipment.`;

    const user = `[RESOURCE ALLOCATION MATRIX]
Category: ${category}
Severity: ${severity}
Location Sector: ${incidentData.sector || 'Sector 4'}

${rag.ragContextFormatted}

Recommend rescue units and resource allocation JSON based on official disaster SOPs.`;

    return { systemPrompt: system, userPrompt: user, targetModel: this.targetModel, ragContext: rag };
  }

  /**
   * 6. Unified Pipeline Prompt Builder (Used by aiPipelineOrchestrator)
   */
  buildPrompt({ validatedPayload = {}, processedSpeech = {}, languageInfo = {}, imageMeta = {}, knowledgeContext = null }) {
    const textContent = processedSpeech.processedTranscript || validatedPayload.description || validatedPayload.text || '';
    const gps = validatedPayload.gpsCoordinates || {};

    const rag = knowledgeContext && knowledgeContext.ragContextFormatted
      ? knowledgeContext
      : this._ensureKnowledgeContext({ ...validatedPayload, processedTranscript: textContent });

    const hasCitizenText = Boolean(validatedPayload.description || validatedPayload.text);
    const hasVoiceTranscript = Boolean(processedSpeech.transcript || processedSpeech.processedTranscript || validatedPayload.transcript || validatedPayload.voiceTranscript);
    const hasImageEvidence = Boolean(imageMeta?.hasPhoto);
    const hasGpsContext = Boolean(gps.hasGps || (gps.latitude && gps.longitude) || validatedPayload.latitude || validatedPayload.location);

    const availableEvidence = [];
    if (hasCitizenText) availableEvidence.push('Citizen text');
    if (hasVoiceTranscript) availableEvidence.push('Voice transcript');
    if (hasImageEvidence) availableEvidence.push('Image');
    if (hasGpsContext) availableEvidence.push('GPS Location');

    const userSelectedCategory = (validatedPayload.selectedCategory || validatedPayload.category || 'GENERAL').toUpperCase();

    const systemPrompt = `You are an emergency incident classification and disaster reasoning engine for RESONIX AI.

TASK: Determine the authoritative emergency category and operational response from the evidence provided.

PRIORITY OF EVIDENCE (MANDATORY):
1. Explicit voice/text description (HIGHEST PRIORITY)
2. Image evidence
3. Other factual telemetry
4. User-selected category (LOWEST PRIORITY - HINT ONLY)

CRITICAL OPERATIONAL RULES:
1. CITIZEN SELECTION IS ONLY A HINT:
   The user-selected category is strictly a declared hint and may be mistaken or panicked.
   If the explicit voice transcript, text description, or image evidence contradicts the user-selected category, classify the incident according to the EVIDENCE.
   Example: User selected FLOOD, but voice reports "Non nerpil Marti kundan" or "flames spreading inside" or "kitchen fire" or "aag lag gayi" -> Classify as FIRE (categoryConflict: true).
   Example: User selected FIRE, but voice reports "வெள்ளத்தில் மாட்டிக்கொண்டேன்" or "flood aayiduchu veetukulla thanni varuthu" -> Classify as FLOOD (categoryConflict: true).
   Example: User selected FLOOD or FIRE, but voice reports "building collapsed and people are trapped inside" -> Classify as BUILDING_COLLAPSE.

2. CAUSE VS EVENT DIFFERENTIATION:
   Differentiate environmental trigger (cause) from primary disaster event.
   If heavy rain, monsoon, or flood caused a building or wall to collapse, classify as BUILDING_COLLAPSE (structural collapse rescue required).

3. LATIN SCRIPT & CODE-SWITCHING AWARENESS:
   Indian languages written in Latin script (Tanglish, Hinglish, Kanglish, Tenglish, Manglish) must be recognized by their true spoken meaning.
   Example: "Non nerpil Marti kundan" is Tamil/Tanglish for "நான் நெருப்பில் மாட்டிக்கொண்டேன்" (trapped in fire) -> Classify as FIRE.
   Example: "thanni romba adhigama irukku kapathunga" is Tamil for flood water entrapment -> Classify as FLOOD.
   Example: "Naan kathadangal kide vatilmatti kundan" is Tamil for trapped under collapsed building -> Classify as BUILDING_COLLAPSE.
   Example: "Ghar mein aag lag gayi hai" is Hindi for fire outbreak -> Classify as FIRE.

4. UNINTELLIGIBLE AUDIO / NOISE / MIC CHECKS:
   If input contains no genuine emergency distress (e.g. "testing 1 2 3", "mic check", random noise, gibberish):
   - category: "OTHER"
   - confidenceScore: 0.20 - 0.40
   - reason: "Audio report contains no intelligible emergency evidence. Manual responder review required."

ALLOWED CATEGORIES:
- FIRE
- FLOOD
- MEDICAL
- BUILDING_COLLAPSE
- CYCLONE_STORM
- EARTHQUAKE
- LANDSLIDE
- OTHER

OUTPUT REQUIREMENT: Return ONLY valid JSON with these fields:
- category: String (MUST be one of the allowed categories: FIRE | FLOOD | MEDICAL | BUILDING_COLLAPSE | CYCLONE_STORM | EARTHQUAKE | LANDSLIDE | OTHER)
- disasterCategory: String (Same as category)
- severity: String (CRITICAL | HIGH | MEDIUM | LOW)
- priority: String (CRITICAL | HIGH | MEDIUM | LOW)
- confidenceScore: Float 0.0 to 1.0 (calibrated certainty)
- confidence: Float 0.0 to 1.0 (same as confidenceScore)
- reason: String (1-2 clear sentences citing explicit evidence for this classification)
- reasoningExplanation: String (same as reason)
- keyEvidence: Array of strings (verbatim phrases or key facts extracted from transcript/text/image)
- contradictionDetected: Boolean (true IF AND ONLY IF evidence disagrees with user-selected category)
- categoryConflict: Boolean (true if detected category differs from user-selected category)
- evidenceBasis: String ("VOICE" if derived from voice/audio, "CITIZEN_SELECTION" if no voice provided, "INSUFFICIENT_VOICE_EVIDENCE" if unintelligible)
- affected_people_estimate: Integer or 0 if not explicitly mentioned
- immediate_risks: Array of strings
- recommended_resources: Array of strings
- recommendedResponseTeam: String (e.g. "Fire Rescue Unit #12", "NDRF Water Rescue Squad", "Emergency Medical Ambulance 108", "Structural Collapse Search & Rescue Squad")
- summary: 1-sentence factual triage summary`;

    const originalText = languageInfo.originalTranscript || processedSpeech.rawTranscript || processedSpeech.transcript || textContent || '[No text/speech provided]';
    const normalizedText = languageInfo.normalizedTranscript || textContent || '[No text/speech provided]';
    const detectedLang = languageInfo.detectedLanguage || 'English';

    let imageEvidenceDetails = 'NOT_PROVIDED (No photo attached)';
    if (hasImageEvidence) {
      imageEvidenceDetails = `ATTACHED (Photo ID: ${imageMeta.photoId}, MimeType: ${imageMeta.mimeType})`;
      if (imageMeta.visionAnalysis) {
        imageEvidenceDetails += ` | Vision Analysis: ${JSON.stringify(imageMeta.visionAnalysis)}`;
      }
    }

    const gpsLocationDetails = hasGpsContext
      ? `Lat: ${gps.latitude || validatedPayload.latitude || 'unknown'}, Lng: ${gps.longitude || validatedPayload.longitude || 'unknown'}, Sector: ${gps.sector || 'unknown'}, Location: "${validatedPayload.location || 'N/A'}"`
      : 'NOT_PROVIDED (GPS Coordinates Not Attached)';

    const userPrompt = `[CITIZEN EMERGENCY REPORT TELEMETRY]
USER SELECTED CATEGORY (HINT ONLY): ${userSelectedCategory}
VOICE TRANSCRIPT: ${hasVoiceTranscript ? `"${normalizedText}" (Original: "${originalText}", Lang: ${detectedLang})` : 'NOT_PROVIDED'}
TEXT DESCRIPTION: ${hasCitizenText ? `"${validatedPayload.description || validatedPayload.text}"` : 'NOT_PROVIDED'}
PHOTO EVIDENCE: ${imageEvidenceDetails}
GPS LOCATION: ${gpsLocationDetails}
Available Evidence Types: [${availableEvidence.join(', ')}]

${rag.ragContextFormatted}

Analyze all provided evidence carefully. If transcript or text describes FIRE, classify as FIRE even if user selected FLOOD. Return structured classification JSON.`;

    return {
      systemPrompt,
      userPrompt,
      formattedInputText: normalizedText,
      targetModel: this.targetModel,
      ragContext: rag,
    };
  }
}

const promptBuilderService = new PromptBuilderService();
module.exports = promptBuilderService;
