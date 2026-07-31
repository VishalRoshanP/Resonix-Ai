/**
 * Document Ingestion Service for RESONIX AI Disaster Knowledge Base
 * 
 * Responsible for:
 * - Reading all disaster knowledge documents from the knowledge base
 * - Extracting clean text from each section
 * - Preserving document titles, sections, and page references
 * - Removing unnecessary formatting (excess whitespace, numbering artifacts, special chars)
 * - Detecting duplicate documents (by content fingerprint and documentId)
 * - Producing embedding-ready text chunks with full provenance metadata
 * 
 * Each ingested chunk contains:
 *   chunkId, documentId, documentTitle, source, category, version,
 *   sectionId, sectionTitle, cleanText, charCount, wordCount,
 *   contentHash, pageReference, ingestedAt
 */

const crypto = require('crypto');
const logger = require('../../utils/logger');
const disasterKnowledgeBaseService = require('./disasterKnowledgeBaseService');

// Maximum chunk size in characters for embedding preparation
const MAX_CHUNK_CHARS = 1500;
// Overlap between consecutive chunks to preserve context at boundaries
const CHUNK_OVERLAP_CHARS = 200;

class DocumentIngestionService {
  constructor() {
    this.ingestedChunks = [];
    this.ingestionLog = [];
    this.contentHashes = new Map();   // hash -> chunkId (for duplicate detection)
    this.documentIdSet = new Set();   // for document-level duplicate detection
    this.stats = {
      documentsProcessed: 0,
      sectionsProcessed: 0,
      chunksProduced: 0,
      duplicatesDetected: 0,
      totalCleanChars: 0,
      totalCleanWords: 0,
      ingestionStartedAt: null,
      ingestionCompletedAt: null,
      ingestionDurationMs: 0,
    };
  }

  // ──────────────────────────────────────────────
  // TEXT CLEANING PIPELINE
  // ──────────────────────────────────────────────

  /**
   * Removes unnecessary formatting while preserving semantic content.
   * @param {string} raw - Raw text from knowledge document section
   * @returns {string} Cleaned text ready for embedding
   */
  _cleanText(raw) {
    if (!raw || typeof raw !== 'string') return '';

    let text = raw;

    // 1. Normalize Unicode whitespace characters to standard space
    text = text.replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000\uFEFF]/g, ' ');

    // 2. Remove zero-width characters
    text = text.replace(/[\u200C\u200D\u200E\u200F]/g, '');

    // 3. Normalize line breaks
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // 4. Collapse multiple blank lines into one
    text = text.replace(/\n{3,}/g, '\n\n');

    // 5. Remove leading/trailing whitespace on each line
    text = text.split('\n').map((line) => line.trim()).join('\n');

    // 6. Normalize bullet/list markers to consistent format
    text = text.replace(/^[\s]*[•●○▪▸▹►–—]\s*/gm, '- ');

    // 7. Normalize numbered list markers: (1), (2) etc. → clean numbered format
    text = text.replace(/\((\d+)\)\s*/g, '$1. ');

    // 8. Remove excessive spaces (collapse multiple spaces to single)
    text = text.replace(/ {2,}/g, ' ');

    // 9. Remove control characters except newline and tab
    text = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

    // 10. Normalize dashes: em-dash and en-dash to standard hyphen in inline contexts
    text = text.replace(/\s[—–]\s/g, ' - ');

    // 11. Trim overall
    text = text.trim();

    return text;
  }

  /**
   * Generates a SHA-256 content hash for duplicate detection.
   * @param {string} text - Clean text content
   * @returns {string} Hex digest of the content hash
   */
  _computeContentHash(text) {
    return crypto.createHash('sha256').update(text, 'utf-8').digest('hex');
  }

  /**
   * Extracts a page reference from section metadata or content.
   * Looks for patterns like "Page X", "p. X", "pp. X-Y" in content.
   * @param {Object} section - Section object with sectionId and content
   * @returns {string|null} Extracted page reference or null
   */
  _extractPageReference(section) {
    if (!section) return null;

    // Check if sectionId encodes a page reference (e.g., "page-42", "p12")
    const sectionIdMatch = (section.sectionId || '').match(/(?:page|p)[-_]?(\d+)/i);
    if (sectionIdMatch) return `Page ${sectionIdMatch[1]}`;

    // Search content for page references
    const content = section.content || '';
    const pagePatterns = [
      /(?:pages?\s*(\d+[\s]*[-–]\s*\d+))/i,
      /(?:pp?\.\s*(\d+[\s]*[-–]\s*\d+))/i,
      /(?:page\s+(\d+))/i,
      /(?:p\.\s*(\d+))/i,
    ];

    for (const pattern of pagePatterns) {
      const match = content.match(pattern);
      if (match) return `Page ${match[1]}`;
    }

    return null;
  }

  // ──────────────────────────────────────────────
  // CHUNKING FOR EMBEDDING PREPARATION
  // ──────────────────────────────────────────────

  /**
   * Splits clean text into embedding-ready chunks with overlap.
   * Respects sentence boundaries where possible.
   * @param {string} cleanText - Cleaned section text
   * @returns {string[]} Array of text chunks
   */
  _chunkText(cleanText) {
    if (!cleanText) return [];
    if (cleanText.length <= MAX_CHUNK_CHARS) return [cleanText];

    const chunks = [];
    let startIdx = 0;

    while (startIdx < cleanText.length) {
      let endIdx = Math.min(startIdx + MAX_CHUNK_CHARS, cleanText.length);

      // If not at the end, try to break at a sentence boundary
      if (endIdx < cleanText.length) {
        const searchWindow = cleanText.substring(
          Math.max(startIdx, endIdx - 300),
          endIdx
        );

        // Find the last sentence-ending punctuation in the search window
        const sentenceEndMatch = searchWindow.match(/.*[.!?]\s/s);
        if (sentenceEndMatch) {
          endIdx = (endIdx - 300 > startIdx ? endIdx - 300 : startIdx) + sentenceEndMatch[0].length;
        }
      }

      const chunk = cleanText.substring(startIdx, endIdx).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }

      // Advance with overlap
      startIdx = endIdx - CHUNK_OVERLAP_CHARS;
      if (startIdx >= cleanText.length) break;
      // Prevent infinite loop on very short remaining text
      if (endIdx >= cleanText.length) break;
    }

    return chunks;
  }

  // ──────────────────────────────────────────────
  // DUPLICATE DETECTION
  // ──────────────────────────────────────────────

  /**
   * Checks if a document has already been ingested (by documentId).
   * @param {string} documentId
   * @returns {boolean}
   */
  _isDocumentDuplicate(documentId) {
    return this.documentIdSet.has(documentId);
  }

  /**
   * Checks if a chunk's content is a duplicate (by content hash).
   * @param {string} contentHash
   * @returns {{ isDuplicate: boolean, existingChunkId: string|null }}
   */
  _isChunkDuplicate(contentHash) {
    if (this.contentHashes.has(contentHash)) {
      return { isDuplicate: true, existingChunkId: this.contentHashes.get(contentHash) };
    }
    return { isDuplicate: false, existingChunkId: null };
  }

  // ──────────────────────────────────────────────
  // MAIN INGESTION PIPELINE
  // ──────────────────────────────────────────────

  /**
   * Ingests a single knowledge document: cleans text, chunks, deduplicates, and indexes.
   * @param {Object} doc - Raw document from DisasterKnowledgeBaseService
   * @returns {{ chunksIngested: number, duplicatesSkipped: number }}
   */
  _ingestDocument(doc) {
    let chunksIngested = 0;
    let duplicatesSkipped = 0;

    // Document-level duplicate detection
    if (this._isDocumentDuplicate(doc.documentId)) {
      this.stats.duplicatesDetected++;
      this.ingestionLog.push({
        level: 'WARN',
        documentId: doc.documentId,
        message: `Duplicate document skipped (documentId already ingested).`,
        timestamp: new Date().toISOString(),
      });
      return { chunksIngested: 0, duplicatesSkipped: 1 };
    }

    this.documentIdSet.add(doc.documentId);

    if (!doc.sections || !Array.isArray(doc.sections) || doc.sections.length === 0) {
      this.ingestionLog.push({
        level: 'WARN',
        documentId: doc.documentId,
        message: `Document has no sections — skipping.`,
        timestamp: new Date().toISOString(),
      });
      return { chunksIngested: 0, duplicatesSkipped: 0 };
    }

    for (const section of doc.sections) {
      this.stats.sectionsProcessed++;

      // Clean text
      const cleanText = this._cleanText(section.content);
      if (!cleanText) {
        this.ingestionLog.push({
          level: 'WARN',
          documentId: doc.documentId,
          sectionId: section.sectionId,
          message: `Section produced empty text after cleaning — skipping.`,
          timestamp: new Date().toISOString(),
        });
        continue;
      }

      // Extract page reference
      const pageReference = this._extractPageReference(section);

      // Split into chunks
      const textChunks = this._chunkText(cleanText);

      for (let i = 0; i < textChunks.length; i++) {
        const chunkText = textChunks[i];
        const contentHash = this._computeContentHash(chunkText);

        // Content-level duplicate detection
        const dupCheck = this._isChunkDuplicate(contentHash);
        if (dupCheck.isDuplicate) {
          duplicatesSkipped++;
          this.stats.duplicatesDetected++;
          this.ingestionLog.push({
            level: 'INFO',
            documentId: doc.documentId,
            sectionId: section.sectionId,
            message: `Duplicate chunk skipped (content hash matches existing chunk '${dupCheck.existingChunkId}').`,
            timestamp: new Date().toISOString(),
          });
          continue;
        }

        const wordCount = chunkText.split(/\s+/).filter(Boolean).length;
        const chunkId = `${doc.documentId}_${section.sectionId}_chunk${i}`;

        const chunk = {
          chunkId,
          chunkIndex: i,
          totalChunksInSection: textChunks.length,
          documentId: doc.documentId,
          documentTitle: doc.title,
          source: doc.source,
          sourceUrl: doc.sourceUrl,
          category: doc.category,
          version: doc.version,
          lastUpdated: doc.lastUpdated,
          language: doc.language,
          sectionId: section.sectionId,
          sectionTitle: section.title,
          pageReference,
          cleanText: chunkText,
          charCount: chunkText.length,
          wordCount,
          contentHash,
          ingestedAt: new Date().toISOString(),
        };

        this.ingestedChunks.push(chunk);
        this.contentHashes.set(contentHash, chunkId);
        this.stats.totalCleanChars += chunkText.length;
        this.stats.totalCleanWords += wordCount;
        this.stats.chunksProduced++;
        chunksIngested++;
      }
    }

    this.ingestionLog.push({
      level: 'INFO',
      documentId: doc.documentId,
      message: `Ingested ${chunksIngested} chunks from ${doc.sections.length} sections.`,
      timestamp: new Date().toISOString(),
    });

    return { chunksIngested, duplicatesSkipped };
  }

  /**
   * Runs the full ingestion pipeline across all documents in the knowledge base.
   * @returns {Object} Ingestion results summary
   */
  ingestAll() {
    this.stats.ingestionStartedAt = new Date().toISOString();
    const startTime = Date.now();

    logger.info('[DocumentIngestion] Starting full knowledge base ingestion...');

    // Reset state for fresh ingestion
    this.ingestedChunks = [];
    this.ingestionLog = [];
    this.contentHashes.clear();
    this.documentIdSet.clear();
    this.stats.documentsProcessed = 0;
    this.stats.sectionsProcessed = 0;
    this.stats.chunksProduced = 0;
    this.stats.duplicatesDetected = 0;
    this.stats.totalCleanChars = 0;
    this.stats.totalCleanWords = 0;

    const allDocuments = Array.from(disasterKnowledgeBaseService.documents.values());

    for (const doc of allDocuments) {
      this.stats.documentsProcessed++;
      this._ingestDocument(doc);
    }

    // Intentionally try to re-ingest the first document to test duplicate detection
    if (allDocuments.length > 0) {
      this._ingestDocument(allDocuments[0]);
    }

    this.stats.ingestionCompletedAt = new Date().toISOString();
    this.stats.ingestionDurationMs = Date.now() - startTime;

    logger.info(
      `[DocumentIngestion] Ingestion complete: ${this.stats.documentsProcessed} docs → ${this.stats.chunksProduced} chunks (${this.stats.duplicatesDetected} duplicates detected) in ${this.stats.ingestionDurationMs}ms.`
    );

    return this.getIngestionReport();
  }

  /**
   * Returns all embedding-ready chunks.
   * @returns {Object[]} Array of ingested chunks with full provenance metadata
   */
  getChunks() {
    return this.ingestedChunks;
  }

  /**
   * Returns chunks filtered by category.
   * @param {string} category
   * @returns {Object[]}
   */
  getChunksByCategory(category) {
    const cat = (category || '').toUpperCase();
    return this.ingestedChunks.filter((c) => c.category === cat);
  }

  /**
   * Returns chunks filtered by documentId.
   * @param {string} documentId
   * @returns {Object[]}
   */
  getChunksByDocumentId(documentId) {
    return this.ingestedChunks.filter((c) => c.documentId === documentId);
  }

  /**
   * Returns the full ingestion report with statistics and logs.
   * @returns {Object}
   */
  getIngestionReport() {
    // Build per-document summary
    const documentSummaries = {};
    for (const chunk of this.ingestedChunks) {
      if (!documentSummaries[chunk.documentId]) {
        documentSummaries[chunk.documentId] = {
          documentId: chunk.documentId,
          documentTitle: chunk.documentTitle,
          source: chunk.source,
          category: chunk.category,
          version: chunk.version,
          chunksProduced: 0,
          sectionsIngested: new Set(),
          totalChars: 0,
          totalWords: 0,
        };
      }
      const summary = documentSummaries[chunk.documentId];
      summary.chunksProduced++;
      summary.sectionsIngested.add(chunk.sectionId);
      summary.totalChars += chunk.charCount;
      summary.totalWords += chunk.wordCount;
    }

    // Convert Sets to counts for serialization
    const documents = Object.values(documentSummaries).map((d) => ({
      ...d,
      sectionsIngested: d.sectionsIngested.size,
    }));

    return {
      stats: { ...this.stats },
      documents,
      ingestionLog: this.ingestionLog,
    };
  }
}

module.exports = DocumentIngestionService;
