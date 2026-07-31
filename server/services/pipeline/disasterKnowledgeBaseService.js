/**
 * Disaster Knowledge Base Service for RESONIX AI
 * 
 * Modular knowledge repository for Retrieval-Augmented Generation (RAG).
 * 
 * Capabilities:
 * - Organizes documents by disaster category (FLOOD, FIRE, SEISMIC, STORM, MEDICAL, BUILDING_COLLAPSE, GENERAL)
 * - Stores document metadata (source, sourceUrl, version, lastUpdated, language)
 * - Maintains document version information
 * - Allows future document additions without code changes (auto-discovery from knowledge/ directory)
 * - Provides retrieval APIs for downstream RAG pipeline stages
 * 
 * Supported Document Categories:
 * - NDMA Disaster Management Guidelines
 * - NDRF Standard Operating Procedures
 * - WHO First Aid Guidelines
 * - Disaster Evacuation Procedures
 * - Emergency Response Manuals
 * - Government Disaster Advisories
 * - Flood / Fire / Earthquake / Cyclone Guidelines
 */

const fs = require('fs');
const path = require('path');
const logger = require('../../utils/logger');

const KNOWLEDGE_BASE_DIR = path.join(__dirname, '..', '..', 'knowledge');

const CATEGORY_DIRECTORY_MAP = {
  FLOOD: 'flood',
  FIRE: 'fire',
  SEISMIC: 'seismic',
  STORM: 'storm',
  MEDICAL: 'medical',
  BUILDING_COLLAPSE: 'building_collapse',
  GENERAL: 'general',
};

class DisasterKnowledgeBaseService {
  constructor() {
    this.documents = new Map();
    this.categoryIndex = new Map();
    this.loadedAt = null;
    this._loadAllDocuments();
  }

  /**
   * Auto-discovers and loads all JSON knowledge documents from the knowledge/ directory tree.
   * Future documents can be added by simply dropping .json files into the appropriate category subdirectory.
   */
  _loadAllDocuments() {
    const startTime = Date.now();

    if (!fs.existsSync(KNOWLEDGE_BASE_DIR)) {
      logger.warn('[KnowledgeBase] Knowledge base directory not found:', KNOWLEDGE_BASE_DIR);
      return;
    }

    const categoryDirs = fs.readdirSync(KNOWLEDGE_BASE_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);

    for (const dirName of categoryDirs) {
      const categoryPath = path.join(KNOWLEDGE_BASE_DIR, dirName);
      const files = fs.readdirSync(categoryPath).filter((f) => f.endsWith('.json'));

      for (const fileName of files) {
        try {
          const filePath = path.join(categoryPath, fileName);
          const rawContent = fs.readFileSync(filePath, 'utf-8');
          const doc = JSON.parse(rawContent);

          if (!doc.documentId || !doc.category) {
            logger.warn(`[KnowledgeBase] Skipping invalid document '${fileName}' — missing documentId or category.`);
            continue;
          }

          // Store document
          this.documents.set(doc.documentId, {
            ...doc,
            _filePath: filePath,
            _loadedAt: new Date().toISOString(),
          });

          // Category index
          const cat = doc.category.toUpperCase();
          if (!this.categoryIndex.has(cat)) {
            this.categoryIndex.set(cat, []);
          }
          this.categoryIndex.get(cat).push(doc.documentId);
        } catch (err) {
          logger.warn(`[KnowledgeBase] Failed to load '${fileName}':`, err.message);
        }
      }
    }

    this.loadedAt = new Date().toISOString();
    const durationMs = Date.now() - startTime;
    logger.info(`[KnowledgeBase] Loaded ${this.documents.size} knowledge documents across ${this.categoryIndex.size} categories in ${durationMs}ms.`);
  }

  /**
   * Retrieves all documents matching a disaster category.
   * @param {string} category - e.g. 'FLOOD', 'FIRE', 'SEISMIC', 'STORM', 'MEDICAL', 'BUILDING_COLLAPSE', 'GENERAL'
   * @returns {Object[]} Array of matching knowledge documents
   */
  getDocumentsByCategory(category = '') {
    const cat = category.toUpperCase();
    const docIds = this.categoryIndex.get(cat) || [];
    return docIds.map((id) => this.documents.get(id)).filter(Boolean);
  }

  /**
   * Retrieves a single document by its unique documentId.
   * @param {string} documentId
   * @returns {Object|null}
   */
  getDocumentById(documentId) {
    return this.documents.get(documentId) || null;
  }

  /**
   * Retrieves specific sections matching a keyword query across all documents in a category.
   * Used for RAG context retrieval.
   * @param {string} category
   * @param {string} query - Keyword or phrase to search for
   * @returns {Object[]} Matching sections with parent document metadata
   */
  searchSections(category, query = '') {
    const docs = category ? this.getDocumentsByCategory(category) : Array.from(this.documents.values());
    const lowerQuery = query.toLowerCase();
    const results = [];

    for (const doc of docs) {
      if (!doc.sections || !Array.isArray(doc.sections)) continue;

      for (const section of doc.sections) {
        const content = (section.content || '').toLowerCase();
        const title = (section.title || '').toLowerCase();

        if (content.includes(lowerQuery) || title.includes(lowerQuery)) {
          results.push({
            documentId: doc.documentId,
            documentTitle: doc.title,
            source: doc.source,
            version: doc.version,
            sectionId: section.sectionId,
            sectionTitle: section.title,
            content: section.content,
          });
        }
      }
    }

    return results;
  }

  /**
   * Returns a full inventory of all loaded knowledge documents.
   * @returns {Object} Knowledge base statistics and document listing
   */
  getInventory() {
    const inventory = [];

    for (const [docId, doc] of this.documents) {
      inventory.push({
        documentId: docId,
        title: doc.title,
        source: doc.source,
        category: doc.category,
        version: doc.version,
        lastUpdated: doc.lastUpdated,
        sectionCount: doc.sections?.length || 0,
      });
    }

    return {
      totalDocuments: this.documents.size,
      totalCategories: this.categoryIndex.size,
      categories: Object.fromEntries(
        Array.from(this.categoryIndex.entries()).map(([cat, ids]) => [cat, ids.length])
      ),
      loadedAt: this.loadedAt,
      documents: inventory,
    };
  }
}

const disasterKnowledgeBaseService = new DisasterKnowledgeBaseService();
module.exports = disasterKnowledgeBaseService;
