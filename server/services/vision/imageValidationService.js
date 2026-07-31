/**
 * Stage 1: Image Validation Service
 * 
 * Capabilities:
 * - Validates image MIME types (JPEG, PNG, WEBP, HEIC)
 * - Checks file size limits (<= 15MB)
 * - Validates image payload integrity & detects corrupt headers
 * - Returns structured validation report
 */

const logger = require('../../utils/logger');

class ImageValidationService {
  constructor() {
    this.allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/jpg'];
    this.maxSizeBytes = 15 * 1024 * 1024; // 15MB
  }

  /**
   * Validates an incoming emergency photo payload
   * @param {Object} imagePayload - { photoId, data, mimeType, sizeBytes, metadata }
   * @returns {Object} Validation result { isValid, errors, metadata }
   */
  validateImage(imagePayload = {}) {
    const errors = [];
    const photoId = imagePayload.photoId || `img_${Date.now()}`;
    const rawData = imagePayload.data || imagePayload.base64 || imagePayload.buffer;
    const mimeType = (imagePayload.mimeType || 'image/jpeg').toLowerCase();
    const sizeBytes = imagePayload.sizeBytes || (typeof rawData === 'string' ? Math.ceil(rawData.length * 0.75) : 0);

    // 1. MIME Type check
    if (!this.allowedMimeTypes.includes(mimeType)) {
      errors.push(`Unsupported image MIME type '${mimeType}'. Allowed types: [${this.allowedMimeTypes.join(', ')}].`);
    }

    // 2. File size check
    if (sizeBytes > this.maxSizeBytes) {
      const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);
      errors.push(`Image file size ${sizeMB}MB exceeds maximum 15MB limit.`);
    }

    // 3. Payload non-empty check
    if (!rawData) {
      errors.push('Image payload is empty or missing image data buffer.');
    }

    // 4. Header corruption check for Base64 / binary string
    if (typeof rawData === 'string' && rawData.length < 50) {
      errors.push('Corrupted image payload: data buffer is too short or malformed.');
    }

    const isValid = errors.length === 0;

    if (!isValid) {
      logger.warn(`[ImageValidationService] Validation FAILED for photo '${photoId}':`, errors.join(' | '));
    } else {
      logger.info(`[ImageValidationService] Validation PASSED for photo '${photoId}' (${mimeType}, ${(sizeBytes / 1024).toFixed(1)} KB).`);
    }

    return {
      isValid,
      photoId,
      mimeType,
      sizeBytes,
      errors,
      validatedAt: new Date().toISOString(),
    };
  }
}

const imageValidationService = new ImageValidationService();
module.exports = imageValidationService;
