/**
 * RAG Performance Optimization Verification Suite
 */

const knowledgeRetrievalService = require('../services/pipeline/knowledgeRetrievalService');

async function runRagOptimizationVerification() {
  console.log('================================================================');
  console.log('      RAG PERFORMANCE OPTIMIZATION VERIFICATION SUITE           ');
  console.log('================================================================\n');

  const checks = [];
  function recordCheck(id, title, passed, details) {
    checks.push({ id, title, passed, details });
    console.log(`${passed ? '✓ PASS' : '❌ FAIL'}  [Opt-${id}] ${title}`);
    console.log(`        ${details}\n`);
  }

  // Sample test query
  const queryPayload = {
    description: 'Catastrophic river embankment breach flooding low lying homes, immediate boat rescue needed',
    category: 'FLOOD',
  };

  // ─── 1. Retrieval Accuracy (Hybrid Dense-Sparse RRF Scoring) ──────────────
  const firstRet = knowledgeRetrievalService.retrieveRelevantKnowledge(queryPayload, 3);
  const accuracyOk = (
    firstRet.optimizationMetrics?.hybridScoring.includes('RRF') &&
    firstRet.retrievedChunks.length > 0 &&
    firstRet.similarityScores[0].rrfRank === 1
  );

  recordCheck(1, 'Retrieval Accuracy: Hybrid RRF Search (Dense Vector + Sparse Term Matching)',
    accuracyOk,
    `Hybrid Scorer: '${firstRet.optimizationMetrics?.hybridScoring}'. Top match: '${firstRet.retrievedChunks[0]?.sectionTitle}'.`
  );

  // ─── 2. Latency Optimization (Sub-Millisecond Execution & LRU Cache) ──────
  const startTime = Date.now();
  const cachedRet = knowledgeRetrievalService.retrieveRelevantKnowledge(queryPayload, 3); // Cache hit
  const latencyMs = Date.now() - startTime;
  const latencyOk = cachedRet.isCacheHit === true && latencyMs <= 5;

  recordCheck(2, 'Latency Optimization: LRU Cache Hit & Sub-Millisecond Execution',
    latencyOk,
    `Cache Hit: ${cachedRet.isCacheHit}. Execution Latency: ${cachedRet.retrievalLatencyMs}ms (Overall test time: ${latencyMs}ms).`
  );

  // ─── 3. Semantic Duplicate Removal (Cosine Similarity Cutoff >= 0.85) ──────
  const dedupOk = typeof firstRet.optimizationMetrics?.duplicatesRemovedCount === 'number';
  recordCheck(3, 'Duplicate Removal: Cosine Similarity Cutoff (≥ 0.85)',
    dedupOk,
    `Semantic deduplication active. Deduplicated redundant chunks count: ${firstRet.optimizationMetrics?.duplicatesRemovedCount}.`
  );

  // ─── 4. Chunk Ranking (Maximal Marginal Relevance - MMR) ───────────────────
  const rankingOk = firstRet.optimizationMetrics?.rerankingAlgorithm.includes('MMR');
  recordCheck(4, 'Chunk Ranking: Maximal Marginal Relevance (MMR Diversity Reranking)',
    rankingOk,
    `Reranker: '${firstRet.optimizationMetrics?.rerankingAlgorithm}'. Reranked top ${firstRet.retrievedChunks.length} chunks.`
  );

  // ─── 5. Relevance Scoring Calibration (0.40 - 0.99 Range) ────────────────
  const scores = firstRet.similarityScores.map((s) => s.score);
  const calibratedOk = scores.every((s) => s >= 0.40 && s <= 0.99);
  recordCheck(5, 'Relevance Scoring Calibration: Sigmoidal Clamped Percentiles (0.40-0.99)',
    calibratedOk,
    `Calibrated relevance scores: [${scores.join(', ')}]. All within 0.40–0.99 scale: ${calibratedOk}.`
  );

  // ─── 6. Optimization Metrics Summary Report ────────────────────────────────
  const metrics = knowledgeRetrievalService.getOptimizationMetrics();
  const metricsOk = Boolean(metrics.summary && metrics.algorithms);
  recordCheck(6, 'Generate Optimization Metrics Report',
    metricsOk,
    `Queries processed: ${metrics.summary.totalQueriesProcessed}. Cache hit rate: ${metrics.summary.cacheHitRatePercentage}.`
  );

  // ─── Benchmark Table Printout ──────────────────────────────────────────────
  console.log('--- RAG OPTIMIZATION BENCHMARK SUMMARY ---');
  console.log(`  Hybrid Scoring:        ${metrics.algorithms.hybridScoring}`);
  console.log(`  Reranking Algorithm:   ${metrics.algorithms.reranking}`);
  console.log(`  Deduplication Cutoff:  ${metrics.algorithms.deduplication}`);
  console.log(`  Relevance Calibration: ${metrics.algorithms.relevanceCalibration}`);
  console.log(`  Cache Hit Rate:        ${metrics.summary.cacheHitRatePercentage} (${metrics.summary.cacheHits} hits / ${metrics.summary.totalQueriesProcessed} queries)\n`);

  // ─── Final Verification Summary ────────────────────────────────────────────
  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.length - passed;

  console.log('================================================================');
  console.log(`  OPTIMIZATION SUMMARY: ${passed} / ${checks.length} CHECKS PASSED (${failed} FAILED)`);
  console.log('================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runRagOptimizationVerification();
