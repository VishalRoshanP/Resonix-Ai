/**
 * Pinecone Vector Database Configuration for RESONIX AI
 * 
 * Supports Pinecone Serverless and Pod-based indexes for semantic disaster knowledge retrieval.
 * 
 * Note: Pinecone is strictly for semantic vector retrieval and RAG context matching.
 * MongoDB remains the primary transactional application database.
 */

const pineconeConfig = {
  apiKey: process.env.PINECONE_API_KEY || '',
  environment: process.env.PINECONE_ENVIRONMENT || 'us-east-1',
  indexName: process.env.PINECONE_INDEX_NAME || 'resonix-disaster-knowledge',
  host: (process.env.PINECONE_HOST || '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, ''),
  dimension: parseInt(process.env.PINECONE_DIMENSION, 10) || 384,
  metric: process.env.PINECONE_METRIC || 'cosine',
  relevanceThreshold: parseFloat(process.env.PINECONE_RELEVANCE_THRESHOLD) || 0.35,
  incidentSimilarityThreshold: parseFloat(process.env.INCIDENT_SIMILARITY_THRESHOLD) || 0.50,
  topK: parseInt(process.env.PINECONE_TOP_K, 10) || 3,
  embeddingModel: process.env.PINECONE_EMBEDDING_MODEL || 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2',
  isConfigured: Boolean(process.env.PINECONE_API_KEY && process.env.PINECONE_API_KEY.trim().length > 0),
};

module.exports = pineconeConfig;
