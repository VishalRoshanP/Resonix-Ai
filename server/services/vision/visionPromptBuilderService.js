/**
 * Stage 3: Vision Prompt Builder Service (Enhanced Multimodal Reasoning)
 * 
 * Capabilities:
 * - Constructs specialized Gemma 4 multimodal vision prompts demanding ONLY structured JSON.
 * - Supports 8 explicit disaster types:
 *   • FLOOD
 *   • FIRE
 *   • EARTHQUAKE
 *   • LANDSLIDE
 *   • CYCLONE
 *   • BUILDING_COLLAPSE
 *   • ROAD_ACCIDENT
 *   • INDUSTRIAL_ACCIDENT
 * - Requires 5 core output parameters:
 *   • disaster_type
 *   • disaster_category
 *   • overall_scene_description
 *   • severity_level
 *   • confidence_score
 */

const logger = require('../../utils/logger');

class VisionPromptBuilderService {
  /**
   * Builds specialized multimodal prompt for Gemma 4 Vision Engine
   * @param {Object} context - { citizenNotes, sector, category, gps }
   * @returns {string} Formatted vision analysis prompt
   */
  buildVisionPrompt(context = {}) {
    const citizenNotes = context.citizenNotes || context.description || 'Emergency disaster report image';
    const sector = context.sector || 'Sector 4';

    let prompt = '[ENHANCED GEMMA 4 MULTIMODAL VISION REASONING ENGINE]\n';
    prompt += `Target Sector: ${sector}\n`;
    prompt += `Citizen Emergency Notes: "${citizenNotes}"\n\n`;
    prompt += 'MANDATORY OUTPUT INSTRUCTION:\n';
    prompt += 'You MUST evaluate the emergency scene photo and return ONLY a valid, strict JSON object. Do NOT output free-form markdown, conversational filler, or intro text.\n\n';
    prompt += 'REQUIRED JSON SCHEMA:\n';
    prompt += '{\n';
    prompt += '  "disaster_type": "FLOOD | FIRE | EARTHQUAKE | LANDSLIDE | CYCLONE | BUILDING_COLLAPSE | ROAD_ACCIDENT | INDUSTRIAL_ACCIDENT",\n';
    prompt += '  "disaster_category": "NATURAL_DISASTER | MAN_MADE_ACCIDENT | STRUCTURAL_HAZARD | INDUSTRIAL_HAZARD",\n';
    prompt += '  "overall_scene_description": "<detailed 2-3 sentence visual evidence scene description>",\n';
    prompt += '  "severity_level": "CRITICAL | HIGH | MEDIUM | LOW",\n';
    prompt += '  "confidence_score": 0.98\n';
    prompt += '}\n\n';
    prompt += 'Analyze the photo now and output strictly the raw JSON object matching this schema.';

    logger.info(`[VisionPromptBuilderService] Constructed enhanced Gemma vision reasoning prompt for sector '${sector}'.`);
    return prompt;
  }
}

const visionPromptBuilderService = new VisionPromptBuilderService();
module.exports = visionPromptBuilderService;
