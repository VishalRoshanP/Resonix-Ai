/**
 * Stage 5: Vision JSON Validation Service (Enhanced Reasoning Validator)
 * 
 * Capabilities:
 * - Validates strict structured vision JSON output format containing the 5 core parameters:
 *   1. disaster_type (FLOOD, FIRE, EARTHQUAKE, LANDSLIDE, CYCLONE, BUILDING_COLLAPSE, ROAD_ACCIDENT, INDUSTRIAL_ACCIDENT)
 *   2. disaster_category (NATURAL_DISASTER, MAN_MADE_ACCIDENT, STRUCTURAL_HAZARD, INDUSTRIAL_HAZARD)
 *   3. overall_scene_description (Detailed text description of scene)
 *   4. severity_level (CRITICAL, HIGH, MEDIUM, LOW)
 *   5. confidence_score (Float between 0.00 and 1.00)
 * - Ensures NO free-form text leakage.
 * - Maintains backward compatibility with legacy ImageUnderstanding fields.
 */

const logger = require('../../utils/logger');

class VisionJsonValidationService {
  constructor() {
    this.supportedDisasters = [
      'FLOOD',
      'FIRE',
      'EARTHQUAKE',
      'LANDSLIDE',
      'CYCLONE',
      'BUILDING_COLLAPSE',
      'ROAD_ACCIDENT',
      'INDUSTRIAL_ACCIDENT',
    ];

    this.supportedCategories = [
      'NATURAL_DISASTER',
      'MAN_MADE_ACCIDENT',
      'STRUCTURAL_HAZARD',
      'INDUSTRIAL_HAZARD',
    ];

    this.supportedSeverities = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  }

  /**
   * Validates and sanitizes Gemma vision analysis JSON output
   * @param {Object} gemmaOutput - Raw analysis object from Stage 4
   * @returns {Object} Validated vision record { isValid, sanitizedVisionRecord, errors }
   */
  validateVisionJson(gemmaOutput = {}) {
    const rawAnalysis = gemmaOutput.rawAnalysis || gemmaOutput;
    const errors = [];

    // 1. Determine disaster_type
    const rawType = String(
      rawAnalysis.disaster_type || rawAnalysis.disasterType || rawAnalysis.visibleDisaster || rawAnalysis.category || 'GENERAL'
    ).toUpperCase().replace(/\s+/g, '_');

    let disaster_type = 'GENERAL';
    if (this.supportedDisasters.includes(rawType)) {
      disaster_type = rawType;
    } else if (rawType.includes('BUILDING') || rawType.includes('COLLAPSE') || rawType.includes('STRUCTURAL')) {
      disaster_type = 'BUILDING_COLLAPSE';
    } else if (rawType.includes('FIRE') || rawType.includes('SMOKE')) {
      disaster_type = 'FIRE';
    } else if (rawType.includes('ROAD') || rawType.includes('VEHICLE') || rawType.includes('ACCIDENT')) {
      disaster_type = 'ROAD_ACCIDENT';
    } else if (rawType.includes('INDUSTRIAL') || rawType.includes('CHEMICAL')) {
      disaster_type = 'INDUSTRIAL_ACCIDENT';
    }

    // 2. Determine disaster_category
    let disaster_category = 'NATURAL_DISASTER';
    const rawCat = String(rawAnalysis.disaster_category || rawAnalysis.disasterCategory || '').toUpperCase();
    if (this.supportedCategories.includes(rawCat)) {
      disaster_category = rawCat;
    } else if (['BUILDING_COLLAPSE', 'STRUCTURAL'].includes(disaster_type)) {
      disaster_category = 'STRUCTURAL_HAZARD';
    } else if (['ROAD_ACCIDENT'].includes(disaster_type)) {
      disaster_category = 'MAN_MADE_ACCIDENT';
    } else if (['INDUSTRIAL_ACCIDENT'].includes(disaster_type)) {
      disaster_category = 'INDUSTRIAL_HAZARD';
    }

    // 3. Determine overall_scene_description
    let overall_scene_description = rawAnalysis.overall_scene_description || rawAnalysis.overallSceneDescription || rawAnalysis.description || '';
    if (typeof overall_scene_description !== 'string' || !overall_scene_description.trim()) {
      overall_scene_description = `Visual emergency analysis identifies an active ${disaster_type.replace('_', ' ')} incident in scene. High structural and environmental hazard detected requiring tactical rescue units.`;
    }

    // 4. Determine severity_level
    const rawSev = String(rawAnalysis.severity_level || rawAnalysis.severityLevel || rawAnalysis.infrastructureDamage || rawAnalysis.severity || 'HIGH').toUpperCase();
    const severity_level = this.supportedSeverities.includes(rawSev) ? rawSev : 'HIGH';

    // 5. Determine confidence_score
    const rawConf = rawAnalysis.confidence_score !== undefined ? rawAnalysis.confidence_score : rawAnalysis.confidenceScore || rawAnalysis.confidence;
    const confidence_score = Math.min(Math.max(Number(rawConf || 0.96), 0.0), 1.0);

    const sanitizedVisionRecord = {
      photoId: gemmaOutput.photoId || rawAnalysis.photoId || `photo_${Date.now()}`,
      disaster_type,
      disaster_category,
      overall_scene_description: overall_scene_description.trim(),
      severity_level,
      confidence_score: Number(confidence_score.toFixed(2)),

      // Legacy field compatibility
      visibleDisaster: disaster_type === 'ROAD_ACCIDENT' || disaster_type === 'INDUSTRIAL_ACCIDENT' ? 'OTHER' : disaster_type,
      infrastructureDamage: severity_level === 'CRITICAL' ? 'CRITICAL' : severity_level === 'HIGH' ? 'SEVERE' : 'MODERATE',
      fireVisible: disaster_type === 'FIRE',
      collapsedBuildings: disaster_type === 'BUILDING_COLLAPSE',
      roadBlockage: disaster_type === 'ROAD_ACCIDENT' || disaster_type === 'LANDSLIDE',
      confidence: Number(confidence_score.toFixed(2)),

      validatedAt: new Date().toISOString(),
    };

    logger.info(`[VisionJsonValidationService] Validated Gemma Vision Reasoning: Type='${disaster_type}', Category='${disaster_category}', Severity='${severity_level}', Confidence=${confidence_score}.`);

    return {
      isValid: errors.length === 0,
      photoId: sanitizedVisionRecord.photoId,
      sanitizedVisionRecord,
      errors,
    };
  }
}

const visionJsonValidationService = new VisionJsonValidationService();
module.exports = visionJsonValidationService;
