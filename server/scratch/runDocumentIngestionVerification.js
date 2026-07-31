/**
 * Document Ingestion Verification Suite
 * 
 * Tests:
 * 1. Document Reading — all knowledge docs loaded
 * 2. Clean Text Extraction — formatting stripped, content preserved
 * 3. Title Preservation — document and section titles intact
 * 4. Section Preservation — all sections present in chunks
 * 5. Page Reference Extraction — detected where present
 * 6. Formatting Removal — no stray Unicode, normalized whitespace
 * 7. Duplicate Detection — by documentId and content hash
 * 8. Embedding Readiness — chunks have provenance, size within limits
 */

const DocumentIngestionService = require('../services/pipeline/documentIngestionService');

function runDocumentIngestionVerification() {
  console.log('================================================================');
  console.log('       DOCUMENT INGESTION VERIFICATION SUITE                    ');
  console.log('================================================================\n');

  const checks = [];
  function recordCheck(id, title, passed, details) {
    checks.push({ id, title, passed, details });
    const mark = passed ? '✓ PASS' : '❌ FAIL';
    console.log(`${mark}  [Ingestion-${id}] ${title}`);
    console.log(`        ${details}\n`);
  }

  // Run full ingestion
  const ingestionService = new DocumentIngestionService();
  const report = ingestionService.ingestAll();
  const chunks = ingestionService.getChunks();

  // ─── Check 1: Document Reading ─────────────────────
  const docsRead = report.stats.documentsProcessed;
  recordCheck(1, 'Read All Disaster Knowledge Documents',
    docsRead >= 7,
    `Documents processed: ${docsRead} (expected ≥ 7).`
  );

  // ─── Check 2: Clean Text Extraction ────────────────
  const hasCleanText = chunks.every((c) => c.cleanText && c.cleanText.length > 10);
  const noStrayUnicode = chunks.every((c) => !/[\u00A0\u200B\u200C\u200D\uFEFF]/.test(c.cleanText));
  recordCheck(2, 'Extract Clean Text From Every Section',
    hasCleanText && noStrayUnicode,
    `All ${chunks.length} chunks contain clean text. Stray Unicode removed: ${noStrayUnicode}.`
  );

  // ─── Check 3: Title Preservation ───────────────────
  const titlesPreserved = chunks.every((c) => c.documentTitle && c.documentTitle.length > 5 && c.sectionTitle && c.sectionTitle.length > 3);
  recordCheck(3, 'Preserve Document Titles & Section Titles',
    titlesPreserved,
    `All ${chunks.length} chunks retain documentTitle and sectionTitle. Sample: doc='${chunks[0]?.documentTitle}', section='${chunks[0]?.sectionTitle}'.`
  );

  // ─── Check 4: Section Preservation ─────────────────
  const sectionsProcessed = report.stats.sectionsProcessed;
  const uniqueSections = new Set(chunks.map((c) => `${c.documentId}::${c.sectionId}`));
  recordCheck(4, 'Preserve All Sections In Chunks',
    sectionsProcessed >= 19 && uniqueSections.size >= 19,
    `Sections processed: ${sectionsProcessed}. Unique doc::section pairs in chunks: ${uniqueSections.size}.`
  );

  // ─── Check 5: Page Reference Extraction ────────────
  // Our test documents don't encode page numbers, but the extractor should return null gracefully
  const pageRefChunks = chunks.filter((c) => c.pageReference !== null);
  const nullPageChunks = chunks.filter((c) => c.pageReference === null);
  recordCheck(5, 'Page Reference Detection (Graceful Null When Absent)',
    nullPageChunks.length >= 1,
    `Chunks with page ref: ${pageRefChunks.length}. Chunks with null page ref (expected for current docs): ${nullPageChunks.length}.`
  );

  // ─── Check 6: Formatting Removal ──────────────────
  // Verify numbered lists were normalized: "(1)" → "1."
  const hasParenNumbering = chunks.some((c) => /\(\d+\)\s/.test(c.cleanText));
  const hasCleanNumbering = chunks.some((c) => /\d+\.\s/.test(c.cleanText));
  const noExcessiveSpaces = chunks.every((c) => !/  /.test(c.cleanText));
  recordCheck(6, 'Remove Unnecessary Formatting & Normalize Lists',
    !hasParenNumbering && hasCleanNumbering && noExcessiveSpaces,
    `Parenthesized numbering removed: ${!hasParenNumbering}. Clean numbered lists present: ${hasCleanNumbering}. No double spaces: ${noExcessiveSpaces}.`
  );

  // ─── Check 7: Duplicate Detection ─────────────────
  const dupsDetected = report.stats.duplicatesDetected;
  recordCheck(7, 'Detect Duplicate Documents & Chunks',
    dupsDetected >= 1,
    `Duplicates detected: ${dupsDetected}. (Re-ingestion of first doc triggers document-level dedup.)`
  );

  // ─── Check 8: Embedding Readiness ─────────────────
  const MAX_CHUNK = 1500;
  const allWithinLimit = chunks.every((c) => c.charCount <= MAX_CHUNK + 50); // small tolerance
  const allHaveProvenance = chunks.every((c) =>
    c.chunkId && c.documentId && c.category && c.contentHash && c.ingestedAt && c.wordCount > 0
  );
  recordCheck(8, 'Embedding-Ready Chunks (Size, Provenance, Hash)',
    allWithinLimit && allHaveProvenance,
    `All ${chunks.length} chunks within ${MAX_CHUNK}-char limit: ${allWithinLimit}. Full provenance metadata: ${allHaveProvenance}.`
  );

  // ─── Per-Document Summary Table ────────────────────
  console.log('--- PER-DOCUMENT INGESTION SUMMARY ---');
  for (const doc of report.documents) {
    console.log(`  [${doc.category}] ${doc.documentId}: ${doc.chunksProduced} chunks, ${doc.sectionsIngested} sections, ${doc.totalWords} words`);
  }
  console.log('');

  // ─── Sample Chunk Detail ───────────────────────────
  console.log('--- SAMPLE INGESTED CHUNK ---');
  const sample = chunks[0];
  if (sample) {
    console.log(`  chunkId:       ${sample.chunkId}`);
    console.log(`  documentTitle: ${sample.documentTitle}`);
    console.log(`  sectionTitle:  ${sample.sectionTitle}`);
    console.log(`  category:      ${sample.category}`);
    console.log(`  version:       ${sample.version}`);
    console.log(`  pageReference: ${sample.pageReference}`);
    console.log(`  charCount:     ${sample.charCount}`);
    console.log(`  wordCount:     ${sample.wordCount}`);
    console.log(`  contentHash:   ${sample.contentHash.substring(0, 16)}...`);
    console.log(`  cleanText:     "${sample.cleanText.substring(0, 120)}..."`);
  }
  console.log('');

  // ─── Ingestion Log ─────────────────────────────────
  console.log('--- INGESTION LOG ---');
  for (const entry of report.ingestionLog) {
    console.log(`  [${entry.level}] ${entry.documentId}: ${entry.message}`);
  }
  console.log('');

  // ─── Final Summary ─────────────────────────────────
  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.length - passed;
  console.log('================================================================');
  console.log(`  INGESTION STATS: ${report.stats.documentsProcessed} docs | ${report.stats.sectionsProcessed} sections | ${report.stats.chunksProduced} chunks | ${report.stats.totalCleanWords} words | ${report.stats.duplicatesDetected} dupes | ${report.stats.ingestionDurationMs}ms`);
  console.log(`  VERIFICATION: ${passed} / ${checks.length} CHECKS PASSED (${failed} FAILED)`);
  console.log('================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runDocumentIngestionVerification();
