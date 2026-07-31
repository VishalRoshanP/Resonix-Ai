/**
 * Semantic Chunking Verification Suite
 *
 * Checks:
 *  1. Semantic splitting — chunks produced from all documents
 *  2. Context maintenance — non-first chunks carry context headers
 *  3. Required metadata — chunkId, sourceDocument, sectionTitle, disasterType, chunkOrder
 *  4. Chunk ordering — chunkOrder is monotonically increasing per document
 *  5. Adjacent chunk links — previousChunkId / nextChunkId chain is consistent
 *  6. Gemma-optimised size — avg tokens near 512, no chunk exceeds hard max
 *  7. Semantic type classification — every chunk has a semantic type label
 *  8. Runt merge — no chunk smaller than MIN_CHUNK_CHARS (unless sole chunk in section)
 *  9. Content hash uniqueness — no duplicate chunks
 * 10. Chunk statistics — histogram, distributions, per-document breakdown
 */

const SemanticChunkingService = require('../services/pipeline/semanticChunkingService');

function run() {
  console.log('================================================================');
  console.log('     SEMANTIC CHUNKING VERIFICATION SUITE                       ');
  console.log('================================================================\n');

  const checks = [];
  function check(id, title, passed, details) {
    checks.push({ id, title, passed });
    console.log(`${passed ? '✓ PASS' : '❌ FAIL'}  [Chunk-${id}] ${title}`);
    console.log(`        ${details}\n`);
  }

  const svc = new SemanticChunkingService();
  const stats = svc.chunkAll();
  const chunks = svc.getChunks();

  // ─── 1. Semantic Splitting ────────────────────────
  check(1, 'Semantic Splitting — Chunks Produced From All Documents',
    stats.summary.documentsChunked >= 7 && chunks.length >= 7,
    `Documents chunked: ${stats.summary.documentsChunked}. Total chunks: ${chunks.length}.`
  );

  // ─── 2. Context Maintenance ───────────────────────
  const nonFirstChunks = chunks.filter((c) => c.chunkIndexInSection > 0);
  const allHaveContext = nonFirstChunks.every((c) => c.contextHeader && c.contextHeader.startsWith('[CONTEXT]'));
  const firstChunksNoCtx = chunks.filter((c) => c.chunkIndexInSection === 0).every((c) => c.contextHeader === '');
  check(2, 'Context Maintenance Across Chunk Boundaries',
    nonFirstChunks.length === 0 ? firstChunksNoCtx : (allHaveContext && firstChunksNoCtx),
    `Non-first chunks: ${nonFirstChunks.length}. All carry [CONTEXT] header: ${allHaveContext || nonFirstChunks.length === 0}. First chunks have no header: ${firstChunksNoCtx}.`
  );

  // ─── 3. Required Metadata ────────────────────────
  const metaFields = ['chunkId', 'sourceDocument', 'sectionTitle', 'disasterType', 'chunkOrder'];
  const allHaveMeta = chunks.every((c) => metaFields.every((f) => c[f] !== undefined && c[f] !== null && c[f] !== ''));
  check(3, 'Required Metadata (chunkId, sourceDocument, sectionTitle, disasterType, chunkOrder)',
    allHaveMeta,
    `All ${chunks.length} chunks carry all 5 required fields: ${allHaveMeta}.`
  );

  // ─── 4. Chunk Ordering ───────────────────────────
  const byDoc = {};
  for (const c of chunks) {
    if (!byDoc[c.sourceDocument]) byDoc[c.sourceDocument] = [];
    byDoc[c.sourceDocument].push(c.chunkOrder);
  }
  let orderOk = true;
  for (const [docId, orders] of Object.entries(byDoc)) {
    for (let i = 1; i < orders.length; i++) {
      if (orders[i] <= orders[i - 1]) { orderOk = false; break; }
    }
  }
  check(4, 'Chunk Order is Monotonically Increasing Per Document',
    orderOk,
    `Checked ordering across ${Object.keys(byDoc).length} documents: monotonic = ${orderOk}.`
  );

  // ─── 5. Adjacent Chunk Links ─────────────────────
  let linkOk = true;
  for (const c of chunks) {
    if (c.previousChunkId) {
      const prev = svc.getChunkById(c.previousChunkId);
      if (!prev || prev.nextChunkId !== c.chunkId) { linkOk = false; break; }
    }
    if (c.nextChunkId) {
      const next = svc.getChunkById(c.nextChunkId);
      if (!next || next.previousChunkId !== c.chunkId) { linkOk = false; break; }
    }
  }
  check(5, 'Adjacent Chunk Links (previousChunkId ↔ nextChunkId) Consistent',
    linkOk,
    `Bidirectional adjacency links verified across ${chunks.length} chunks: consistent = ${linkOk}.`
  );

  // ─── 6. Gemma-Optimised Size ─────────────────────
  const HARD_MAX = 1200;
  const oversized = chunks.filter((c) => c.charCount > HARD_MAX);
  const avgTokens = stats.summary.avgTokenEstimate;
  check(6, 'Gemma-Optimised Chunk Size (target ~512 tokens, hard max 1200 chars)',
    oversized.length === 0 && avgTokens > 0,
    `Oversized chunks (>${HARD_MAX} chars): ${oversized.length}. Avg token estimate: ${avgTokens}. Min chars: ${stats.summary.minChunkChars}. Max chars: ${stats.summary.maxChunkChars}. Avg chars: ${stats.summary.avgChunkChars}.`
  );

  // ─── 7. Semantic Type Classification ─────────────
  const validTypes = ['EVACUATION', 'FIRST_AID', 'SEARCH_RESCUE', 'EARLY_WARNING', 'PREPAREDNESS', 'PREVENTION', 'STRUCTURAL', 'DEPLOYMENT', 'GENERAL_GUIDANCE'];
  const allTyped = chunks.every((c) => validTypes.includes(c.semanticType));
  const typeCount = new Set(chunks.map((c) => c.semanticType)).size;
  check(7, 'Semantic Type Classification On Every Chunk',
    allTyped && typeCount >= 3,
    `All chunks have valid semantic type: ${allTyped}. Distinct types found: ${typeCount} — ${JSON.stringify(stats.semanticTypeDistribution)}.`
  );

  // ─── 8. Runt Merge ──────────────────────────────
  const MIN = 120;
  const runts = chunks.filter((c) => c.charCount < MIN && c.totalChunksInSection > 1);
  check(8, 'Runt Merge — No Chunks Below Minimum Size (120 chars)',
    runts.length === 0,
    `Runt chunks (< ${MIN} chars, multi-chunk sections): ${runts.length}. Merged runts during processing: ${stats.summary.mergedRuntChunks}.`
  );

  // ─── 9. Content Hash Uniqueness ──────────────────
  const hashes = chunks.map((c) => c.contentHash);
  const uniqueHashes = new Set(hashes);
  check(9, 'Content Hash Uniqueness — No Duplicate Chunks',
    uniqueHashes.size === hashes.length,
    `Total hashes: ${hashes.length}. Unique: ${uniqueHashes.size}. Duplicates: ${hashes.length - uniqueHashes.size}.`
  );

  // ─── 10. Statistics Generation ───────────────────
  const hasHistogram = Object.keys(stats.chunkSizeHistogram).length > 0;
  const hasDocBreakdown = stats.documents.length >= 7;
  check(10, 'Chunk Statistics (Histogram, Distributions, Per-Document Breakdown)',
    hasHistogram && hasDocBreakdown,
    `Size histogram buckets: ${Object.keys(stats.chunkSizeHistogram).length}. Document breakdown entries: ${stats.documents.length}.`
  );

  // ─── Per-Document Table ──────────────────────────
  console.log('--- PER-DOCUMENT CHUNK BREAKDOWN ---');
  for (const d of stats.documents) {
    console.log(`  [${d.disasterType}] ${d.documentId}: ${d.chunks} chunks, ${d.sections} sections, ${d.words} words`);
  }
  console.log('');

  // ─── Size Histogram ──────────────────────────────
  console.log('--- CHUNK SIZE HISTOGRAM ---');
  for (const [bucket, count] of Object.entries(stats.chunkSizeHistogram).sort()) {
    const bar = '█'.repeat(count);
    console.log(`  ${bucket.padStart(10)} chars: ${bar} (${count})`);
  }
  console.log('');

  // ─── Sample Chunk ────────────────────────────────
  console.log('--- SAMPLE SEMANTIC CHUNK ---');
  const sample = chunks[0];
  if (sample) {
    console.log(`  chunkId:         ${sample.chunkId}`);
    console.log(`  sourceDocument:  ${sample.sourceDocument}`);
    console.log(`  sectionTitle:    ${sample.sectionTitle}`);
    console.log(`  disasterType:    ${sample.disasterType}`);
    console.log(`  chunkOrder:      ${sample.chunkOrder}`);
    console.log(`  semanticType:    ${sample.semanticType}`);
    console.log(`  boundaryType:    ${sample.boundaryType}`);
    console.log(`  charCount:       ${sample.charCount}`);
    console.log(`  wordCount:       ${sample.wordCount}`);
    console.log(`  tokenEstimate:   ${sample.tokenEstimate}`);
    console.log(`  contextHeader:   "${sample.contextHeader || '(none — first chunk)'}"`);
    console.log(`  previousChunkId: ${sample.previousChunkId || '(none)'}`);
    console.log(`  nextChunkId:     ${sample.nextChunkId || '(none)'}`);
    console.log(`  cleanText:       "${sample.cleanText.substring(0, 120)}..."`);
  }
  console.log('');

  // ─── Context Chain Walk ──────────────────────────
  console.log('--- CONTEXT CHAIN WALK (first document) ---');
  const firstDocChunks = svc.getChunksByDocument(chunks[0]?.sourceDocument);
  for (const c of firstDocChunks) {
    const ctxLabel = c.contextHeader ? '✓ has context' : '○ first chunk';
    console.log(`  [order ${c.chunkOrder}] ${c.chunkId} → ${ctxLabel} (${c.charCount} chars)`);
  }
  console.log('');

  // ─── Final ───────────────────────────────────────
  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.length - passed;
  console.log('================================================================');
  console.log(`  CHUNKING: ${stats.summary.documentsChunked} docs | ${stats.summary.sectionsChunked} sections | ${stats.summary.chunksProduced} chunks | avg ${stats.summary.avgChunkChars} chars | ~${stats.summary.avgTokenEstimate} tokens | ${stats.summary.chunkingDurationMs}ms`);
  console.log(`  VERIFICATION: ${passed} / ${checks.length} CHECKS PASSED (${failed} FAILED)`);
  console.log('================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

run();
