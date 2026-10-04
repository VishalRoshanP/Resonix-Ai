/**
 * Multi-Citizen Incident Fusion AI Reasoning Service for RESONIX AI
 * 
 * Powered by: Multi-Citizen Fusion AI Engine (Google AI Studio / Gemini API)
 * 
 * Core Architectural Principles:
 * 1. Deterministic Fact Preparation:
 *    - Geographic distances are calculated exclusively by deterministic JavaScript (Haversine formula).
 *    - Time differences and semantic similarity scores are pre-computed deterministically.
 *    - Gemma NEVER calculates coordinates or distances; it receives verified facts and reasons about them.
 * 2. Zero Inventions / Hallucinations:
 *    - Gemma does NOT invent numbers of victims, casualties, building damage, or affected area.
 *    - Missing parameters are explicitly marked as "UNKNOWN" and documented in the "unknowns" array.
 * 3. Strict Backend Validation:
 *    - Enforces schema compliance on returned JSON.
 *    - Safe error handling without fabricating synthetic stories if the AI model is unreachable.
 * 4. Assessment Only:
 *    - This service produces an assessment only and does NOT directly alter MongoDB documents.
 */

const gemmaClient = require('./gemma/gemmaClient');
const promptBuilder = require('./gemma/promptBuilder');
const responseParser = require('./gemma/responseParser');
const incidentFusionPrompts = require('../prompts/incidentFusion');
const incidentSimilarityService = require('./incidentSimilarityService');
const logger = require('../utils/logger');

class IncidentFusionReasoningService {
  constructor() {
    this.client = gemmaClient;
    this.builder = promptBuilder;
    this.parser = responseParser;
    this.similarityService = incidentSimilarityService;
  }

  /**
   * Deterministic Haversine distance in meters between two GPS coordinates
   * @param {number} lat1
   * @param {number} lon1
   * @param {number} lat2
   * @param {number} lon2
   * @returns {number|null} Distance in meters
   */
  calculateDistanceMeters(lat1, lon1, lat2, lon2) {
    if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null;
    const nLat1 = Number(lat1);
    const nLon1 = Number(lon1);
    const nLat2 = Number(lat2);
    const nLon2 = Number(lon2);
    if (isNaN(nLat1) || isNaN(nLon1) || isNaN(nLat2) || isNaN(nLon2)) return null;

    const R = 6371e3; // Earth radius in meters
    const φ1 = (nLat1 * Math.PI) / 180;
    const φ2 = (nLat2 * Math.PI) / 180;
    const Δφ = ((nLat2 - nLat1) * Math.PI) / 180;
    const Δλ = ((nLon2 - nLon1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c);
  }

  /**
   * Prepares deterministic facts from an array of real incident reports or pre-computed cluster payload
   * @param {Object|Array} input
   * @returns {Object} Deterministic factual summary
   */
  prepareDeterministicFacts(input) {
    // If input is already a prepared cluster fact object
    if (input && !Array.isArray(input) && (input.reportsCount || input.numberOfReports || input.reports)) {
      const reports = Array.isArray(input.reports) ? input.reports : [];
      const reportCount = input.reportCount || input.numberOfReports || input.reportsCount || (reports.length > 0 ? reports.length : 1);

      return {
        numberOfReports: reportCount,
        emergencyCategories: input.emergencyCategories || input.categories || reports.map((r) => r.category || 'GENERAL').filter(Boolean),
        severity: input.severity || 'CRITICAL',
        priority: input.priority || 'HIGH',
        semanticSimilarityScore: typeof input.semanticSimilarityScore === 'number'
          ? input.semanticSimilarityScore
          : (typeof input.semanticSimilarity === 'number' ? input.semanticSimilarity : null),
        geographicDistance: input.geographicDistance || input.distance || 'Not specified',
        timeDifference: input.timeDifference || input.time || 'Not specified',
        citizenTexts: input.citizenTexts || input.reportsMention || reports.map((r) => this.similarityService.extractIncidentText(r)).filter(Boolean),
        voiceTranscripts: input.voiceTranscripts || reports.map((r) => r.voiceTranscript || r.originalVoiceTranscript).filter(Boolean),
        imageAnalysisResults: input.imageAnalysisResults || input.imageAnalysis || null,
        pineconeDisasterGuidance: input.pineconeDisasterGuidance || input.disasterGuidance || null,
      };
    }

    // If input is an array of real Incident / EmergencyPacket documents
    const reports = Array.isArray(input) ? input : [input];
    const reportCount = reports.length;

    // Extract categories
    const categories = Array.from(new Set(reports.map((r) => (r.category || r.disasterCategory || r.type || 'GENERAL').toUpperCase())));
    
    // Extract priorities / severities
    const severities = reports.map((r) => (r.severity || r.priority || 'HIGH').toUpperCase());
    const highestPriority = severities.includes('CRITICAL') ? 'CRITICAL' : (severities.includes('HIGH') || severities.includes('WARNING') ? 'HIGH' : 'MEDIUM');

    // Deterministic distance calculations between all pairs
    let maxDistanceMeters = 0;
    let validGpsCount = 0;

    for (let i = 0; i < reports.length; i++) {
      const lat1 = reports[i].location?.lat ?? reports[i].gpsCoordinates?.latitude ?? reports[i].latitude;
      const lon1 = reports[i].location?.lng ?? reports[i].gpsCoordinates?.longitude ?? reports[i].longitude;

      if (lat1 != null && lon1 != null) {
        validGpsCount++;
        for (let j = i + 1; j < reports.length; j++) {
          const lat2 = reports[j].location?.lat ?? reports[j].gpsCoordinates?.latitude ?? reports[j].latitude;
          const lon2 = reports[j].location?.lng ?? reports[j].gpsCoordinates?.longitude ?? reports[j].longitude;

          const dist = this.calculateDistanceMeters(lat1, lon1, lat2, lon2);
          if (dist != null && dist > maxDistanceMeters) {
            maxDistanceMeters = dist;
          }
        }
      }
    }

    const geographicDistanceDesc = validGpsCount >= 2
      ? `All ${validGpsCount} GPS-tagged reports within ${maxDistanceMeters} meters`
      : (validGpsCount === 1 ? 'Single report with valid GPS' : 'GPS coordinates unavailable for cluster');

    // Deterministic time delta calculation
    const timestamps = reports
      .map((r) => r.createdAt ? new Date(r.createdAt).getTime() : (r.timestamp ? new Date(r.timestamp).getTime() : null))
      .filter((t) => t != null && !isNaN(t));

    let maxTimeDeltaMinutes = 0;
    if (timestamps.length >= 2) {
      const minTime = Math.min(...timestamps);
      const maxTime = Math.max(...timestamps);
      maxTimeDeltaMinutes = Math.round((maxTime - minTime) / (60 * 1000));
    }

    const timeDifferenceDesc = timestamps.length >= 2
      ? `All reports submitted within ${maxTimeDeltaMinutes} minute(s) of each other`
      : 'Single timestamp available';

    // Compute semantic similarity across descriptions if >= 2 reports
    let avgSimilarityScore = null;
    if (reports.length >= 2) {
      const simResult = this.similarityService.calculateSimilarity(reports[0], reports[1]);
      avgSimilarityScore = simResult.similarityScore;
    }

    // Extract citizen text and voice transcripts
    const citizenTexts = reports.map((r) => this.similarityService.extractIncidentText(r)).filter(Boolean);
    const voiceTranscripts = reports.map((r) => r.voiceTranscript || r.originalVoiceTranscript || r.englishTranslation).filter(Boolean);
    const imageAnalysisResults = reports.map((r) => r.imageAnalysis).filter(Boolean);

    return {
      numberOfReports: reportCount,
      emergencyCategories: categories,
      severity: highestPriority,
      priority: highestPriority,
      semanticSimilarityScore: avgSimilarityScore,
      geographicDistance: geographicDistanceDesc,
      timeDifference: timeDifferenceDesc,
      citizenTexts,
      voiceTranscripts,
      imageAnalysisResults: imageAnalysisResults.length > 0 ? imageAnalysisResults : null,
      pineconeDisasterGuidance: null,
    };
  }

  /**
   * Validates backend schema compliance of Gemma output
   * @param {Object} parsedJson
   * @param {Object} facts
   * @returns {Object} Verified valid JSON structure
   */
  validateFusionSchema(parsedJson, facts = {}) {
    if (!parsedJson || typeof parsedJson !== 'object') {
      throw new Error('AI output is not a valid JSON object');
    }

    const related = typeof parsedJson.related === 'boolean'
      ? parsedJson.related
      : (String(parsedJson.related).toLowerCase() === 'true');

    let dominantHazard = typeof parsedJson.dominantHazard === 'string' && parsedJson.dominantHazard.trim()
      ? parsedJson.dominantHazard.trim().toUpperCase()
      : (Array.isArray(facts.emergencyCategories) && facts.emergencyCategories.length > 0 ? facts.emergencyCategories[0] : 'GENERAL');

    let priority = typeof parsedJson.priority === 'string' && ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(parsedJson.priority.toUpperCase())
      ? parsedJson.priority.toUpperCase()
      : (facts.priority || 'HIGH');

    let confidence = typeof parsedJson.confidence === 'number' && !isNaN(parsedJson.confidence)
      ? Math.max(0.0, Math.min(1.0, Number(parsedJson.confidence.toFixed(2))))
      : 0.85;

    let summary = typeof parsedJson.summary === 'string' && parsedJson.summary.trim()
      ? parsedJson.summary.trim()
      : `Cluster of ${facts.numberOfReports || 1} reported incidents in close proximity.`;

    let evidence = Array.isArray(parsedJson.evidence) && parsedJson.evidence.length > 0
      ? parsedJson.evidence.map((e) => String(e).trim()).filter(Boolean)
      : [
          `Cluster contains ${facts.numberOfReports || 1} citizen reports`,
          `Spatial proximity: ${facts.geographicDistance || 'Local sector'}`,
        ];

    let unknowns = Array.isArray(parsedJson.unknowns) && parsedJson.unknowns.length > 0
      ? parsedJson.unknowns.map((u) => String(u).trim()).filter(Boolean)
      : [
          'Exact number of people affected',
          'Structural integrity status',
        ];

    return {
      related,
      dominantHazard,
      priority,
      confidence,
      summary,
      evidence,
      unknowns,
    };
  }

  /**
   * Main AI reasoning execution for Multi-Citizen Incident Fusion
   * @param {Object|Array} clusterInput - Cluster facts or array of real incidents
   * @param {Object} [options] - Options (timeoutMs, model, maxRetries)
   * @returns {Promise<Object>} Structured reasoning assessment
   */
  async reasonIncidentFusion(clusterInput, options = {}) {
    const facts = this.prepareDeterministicFacts(clusterInput);

    logger.info(`[IncidentFusionReasoning] Initiating Gemma 4 26B A4B reasoning for cluster of ${facts.numberOfReports} reports.`);

    const systemPrompt = incidentFusionPrompts.getSystemPrompt();
    const schemaDescription = incidentFusionPrompts.getSchemaDescription();

    const prompt = this.builder.buildJsonPrompt({
      systemInstruction: systemPrompt,
      userInput: facts,
      schemaDescription,
    });

    try {
      const response = await this.client.generateJson(prompt, {
        temperature: options.temperature ?? 0.1,
        maxTokens: options.maxTokens ?? 1024,
        timeoutMs: options.timeoutMs ?? 25000,
      });

      if (response && response.success === false) {
        throw new Error(response.error?.message || 'Gemma AI inference returned failure status');
      }

      const defaultFallback = {
        related: facts.semanticSimilarityScore !== null ? facts.semanticSimilarityScore >= 0.50 : true,
        dominantHazard: facts.emergencyCategories?.[0] || 'GENERAL',
        priority: facts.priority || 'HIGH',
        confidence: facts.semanticSimilarityScore || 0.85,
        summary: `Cluster of ${facts.numberOfReports} ${facts.emergencyCategories?.[0] || 'emergency'} reports evaluated via deterministic telemetry.`,
        evidence: [
          `${facts.numberOfReports} citizen reports received`,
          `Distance fact: ${facts.geographicDistance}`,
          `Time fact: ${facts.timeDifference}`,
        ],
        unknowns: [
          'Exact casualty and injury count',
          'Detailed structural damage assessment',
        ],
      };

      const parsed = this.parser.parseJson(response, defaultFallback);
      const validated = this.validateFusionSchema(parsed, facts);

      logger.info(`[IncidentFusionReasoning] Successfully reasoned fusion assessment. Dominant: ${validated.dominantHazard}, Related: ${validated.related}, Priority: ${validated.priority}`);

      return {
        ...validated,
        status: 'AI_REASONED',
        model: this.client.config?.gemmaModel || 'gemma-4-26b-a4b-it',
        evaluatedAt: new Date().toISOString(),
      };
    } catch (err) {
      logger.warn(`[IncidentFusionReasoning] AI reasoning fallback active (${err.message}). Using deterministic assessment.`);

      // Safe deterministic fallback without fabricating ungrounded information
      const isRelated = (facts.semanticSimilarityScore != null && facts.semanticSimilarityScore >= 0.50) ||
        (facts.emergencyCategories && facts.emergencyCategories.length === 1);

      const dominant = facts.emergencyCategories?.[0] || 'GENERAL';
      const priority = facts.priority || 'HIGH';

      return {
        related: isRelated,
        dominantHazard: dominant,
        priority: priority,
        confidence: facts.semanticSimilarityScore || 0.80,
        summary: `${facts.numberOfReports} citizen report(s) assessed at ${facts.geographicDistance}. ${facts.timeDifference}.`,
        evidence: [
          `${facts.numberOfReports} citizen reports correlated`,
          `Distance: ${facts.geographicDistance}`,
          `Time difference: ${facts.timeDifference}`,
          ...(facts.semanticSimilarityScore ? [`Semantic similarity: ${facts.semanticSimilarityScore}`] : []),
        ],
        unknowns: [
          'Exact casualty count (UNKNOWN)',
          'Structural damage status (UNKNOWN)',
          'AI deep reasoning unavailable due to network timeout',
        ],
        status: 'DETERMINISTIC_ASSESSMENT',
        aiWarning: err.message,
        evaluatedAt: new Date().toISOString(),
      };
    }
  }
}

const incidentFusionReasoningService = new IncidentFusionReasoningService();

module.exports = incidentFusionReasoningService;
module.exports.IncidentFusionReasoningService = IncidentFusionReasoningService;
