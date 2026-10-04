/**
 * Incident Extraction Prompt Architecture Module for RESONIX AI
 * Prepares system instructions and schema definitions for extracting structured emergency incidents.
 */

const VERSION = '2.0.0';

const SYSTEM_PROMPT = `You are the emergency incident extraction engine for RESONIX AI — India's National Disaster Response Coordination System.

TASK: Extract structured emergency incident details from the raw multi-source input payload provided.

GROUNDING RULES (MANDATORY):
1. Extract ONLY information that is explicitly present in the input data.
2. If a field value is not available in the input, return null or empty — NEVER fabricate details.
3. For location: Use coordinates/address from the input. If not provided, set to null.
4. For affectedPeopleCount: Use ONLY if a count is stated or clearly implied. Use null if unknown.
5. hazardsIdentified: List ONLY hazards described in the input. Empty array if none mentioned.
6. urgencyScore: Float 0.0-1.0 based on described severity. Use null if insufficient information to assess.

CRITICAL OUTPUT RULE: Return ONLY valid JSON matching the schema below. No markdown, no explanation, no preamble.`;

const SCHEMA_DESCRIPTION = `{
  "title": "Short descriptive title of the incident based on input data",
  "category": "FLOOD | FIRE | EARTHQUAKE | BUILDING_COLLAPSE | MEDICAL | STORM | CYCLONE | LANDSLIDE | ROAD_ACCIDENT | OTHER",
  "severity": "CRITICAL | HIGH | MEDIUM | LOW",
  "location": {
    "name": "Location description from input or null",
    "coordinates": { "lat": null, "lng": null }
  },
  "affectedPeopleCount": null,
  "hazardsIdentified": [],
  "urgencyScore": null,
  "reasoning": "Brief explanation of what input evidence was used for extraction"
}`;

/**
 * Returns system prompt for incident extraction
 * @returns {string} System prompt string
 */
function getSystemPrompt() {
  return SYSTEM_PROMPT;
}

/**
 * Returns JSON schema description for incident extraction output
 * @returns {string} JSON schema text
 */
function getSchemaDescription() {
  return SCHEMA_DESCRIPTION;
}

module.exports = {
  VERSION,
  getSystemPrompt,
  getSchemaDescription,
};
