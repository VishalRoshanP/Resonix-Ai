/**
 * Semantic Incident Similarity Service for RESONIX AI
 * 
 * Purpose:
 * Computes semantic similarity between real citizen emergency incident descriptions,
 * voice transcripts, and AI assessments to serve as a high-fidelity similarity signal
 * for the Multi-Citizen Incident Fusion engine (Laptop A & Laptop B).
 * 
 * Reused Architecture:
 * - Reuses existing Knowledge Embedding Service (384-dimensional dense normalized vectors).
 * - Reuses existing Pinecone configuration & cosine metric standards.
 * - Reuses multilingual domain semantics (English, Hindi, Tamil, Kannada, Telugu, Malayalam).
 * - Configurable threshold via environment variable INCIDENT_SIMILARITY_THRESHOLD or pineconeConfig.
 * 
 * Zero Side-Effects:
 * - Does NOT mutate MongoDB documents or schemas.
 * - Does NOT alter SOS creation or Socket.IO workflows.
 * - Does NOT alter the Responder dashboard UI.
 * - Safe fallback with status "UNAVAILABLE" on service failure without fabricating fake scores.
 */

const knowledgeEmbeddingService = require('./pipeline/knowledgeEmbeddingService');
const pineconeConfig = require('../config/pinecone');
const logger = require('../utils/logger');

class IncidentSimilarityService {
  constructor(config = pineconeConfig) {
    this.config = config;
    this.embeddingService = knowledgeEmbeddingService;
  }

  /**
   * Retrieves the configured similarity threshold
   * Priority: passed option -> pineconeConfig -> default 0.50
   * @param {Object} [options]
   * @returns {number}
   */
  getThreshold(options = {}) {
    if (typeof options.threshold === 'number' && !isNaN(options.threshold)) {
      return options.threshold;
    }
    return typeof this.config.incidentSimilarityThreshold === 'number'
      ? this.config.incidentSimilarityThreshold
      : 0.50;
  }

  /**
   * Extracts primary incident text from raw text, Incident documents, or EmergencyPacket objects
   * @param {string|Object} input
   * @returns {string} Cleaned, extracted text
   */
  extractIncidentText(input) {
    if (!input) return '';

    if (typeof input === 'string') {
      return input.trim();
    }

    if (typeof input === 'object') {
      // 1. Direct transcript / description fields
      const voiceTranscript = (
        input.englishTranslation ||
        input.voiceTranscript ||
        input.originalVoiceTranscript ||
        input.transcript ||
        input.citizenInput?.voiceTranscript ||
        ''
      ).trim();

      const description = (
        input.description ||
        input.text ||
        input.notes ||
        input.citizenInput?.textDescription ||
        input.summary ||
        ''
      ).trim();

      const aiSummary = (
        input.aiAssessment?.reason ||
        input.aiAnalysis?.summary ||
        input.incidentSummary ||
        ''
      ).trim();

      // Combine voice transcript and text description if both exist and are distinct
      if (voiceTranscript && description && !description.toLowerCase().includes(voiceTranscript.toLowerCase())) {
        return `${description}. ${voiceTranscript}`;
      }

      if (voiceTranscript) return voiceTranscript;
      if (description) return description;
      if (aiSummary) return aiSummary;

      // Fallback: title or category if text fields are unavailable
      if (input.title) return input.title.trim();
      if (input.category) return `${input.category} emergency incident`.trim();
    }

    return '';
  }

  /**
   * Calculates semantic cosine similarity between two incident descriptions
   * 
   * @param {string|Object} inputA - Incident A (string text or incident object)
   * @param {string|Object} inputB - Incident B (string text or incident object)
   * @param {Object} [options] - Options { threshold }
   * @returns {Object} { similarityScore, related, threshold, status, ... }
   */
  calculateSimilarity(inputA, inputB, options = {}) {
    const threshold = this.getThreshold(options);
    const textA = this.extractIncidentText(inputA);
    const textB = this.extractIncidentText(inputB);

    // Validate inputs
    if (!textA || !textB) {
      logger.warn('[IncidentSimilarity] Missing or empty text for comparison.');
      return {
        similarityScore: 0.0,
        related: false,
        threshold,
        status: 'INVALID_INPUT',
        reason: 'One or both input incident descriptions contain no extractable text.',
        textA: textA || '',
        textB: textB || '',
      };
    }

    try {
      // 1. Generate 384-dimensional dense semantic vectors using existing embedding service
      const vectorA = this.embeddingService.generateEmbedding(textA);
      const vectorB = this.embeddingService.generateEmbedding(textB);

      if (!Array.isArray(vectorA) || !Array.isArray(vectorB) || vectorA.length === 0 || vectorB.length === 0) {
        throw new Error('Vector generation failed to produce valid dense embeddings.');
      }

      // 2. Compute normalized Cosine Similarity (Dot product of unit vectors)
      const rawScore = this.embeddingService.cosineSimilarity(vectorA, vectorB);
      const clampedScore = Math.max(0.0, Math.min(1.0, rawScore));
      const similarityScore = Number(clampedScore.toFixed(4));

      // 3. Determine relationship against configurable threshold
      const related = similarityScore >= threshold;

      logger.info(`[IncidentSimilarity] Compared incidents (Score: ${similarityScore}, Related: ${related}, Threshold: ${threshold})`);

      return {
        similarityScore,
        related,
        threshold,
        dimension: this.embeddingService.dimension || 384,
        source: 'PINECONE_DENSE_EMBEDDING',
        status: 'SUCCESS',
        textA: textA.length > 120 ? `${textA.substring(0, 120)}...` : textA,
        textB: textB.length > 120 ? `${textB.substring(0, 120)}...` : textB,
      };
    } catch (error) {
      logger.error('[IncidentSimilarity] Failed to calculate semantic similarity:', error.message);
      
      // Strict error handling: Do not fabricate fake numbers if service fails
      return {
        similarityScore: null,
        related: false,
        threshold,
        status: 'UNAVAILABLE',
        error: error.message,
        source: 'NONE',
      };
    }
  }

  /**
   * Helper alias for comparing two incident objects directly
   * @param {Object} incidentA
   * @param {Object} incidentB
   * @param {Object} [options]
   * @returns {Object}
   */
  compareIncidents(incidentA, incidentB, options = {}) {
    return this.calculateSimilarity(incidentA, incidentB, options);
  }

  /**
   * Evaluates an incident against a list of candidate incidents and ranks by semantic similarity
   * @param {string|Object} targetIncident
   * @param {Array<string|Object>} candidates
   * @param {Object} [options]
   * @returns {Array<Object>}
   */
  rankCandidatesBySimilarity(targetIncident, candidates = [], options = {}) {
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return [];
    }

    const results = candidates.map((candidate, index) => {
      const result = this.calculateSimilarity(targetIncident, candidate, options);
      return {
        index,
        candidate,
        ...result,
      };
    });

    // Sort descending by similarityScore
    results.sort((a, b) => (b.similarityScore || 0) - (a.similarityScore || 0));
    return results;
  }
}

const incidentSimilarityService = new IncidentSimilarityService();

module.exports = incidentSimilarityService;
module.exports.IncidentSimilarityService = IncidentSimilarityService;
