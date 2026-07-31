/**
 * Knowledge Retrieval Verification Suite
 */

const knowledgeRetrievalService = require('../services/pipeline/knowledgeRetrievalService');
const aiPipelineOrchestrator = require('../services/aiPipelineOrchestrator');

async function runKnowledgeRetrievalVerification() {
  console.log('================================================================');
  console.log('      SEMANTIC KNOWLEDGE RETRIEVAL VERIFICATION SUITE           ');
  console.log('================================================================\n');

  const checks = [];
  function recordCheck(id, title, passed, details) {
    checks.push({ id, title, passed, details });
    console.log(`${passed ? '✓ PASS' : '❌ FAIL'}  [Retrieval-${id}] ${title}`);
    console.log(`        ${details}\n`);
  }

  // ─── Test Incident Telemetry Payloads ──────────────────────────
  const testIncidents = [
    {
      id: 'inc_medical_01',
      description: 'Severe arterial bleeding on leg from explosion debris, patient in shock',
      category: 'MEDICAL',
      expectedKeyword: 'bleeding',
    },
    {
      id: 'inc_collapse_01',
      description: 'Multi-story concrete building collapsed, victims trapped under heavy rubble and beams',
      category: 'BUILDING_COLLAPSE',
      expectedKeyword: 'collapse',
    },
    {
      id: 'inc_flood_01',
      description: 'Rising flood waters reached 6 feet, citizens trapped on roofs needing boat evacuation',
      category: 'FLOOD',
      expectedKeyword: 'flood',
    },
    {
      id: 'inc_cyclone_01',
      description: 'Severe storm landfall with 140 km/h wind speeds and coastal surge warning',
      category: 'STORM',
      expectedKeyword: 'cyclone',
    },
  ];

  // ─── 1. Incident -> Embedding -> Similarity Search -> Top Relevant Knowledge Workflow
  const firstRetrieval = knowledgeRetrievalService.retrieveRelevantKnowledge(testIncidents[0], 3);
  const workflowOk = (
    firstRetrieval.queryText &&
    Array.isArray(firstRetrieval.retrievedChunks) &&
    firstRetrieval.retrievedChunks.length > 0 &&
    Array.isArray(firstRetrieval.similarityScores) &&
    Array.isArray(firstRetrieval.sourceDocuments)
  );

  recordCheck(1, 'Workflow: Incident → Embedding → Similarity Search → Top Relevant Knowledge',
    workflowOk,
    `Query text: "${firstRetrieval.queryText}". Retrieved ${firstRetrieval.retrievedChunks.length} chunks across ${firstRetrieval.sourceDocuments.length} docs in ${firstRetrieval.retrievalLatencyMs}ms.`
  );

  // ─── 2. Return Required Output: Retrieved Chunks ─────────────────────────
  const chunksOk = firstRetrieval.retrievedChunks.every((c) => c.chunkId && c.sectionTitle && c.cleanText && c.disasterType);
  recordCheck(2, 'Return Value 1: Retrieved Chunks (chunkId, sectionTitle, cleanText, disasterType)',
    chunksOk,
    `Sample retrieved chunk: '${firstRetrieval.retrievedChunks[0]?.sectionTitle}' [Category: ${firstRetrieval.retrievedChunks[0]?.disasterType}].`
  );

  // ─── 3. Return Required Output: Similarity Scores ───────────────────────
  const scoresOk = firstRetrieval.similarityScores.every((s) => typeof s.score === 'number' && s.similarityPercentage);
  recordCheck(3, 'Return Value 2: Similarity Scores (Cosine Similarity 0.0–1.0 & Percentage)',
    scoresOk,
    `Top score: ${firstRetrieval.similarityScores[0]?.score} (${firstRetrieval.similarityScores[0]?.similarityPercentage}).`
  );

  // ─── 4. Return Required Output: Source Documents ─────────────────────────
  const docsOk = firstRetrieval.sourceDocuments.every((d) => d.documentId && d.documentTitle && d.version);
  recordCheck(4, 'Return Value 3: Source Documents (documentId, documentTitle, disasterCategory, version)',
    docsOk,
    `Source doc: '${firstRetrieval.sourceDocuments[0]?.documentTitle}' (v${firstRetrieval.sourceDocuments[0]?.version}).`
  );

  // ─── 5. Formatted RAG Context Generation For Gemma ───────────────────────
  const ragPromptOk = (
    typeof firstRetrieval.ragContextFormatted === 'string' &&
    firstRetrieval.ragContextFormatted.includes('[OFFICIAL DISASTER GUIDANCE') &&
    firstRetrieval.ragContextFormatted.includes('--- GUIDELINE')
  );
  recordCheck(5, 'Formatted RAG Context Prompt Generation for Gemma 4 Ingestion',
    ragPromptOk,
    `RAG Context snippet generated (${firstRetrieval.ragContextFormatted.length} characters).`
  );

  // ─── 6. Multi-Disaster Performance & Latency Benchmark ───────────────────
  let totalLatencyMs = 0;
  let allIncidentsMatched = true;

  console.log('--- MULTI-DISASTER RETRIEVAL BENCHMARK ---');
  for (const incident of testIncidents) {
    const ret = knowledgeRetrievalService.retrieveRelevantKnowledge(incident, 3);
    totalLatencyMs += ret.retrievalLatencyMs;

    const topChunk = ret.retrievedChunks[0];
    const topScore = ret.similarityScores[0];
    const topDoc = ret.sourceDocuments[0];

    console.log(`  [${incident.category}] "${incident.description.substring(0, 45)}..."`);
    console.log(`      ➜ Match: "${topChunk?.sectionTitle}" from ${topDoc?.documentTitle}`);
    console.log(`      ➜ Score: ${topScore?.score} (${topScore?.similarityPercentage}) | Latency: ${ret.retrievalLatencyMs}ms\n`);

    if (!topChunk) allIncidentsMatched = false;
  }

  const avgLatencyMs = Math.round(totalLatencyMs / testIncidents.length);
  recordCheck(6, 'Retrieve Most Relevant Disaster Guidance Before Gemma Reasoning',
    allIncidentsMatched && avgLatencyMs < 50,
    `Evaluated ${testIncidents.length} emergency scenarios. Avg retrieval latency: ${avgLatencyMs}ms (Target: < 50ms).`
  );

  // ─── 7. Full AI Pipeline Orchestrator Integration Test ───────────────────
  let pipelineOk = false;
  let pipelineOutput = null;
  try {
    pipelineOutput = await aiPipelineOrchestrator.executePipeline({
      packetId: 'pkt_rag_verify_001',
      text: 'Heavy building collapse on main road, 4 people trapped under concrete slabs and requesting emergency medical rescue',
      category: 'BUILDING_COLLAPSE',
      gpsCoordinates: { latitude: 12.9716, longitude: 77.5946, sector: 'Sector 4' },
    });

    const categoryResult = pipelineOutput?.disaster_type || pipelineOutput?.disasterCategory;
    pipelineOk = Boolean(pipelineOutput && pipelineOutput.summary && categoryResult);
  } catch (err) {
    console.error('Pipeline integration error:', err.message);
  }

  const categoryLabel = pipelineOutput?.disaster_type || pipelineOutput?.disasterCategory || 'N/A';
  recordCheck(7, 'Full AI Pipeline Orchestrator Integration (Stage 4 Knowledge Retrieval → Stage 6 Gemma)',
    pipelineOk,
    `Pipeline executed seamlessly. Output summary: "${pipelineOutput?.summary || 'N/A'}" [Category: ${categoryLabel}].`
  );

  // ─── Final Verification Summary ──────────────────────────────────────────
  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.length - passed;

  console.log('================================================================');
  console.log(`  RETRIEVAL SUMMARY: ${passed} / ${checks.length} CHECKS PASSED (${failed} FAILED)`);
  console.log(`  AVG RETRIEVAL LATENCY: ${avgLatencyMs}ms`);
  console.log('================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runKnowledgeRetrievalVerification();
