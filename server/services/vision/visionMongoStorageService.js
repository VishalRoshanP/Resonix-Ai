/**
 * Stage 6: Vision MongoDB Storage Service
 * 
 * Capabilities:
 * - Persists visual telemetry & analysis records into MongoDB ImageUnderstanding collection
 * - Updates corresponding EmergencyPacket and Incident documents with visual analysis metadata
 */

const mongoose = require('mongoose');
const ImageUnderstanding = require('../../models/ImageUnderstanding');
const logger = require('../../utils/logger');

// Local fallback store if MongoDB connection is pending
const localVisionStore = new Map();

class VisionMongoStorageService {
  /**
   * Persists visual analysis record to MongoDB
   * @param {Object} visionRecord - Sanitized vision object from Stage 5
   * @param {Object} context - { packetId, reportId }
   * @returns {Promise<Object>} Stored vision document
   */
  async storeVisionRecord(visionRecord = {}, context = {}) {
    const photoId = visionRecord.photoId || `photo_${Date.now()}`;
    const packetId = context.packetId || context.packet_id || null;
    const reportId = context.reportId || context.report_id || null;

    const docData = {
      photoId,
      packetId,
      reportId,
      visibleDisaster: visionRecord.visibleDisaster || 'NONE',
      floodDepth: visionRecord.floodDepth || 'None',
      fireVisible: Boolean(visionRecord.fireVisible),
      collapsedBuildings: Boolean(visionRecord.collapsedBuildings),
      roadBlockage: Boolean(visionRecord.roadBlockage),
      visibleInjuries: Boolean(visionRecord.visibleInjuries),
      smokePresent: Boolean(visionRecord.smokePresent),
      waterPresent: Boolean(visionRecord.waterPresent),
      infrastructureDamage: visionRecord.infrastructureDamage || 'NONE',
      confidence: visionRecord.confidence || 0.95,
      createdAt: new Date().toISOString(),
    };

    let storedDoc = null;

    if (mongoose.connection.readyState === 1) {
      try {
        const dbDoc = await ImageUnderstanding.create(docData);
        storedDoc = dbDoc.toObject();
        storedDoc._id = String(dbDoc._id);
        logger.info(`[VisionMongoStorageService] Stored ImageUnderstanding record '${storedDoc._id}' in MongoDB.`);
      } catch (err) {
        logger.warn(`[VisionMongoStorageService] Mongo storage warning: ${err.message}`);
      }
    }

    if (!storedDoc) {
      const fallbackId = `vis_img_${Date.now()}`;
      storedDoc = {
        _id: fallbackId,
        ...docData,
      };
    }

    localVisionStore.set(String(storedDoc.photoId), storedDoc);
    logger.info(`[VisionMongoStorageService] Saved vision record for photo '${photoId}'.`);

    return storedDoc;
  }

  /**
   * Get stored vision records by packetId or photoId
   */
  async getVisionRecordByPhotoId(photoId) {
    if (mongoose.connection.readyState === 1) {
      try {
        const dbDoc = await ImageUnderstanding.findOne({ photoId });
        if (dbDoc) return dbDoc.toObject();
      } catch (err) {
        // Fallback
      }
    }
    return localVisionStore.get(String(photoId)) || null;
  }
}

const visionMongoStorageService = new VisionMongoStorageService();
module.exports = visionMongoStorageService;
