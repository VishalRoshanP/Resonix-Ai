/**
 * Semantic Document Chunking Service for RESONIX AI
 *
 * Intelligent chunking that splits documents at semantic boundaries
 * rather than arbitrary character positions.
 *
 * Strategies (applied in priority order):
 *   1. Paragraph boundaries (double newline)
 *   2. Numbered step boundaries (e.g. "3. Deploy…")
 *   3. Topic-shift heuristics (transitional phrases)
 *   4. Sentence boundaries (fallback)
 *
 * Each chunk stores:
 *   chunkId, sourceDocument, sectionTitle, disasterType,
 *   chunkOrder, contextHeader, cleanText, charCount, wordCount,
 *   tokenEstimate, contentHash, semanticType, adjacentChunkIds
 *
 * Gemma Optimisation:
 *   Target window ≈ 512 tokens.  At ~1.3 chars/token for English prose
 *   the target is 600–800 chars per chunk, hard max 1 200 chars.
 *   A 200-char context header is prepended to every non-first chunk
 *   so the model always sees bridging context.
 */

const crypto = require('crypto');
const logger = require('../../utils/logger');
const disasterKnowledgeBaseService = require('./disasterKnowledgeBaseService');

// ── Chunk-size constants (Gemma-optimised) ──────────────────
const TARGET_CHUNK_CHARS  = 800;   // ideal chunk body size
const MAX_CHUNK_CHARS     = 1200;  // hard ceiling before forced split
const MIN_CHUNK_CHARS     = 120;   // chunks below this are merged into neighbour
const CONTEXT_HEADER_CHARS = 200;  // overlap header from previous chunk

// ── Semantic boundary patterns ──────────────────────────────
const NUMBERED_STEP_RE    = /(?:^|\n)\s*\d+\.\s/;                    // "1. …"
const PARAGRAPH_BREAK_RE  = /\n\s*\n/;                                // blank line
const TOPIC_SHIFT_PHRASES = [
  'in addition', 'furthermore', 'however', 'after the',
  'following the', 'during a', 'for severe', 'post-',
  'in case of', 'in the event', 'when the', 'if the',
  'citizens should', 'evacuation procedures', 'medical considerations',
  'search and rescue', 'first aid', 'emergency response',
];

class SemanticChunkingService {
  constructor() {
    this.chunks      = [];
    this.chunkIndex  = new Map();   // chunkId → chunk
    this.hashIndex   = new Map();   // contentHash → chunkId
    this.stats = {
      documentsChunked: 0,
      sectionsChunked:  0,
      chunksProduced:   0,
      mergedRuntChunks: 0,
      avgChunkChars:    0,
      avgChunkWords:    0,
      avgTokenEstimate: 0,
      minChunkChars:    Infinity,
      maxChunkChars:    0,
      totalChars:       0,
      totalWords:       0,
      chunkingDurationMs: 0,
    };
  }

  // ────────────────────────────────────────────────────────────
  // 1.  SEMANTIC SPLITTING
  // ────────────────────────────────────────────────────────────

  /**
   * Classify the dominant semantic type of a text segment.
   * Used to label each chunk for downstream retrieval filtering.
   */
  _classifySemanticType(text) {
    const lower = text.toLowerCase();
    if (/evacuati|shelter|assembly point|relief camp/i.test(lower)) return 'EVACUATION';
    if (/first aid|cpr|bleed|burn|tourniquet|triage/i.test(lower))  return 'FIRST_AID';
    if (/search and rescue|trapped|debris|rescue/i.test(lower))     return 'SEARCH_RESCUE';
    if (/warning|alert|forecast|cyclone warning/i.test(lower))      return 'EARLY_WARNING';
    if (/preparedness|kit|drill|pre-position/i.test(lower))         return 'PREPAREDNESS';
    if (/prevention|safety|inspection|maintenance/i.test(lower))    return 'PREVENTION';
    if (/structural|damage|assessment|retrofit/i.test(lower))       return 'STRUCTURAL';
    if (/deploy|battalion|mobiliz|ndrf|sdrf/i.test(lower))          return 'DEPLOYMENT';
    return 'GENERAL_GUIDANCE';
  }

  /**
   * Split cleaned text into candidate segments at semantic boundaries.
   * Returns an array of { text, boundaryType } objects.
   */
  _splitAtSemanticBoundaries(cleanText) {
    if (!cleanText) return [];

    // Phase 1 — paragraph breaks (highest confidence boundary)
    let rawSegments = cleanText.split(PARAGRAPH_BREAK_RE).filter(Boolean);

    // Phase 2 — if any segment is still too large, split at numbered steps
    const refined = [];
    for (const seg of rawSegments) {
      if (seg.length <= MAX_CHUNK_CHARS) {
        refined.push({ text: seg.trim(), boundaryType: 'paragraph' });
        continue;
      }
      // Split at numbered steps within the segment
      const stepParts = seg.split(/(?=\b\d+\.\s)/).filter(Boolean);
      for (const part of stepParts) {
        refined.push({ text: part.trim(), boundaryType: 'numbered_step' });
      }
    }

    // Phase 3 — if any segment is STILL too large, split at topic-shift phrases
    const final = [];
    for (const seg of refined) {
      if (seg.text.length <= MAX_CHUNK_CHARS) {
        final.push(seg);
        continue;
      }
      const topicSplit = this._splitAtTopicShift(seg.text);
      final.push(...topicSplit);
    }

    // Phase 4 — last resort: split oversized segments at sentence boundaries
    const result = [];
    for (const seg of final) {
      if (seg.text.length <= MAX_CHUNK_CHARS) {
        result.push(seg);
        continue;
      }
      const sentenceSplit = this._splitAtSentences(seg.text);
      result.push(...sentenceSplit);
    }

    return result;
  }

  /**
   * Split text at topic-shift phrases.
   */
  _splitAtTopicShift(text) {
    const segments = [];
    let remaining = text;

    for (const phrase of TOPIC_SHIFT_PHRASES) {
      const idx = remaining.toLowerCase().indexOf(phrase, MIN_CHUNK_CHARS);
      if (idx > 0 && idx < remaining.length - MIN_CHUNK_CHARS) {
        segments.push({ text: remaining.substring(0, idx).trim(), boundaryType: 'topic_shift' });
        remaining = remaining.substring(idx).trim();
      }
    }

    if (remaining.length > 0) {
      segments.push({ text: remaining.trim(), boundaryType: 'topic_shift' });
    }

    return segments.length > 0 ? segments : [{ text, boundaryType: 'topic_shift' }];
  }

  /**
   * Sentence-boundary fallback for oversized segments.
   */
  _splitAtSentences(text) {
    const sentences = text.match(/[^.!?]+[.!?]+(?:\s|$)/g) || [text];
    const segments = [];
    let buffer = '';

    for (const sentence of sentences) {
      if ((buffer + sentence).length > MAX_CHUNK_CHARS && buffer.length > 0) {
        segments.push({ text: buffer.trim(), boundaryType: 'sentence' });
        buffer = sentence;
      } else {
        buffer += sentence;
      }
    }
    if (buffer.trim().length > 0) {
      segments.push({ text: buffer.trim(), boundaryType: 'sentence' });
    }

    return segments;
  }

  // ────────────────────────────────────────────────────────────
  // 2.  RUNT MERGING  (merge tiny chunks into neighbours)
  // ────────────────────────────────────────────────────────────

  /**
   * Merge segments that are smaller than MIN_CHUNK_CHARS into adjacent segments.
   */
  _mergeRuntSegments(segments) {
    if (segments.length <= 1) return segments;

    const merged = [];
    let i = 0;

    while (i < segments.length) {
      const seg = segments[i];
      if (seg.text.length < MIN_CHUNK_CHARS) {
        this.stats.mergedRuntChunks++;
        // Merge into previous or next segment
        if (merged.length > 0) {
          merged[merged.length - 1].text += ' ' + seg.text;
          merged[merged.length - 1].boundaryType = 'merged';
        } else if (i + 1 < segments.length) {
          segments[i + 1].text = seg.text + ' ' + segments[i + 1].text;
          segments[i + 1].boundaryType = 'merged';
        } else {
          merged.push(seg); // lone tiny segment, keep as-is
        }
      } else {
        merged.push(seg);
      }
      i++;
    }

    return merged;
  }

  // ────────────────────────────────────────────────────────────
  // 3.  CONTEXT HEADER (cross-chunk bridging)
  // ────────────────────────────────────────────────────────────

  /**
   * Build a context header from the tail of the previous chunk.
   * This header is prepended so the model always has bridging context.
   */
  _buildContextHeader(previousChunkText) {
    if (!previousChunkText) return '';

    const tail = previousChunkText.slice(-CONTEXT_HEADER_CHARS).trim();

    // Try to start at a sentence boundary within the tail
    const sentenceStart = tail.search(/[.!?]\s+[A-Z]/);
    if (sentenceStart >= 0) {
      return '[CONTEXT] ' + tail.substring(sentenceStart + 2).trim();
    }
    return '[CONTEXT] ...' + tail;
  }

  // ────────────────────────────────────────────────────────────
  // 4.  TOKEN ESTIMATION
  // ────────────────────────────────────────────────────────────

  /**
   * Estimate token count for Gemma.
   * English prose averages ~1.3 chars per BPE token for Gemma-family.
   */
  _estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 1.3);
  }

  // ────────────────────────────────────────────────────────────
  // 5.  CONTENT HASHING & DEDUP
  // ────────────────────────────────────────────────────────────

  _computeHash(text) {
    return crypto.createHash('sha256').update(text, 'utf-8').digest('hex');
  }

  _isDuplicate(hash) {
    return this.hashIndex.has(hash);
  }

  // ────────────────────────────────────────────────────────────
  // 6.  MAIN CHUNKING PIPELINE
  // ────────────────────────────────────────────────────────────

  /**
   * Chunk a single knowledge document into semantic chunks.
   * @param {Object} doc - Document from DisasterKnowledgeBaseService
   * @returns {Object[]} Array of semantic chunks
   */
  _chunkDocument(doc) {
    const docChunks = [];
    if (!doc.sections || !Array.isArray(doc.sections)) return docChunks;

    // Global chunk order counter across all sections of this document
    let docChunkOrder = 0;

    for (const section of doc.sections) {
      this.stats.sectionsChunked++;
      const cleanText = section.content || '';
      if (!cleanText.trim()) continue;

      // Step 1: Split at semantic boundaries
      let segments = this._splitAtSemanticBoundaries(cleanText);

      // Step 2: Merge runt segments
      segments = this._mergeRuntSegments(segments);

      // Step 3: Build chunks with context headers and metadata
      let prevText = null;

      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const contentHash = this._computeHash(seg.text);

        if (this._isDuplicate(contentHash)) continue;

        const contextHeader = prevText ? this._buildContextHeader(prevText) : '';
        const fullTextForRetrieval = contextHeader
          ? contextHeader + '\n' + seg.text
          : seg.text;

        const wordCount     = seg.text.split(/\s+/).filter(Boolean).length;
        const tokenEstimate = this._estimateTokens(fullTextForRetrieval);
        const chunkId       = `${doc.documentId}__${section.sectionId}__c${docChunkOrder}`;

        const chunk = {
          chunkId,
          chunkOrder:         docChunkOrder,
          chunkIndexInSection: i,
          totalChunksInSection: segments.length,
          sourceDocument:     doc.documentId,
          documentTitle:      doc.title,
          source:             doc.source,
          sourceUrl:          doc.sourceUrl,
          sectionTitle:       section.title,
          sectionId:          section.sectionId,
          disasterType:       doc.category,
          version:            doc.version,
          language:           doc.language || 'en',
          semanticType:       this._classifySemanticType(seg.text),
          boundaryType:       seg.boundaryType,
          contextHeader,
          cleanText:          seg.text,
          fullTextForRetrieval,
          charCount:          seg.text.length,
          wordCount,
          tokenEstimate,
          contentHash,
          previousChunkId:    docChunkOrder > 0 ? docChunks[docChunks.length - 1]?.chunkId || null : null,
          nextChunkId:        null,  // patched after loop
          chunkedAt:          new Date().toISOString(),
        };

        // Patch previous chunk's nextChunkId
        if (docChunks.length > 0) {
          docChunks[docChunks.length - 1].nextChunkId = chunkId;
        }

        docChunks.push(chunk);
        this.chunkIndex.set(chunkId, chunk);
        this.hashIndex.set(contentHash, chunkId);
        prevText = seg.text;
        docChunkOrder++;
      }
    }

    return docChunks;
  }

  /**
   * Run the full semantic chunking pipeline across the entire knowledge base.
   * @returns {Object} Chunking statistics
   */
  chunkAll() {
    const startTime = Date.now();
    logger.info('[SemanticChunker] Starting intelligent document chunking...');

    // Reset state
    this.chunks     = [];
    this.chunkIndex = new Map();
    this.hashIndex  = new Map();
    this.stats.documentsChunked   = 0;
    this.stats.sectionsChunked    = 0;
    this.stats.chunksProduced     = 0;
    this.stats.mergedRuntChunks   = 0;
    this.stats.totalChars         = 0;
    this.stats.totalWords         = 0;
    this.stats.minChunkChars      = Infinity;
    this.stats.maxChunkChars      = 0;

    const allDocuments = Array.from(disasterKnowledgeBaseService.documents.values());

    for (const doc of allDocuments) {
      this.stats.documentsChunked++;
      const docChunks = this._chunkDocument(doc);
      this.chunks.push(...docChunks);
    }

    // Compute aggregate stats
    this.stats.chunksProduced = this.chunks.length;
    for (const c of this.chunks) {
      this.stats.totalChars += c.charCount;
      this.stats.totalWords += c.wordCount;
      if (c.charCount < this.stats.minChunkChars) this.stats.minChunkChars = c.charCount;
      if (c.charCount > this.stats.maxChunkChars) this.stats.maxChunkChars = c.charCount;
    }
    this.stats.avgChunkChars    = this.chunks.length ? Math.round(this.stats.totalChars / this.chunks.length) : 0;
    this.stats.avgChunkWords    = this.chunks.length ? Math.round(this.stats.totalWords / this.chunks.length) : 0;
    this.stats.avgTokenEstimate = this.chunks.length
      ? Math.round(this.chunks.reduce((s, c) => s + c.tokenEstimate, 0) / this.chunks.length)
      : 0;
    this.stats.chunkingDurationMs = Date.now() - startTime;

    logger.info(
      `[SemanticChunker] Complete: ${this.stats.documentsChunked} docs → ${this.stats.chunksProduced} semantic chunks ` +
      `(avg ${this.stats.avgChunkChars} chars, ~${this.stats.avgTokenEstimate} tokens) in ${this.stats.chunkingDurationMs}ms.`
    );

    return this.getStatistics();
  }

  // ────────────────────────────────────────────────────────────
  // 7.  RETRIEVAL APIs
  // ────────────────────────────────────────────────────────────

  /** All chunks. */
  getChunks()                     { return this.chunks; }

  /** Single chunk by ID. */
  getChunkById(chunkId)           { return this.chunkIndex.get(chunkId) || null; }

  /** Chunks for a given disaster type. */
  getChunksByDisasterType(type)   { return this.chunks.filter((c) => c.disasterType === (type || '').toUpperCase()); }

  /** Chunks for a given source document. */
  getChunksByDocument(documentId) { return this.chunks.filter((c) => c.sourceDocument === documentId); }

  /** Chunks matching a semantic type (e.g. 'FIRST_AID', 'SEARCH_RESCUE'). */
  getChunksBySemanticType(type)   { return this.chunks.filter((c) => c.semanticType === type); }

  /**
   * Get a chunk and its adjacent context (previous + next chunks).
   * Useful for expanding retrieval context at inference time.
   */
  getChunkWithContext(chunkId) {
    const chunk = this.chunkIndex.get(chunkId);
    if (!chunk) return null;

    return {
      previous: chunk.previousChunkId ? this.chunkIndex.get(chunk.previousChunkId) : null,
      current:  chunk,
      next:     chunk.nextChunkId ? this.chunkIndex.get(chunk.nextChunkId) : null,
    };
  }

  // ────────────────────────────────────────────────────────────
  // 8.  STATISTICS
  // ────────────────────────────────────────────────────────────

  getStatistics() {
    // Per-document breakdown
    const docBreakdown = {};
    for (const c of this.chunks) {
      if (!docBreakdown[c.sourceDocument]) {
        docBreakdown[c.sourceDocument] = {
          documentTitle: c.documentTitle,
          disasterType: c.disasterType,
          chunks: 0,
          sections: new Set(),
          chars: 0,
          words: 0,
        };
      }
      const d = docBreakdown[c.sourceDocument];
      d.chunks++;
      d.sections.add(c.sectionId);
      d.chars += c.charCount;
      d.words += c.wordCount;
    }

    const documents = Object.entries(docBreakdown).map(([id, d]) => ({
      documentId: id,
      documentTitle: d.documentTitle,
      disasterType: d.disasterType,
      chunks: d.chunks,
      sections: d.sections.size,
      chars: d.chars,
      words: d.words,
    }));

    // Semantic type distribution
    const semanticDist = {};
    for (const c of this.chunks) {
      semanticDist[c.semanticType] = (semanticDist[c.semanticType] || 0) + 1;
    }

    // Boundary type distribution
    const boundaryDist = {};
    for (const c of this.chunks) {
      boundaryDist[c.boundaryType] = (boundaryDist[c.boundaryType] || 0) + 1;
    }

    // Chunk-size histogram (buckets of 200 chars)
    const sizeHistogram = {};
    for (const c of this.chunks) {
      const bucket = `${Math.floor(c.charCount / 200) * 200}-${Math.floor(c.charCount / 200) * 200 + 199}`;
      sizeHistogram[bucket] = (sizeHistogram[bucket] || 0) + 1;
    }

    return {
      summary: { ...this.stats },
      documents,
      semanticTypeDistribution: semanticDist,
      boundaryTypeDistribution: boundaryDist,
      chunkSizeHistogram: sizeHistogram,
    };
  }
}

module.exports = SemanticChunkingService;
