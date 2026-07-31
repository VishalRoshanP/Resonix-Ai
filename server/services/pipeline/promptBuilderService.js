/**
 * Centralized RAG-Enabled Prompt Builder Service for RESONIX AI
 * 
 * Capabilities:
 * - Manages reusable, modular system and user prompt templates for Google Gemma 4 (google/gemma-4-e4b-it)
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
    this.targetModel = 'google/gemma-4-e4b-it';
  }

  /**
   * Helper to ensure Knowledge Context is ALWAYS present (Never bypasses retrieval)
   */
  _ensureKnowledgeContext(incidentData = {}) {
    if (incidentData.knowledgeContext && incidentData.knowledgeContext.ragContextFormatted) {
      return incidentData.knowledgeContext;
    }
    // Auto-retrieve if missing so retrieval is never bypassed
    return knowledgeRetrievalService.retrieveRelevantKnowledge(incidentData);
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
GPS Location: (${incidentData.latitude || 12.9716}, ${incidentData.longitude || 77.5946}) Sector: ${incidentData.sector || 'Sector 4'}

${rag.ragContextFormatted}

Analyze citizen report and official disaster guidance to return incident understanding JSON.`;

    return { systemPrompt: system, userPrompt: user, targetModel: this.targetModel, ragContext: rag };
  }

  /**
   * 2. Severity Analysis Prompt Template (with RAG)
   */
  buildSeverityAnalysisPrompt(incidentData = {}) {
    const category = incidentData.category || 'FLOOD';
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
    const category = incidentData.category || 'FLOOD';
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
  buildPrompt({ validatedPayload = {}, processedSpeech = {}, languageInfo = {}, knowledgeContext = null }) {
    const textContent = processedSpeech.processedTranscript || validatedPayload.combinedText || 'Emergency signal reported';
    const category = validatedPayload.category || 'GENERAL';
    const gps = validatedPayload.gpsCoordinates || {};

    const rag = knowledgeContext && knowledgeContext.ragContextFormatted
      ? knowledgeContext
      : this._ensureKnowledgeContext({ ...validatedPayload, processedTranscript: textContent });

    const systemPrompt = `You are RESONIX AI Emergency Triage Intelligence Engine running Google Gemma 4.
Analyze citizen emergency telemetry AND official disaster management guidelines to output a strict JSON object with:
- summary: Short 1-sentence disaster triage summary
- disasterCategory: FLOOD, FIRE, BUILDING_COLLAPSE, MEDICAL, STORM, or SEISMIC
- severity: CRITICAL, HIGH, MEDIUM, or LOW
- recommendedPriority: CRITICAL, HIGH, MEDIUM, or LOW
- confidenceScore: Float value between 0.80 and 0.99
- recommendedResponseTeam: Appropriate NDRF or Fire or Medical unit name
- reasoningExplanation: 1-sentence Explainable AI reasoning explaining why severity and team were chosen according to official guidelines.`;

    const userPrompt = `[EMERGENCY TELEMETRY REPORT]
Text Content: "${textContent}"
Reported Category: ${category}
Language Code: ${languageInfo.detectedLanguage || 'en'}
GPS Coordinates: (${gps.latitude || 12.9716}, ${gps.longitude || 77.5946})
Sector: ${gps.sector || 'Sector 4'}
Photo Attached: ${validatedPayload.photoReference?.hasPhoto ? 'YES' : 'NO'}

${rag.ragContextFormatted}

Generate emergency classification JSON.`;

    return {
      systemPrompt,
      userPrompt,
      formattedInputText: textContent,
      targetModel: this.targetModel,
      ragContext: rag,
    };
  }
}

const promptBuilderService = new PromptBuilderService();
module.exports = promptBuilderService;
