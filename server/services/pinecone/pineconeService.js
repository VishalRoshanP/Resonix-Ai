/**
 * Pinecone Semantic Vector Retrieval Service for RESONIX AI
 * 
 * Provides production-grade semantic vector retrieval for official disaster management guidelines.
 * 
 * Architecture:
 * - Interacts with Pinecone Vector Database via secure HTTPS REST API v2.
 * - Supports Pinecone Serverless and Pod-based indexes (Cosine similarity metric, 384-dimensional).
 * - Enforces strict relevance thresholding (minScore >= 0.35) to prevent passing unrelated context to Gemma 4.
 * - Implements graceful local vector store fallback for 100% offline resilience and testing.
 * - Preserves MongoDB as the primary application database for reports and operational telemetry.
 */

const pineconeConfig = require('../../config/pinecone');
const logger = require('../../utils/logger');

class PineconeService {
  constructor() {
    this.config = pineconeConfig;
    this.localVectorStore = null; // Injected or referenced from knowledgeEmbeddingService
    this.stats = {
      totalQueriesExecuted: 0,
      cloudQueriesExecuted: 0,
      localFallbackQueriesExecuted: 0,
      belowThresholdCount: 0,
      avgQueryLatencyMs: 0,
      lastSyncTimestamp: null,
    };
  }

  /**
   * Sets local vector store reference for fallback and synchronization.
   */
  setLocalVectorStore(vectorStore) {
    this.localVectorStore = vectorStore;
  }

  /**
   * Determines whether Pinecone Cloud credentials are configured.
   */
  isConfigured() {
    return Boolean(this.config.apiKey && this.config.apiKey.trim().length > 0);
  }

  /**
   * Primary Semantic Vector Query Workflow
   * @param {Object} params { vector, topK, filter, minScore }
   * @returns {Promise<Object>} { matches: Array, source: 'PINECONE_CLOUD'|'PINECONE_LOCAL_FALLBACK', latencyMs: number }
   */
  async queryVectors({ vector, topK = this.config.topK, filter = {}, minScore = this.config.relevanceThreshold }) {
    const startTime = Date.now();
    this.stats.totalQueriesExecuted++;

    if (!Array.isArray(vector) || vector.length === 0) {
      logger.warn('[PineconeService] Query vector is empty or invalid.');
      return { matches: [], source: 'NONE', latencyMs: 0, count: 0 };
    }

    // 1. Attempt Pinecone Cloud Query if configured
    if (this.isConfigured()) {
      try {
        const cloudResult = await this._queryPineconeCloud({ vector, topK, filter, minScore });
        if (cloudResult && Array.isArray(cloudResult.matches)) {
          this.stats.cloudQueriesExecuted++;
          const latencyMs = Date.now() - startTime;
          logger.info(`[PineconeService] Pinecone Cloud query returned ${cloudResult.matches.length} matches in ${latencyMs}ms.`);
          return {
            matches: cloudResult.matches,
            source: 'PINECONE_CLOUD',
            latencyMs,
            count: cloudResult.matches.length,
          };
        }
      } catch (err) {
        logger.warn('[PineconeService] Pinecone Cloud query failed, falling back to local vector engine:', err.message);
      }
    }

    // 2. Local Fallback Vector Search (High-Performance 384-Dim Normalized Cosine Index)
    this.stats.localFallbackQueriesExecuted++;
    const localMatches = this._queryLocalVectorStore({ vector, topK, filter, minScore });
    const latencyMs = Date.now() - startTime;

    return {
      matches: localMatches,
      source: this.isConfigured() ? 'PINECONE_LOCAL_FALLBACK' : 'PINECONE_LOCAL_ENGINE',
      latencyMs,
      count: localMatches.length,
    };
  }

  /**
   * Executes REST API query against Pinecone Cloud Index
   */
  async _queryPineconeCloud({ vector, topK, filter, minScore }) {
    const endpoint = this.config.host
      ? `https://${this.config.host}/query`
      : `https://${this.config.indexName}-${this.config.environment}.svc.pinecone.io/query`;

    const requestBody = {
      vector,
      topK: Math.max(topK * 2, 6),
      includeMetadata: true,
      includeValues: false,
    };

    if (filter && Object.keys(filter).length > 0) {
      requestBody.filter = filter;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Api-Key': this.config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Pinecone Cloud HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const rawMatches = Array.isArray(data?.matches) ? data.matches : [];

    // Filter by strict relevance threshold
    const filteredMatches = [];
    for (const match of rawMatches) {
      const score = typeof match.score === 'number' ? match.score : 0;
      if (score >= minScore) {
        filteredMatches.push({
          id: match.id,
          chunkId: match.id,
          score,
          metadata: match.metadata || {},
        });
      } else {
        this.stats.belowThresholdCount++;
      }
    }

    return { matches: filteredMatches.slice(0, topK) };
  }

  /**
   * Local High-Performance Vector Query
   */
  _queryLocalVectorStore({ vector, topK, filter, minScore }) {
    if (!this.localVectorStore) {
      // Lazy load knowledgeEmbeddingService if not yet set
      try {
        this.localVectorStore = require('../pipeline/knowledgeEmbeddingService');
      } catch (err) {
        logger.warn('[PineconeService] Failed to load local vector store:', err.message);
        return [];
      }
    }

    const searchResults = this.localVectorStore.searchByVector(vector, topK * 2, filter);
    const matches = [];

    for (const res of searchResults) {
      if (res.score >= minScore) {
        matches.push({
          id: res.chunkId,
          chunkId: res.chunkId,
          score: res.score,
          metadata: res.metadata,
        });
      } else {
        this.stats.belowThresholdCount++;
      }
    }

    return matches.slice(0, topK);
  }

  /**
   * Upserts knowledge chunks into Pinecone index
   */
  async upsertVectors(vectors = []) {
    if (!Array.isArray(vectors) || vectors.length === 0) return { upsertedCount: 0 };

    if (this.isConfigured()) {
      try {
        const endpoint = this.config.host
          ? `https://${this.config.host}/vectors/upsert`
          : `https://${this.config.indexName}-${this.config.environment}.svc.pinecone.io/vectors/upsert`;

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Api-Key': this.config.apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ vectors }),
        });

        if (response.ok) {
          const resJson = await response.json();
          logger.info(`[PineconeService] Upserted ${vectors.length} vectors to Pinecone Cloud.`);
          this.stats.lastSyncTimestamp = new Date().toISOString();
          return { upsertedCount: resJson.upsertedCount || vectors.length, cloud: true };
        }
      } catch (err) {
        logger.warn('[PineconeService] Cloud upsert failed:', err.message);
      }
    }

    return { upsertedCount: vectors.length, cloud: false };
  }

  /**
   * Returns complete telemetry and observability statistics.
   */
  getStats() {
    return {
      isConfigured: this.isConfigured(),
      indexName: this.config.indexName,
      dimension: this.config.dimension,
      metric: this.config.metric,
      relevanceThreshold: this.config.relevanceThreshold,
      totalQueriesExecuted: this.stats.totalQueriesExecuted,
      cloudQueriesExecuted: this.stats.cloudQueriesExecuted,
      localFallbackQueriesExecuted: this.stats.localFallbackQueriesExecuted,
      belowThresholdCount: this.stats.belowThresholdCount,
      lastSyncTimestamp: this.stats.lastSyncTimestamp,
    };
  }
}

const pineconeService = new PineconeService();
module.exports = pineconeService;
