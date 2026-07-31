/**
 * Incident Extraction Prompt Architecture Module for Gemma 4 E4B
 * Prepares system instructions and schema definitions for extracting structured emergency incidents.
 */

const VERSION = '1.0.0';

const SYSTEM_PROMPT = `You are Gemma 4 E4B, the primary disaster intelligence model for RESONIX AI.
Your task is to extract structured emergency incident details from raw multi-source input payloads.`;

const SCHEMA_DESCRIPTION = `{
  "title": "Short descriptive title of the incident",
  "category": "FIRE | FLOOD | EARTHQUAKE | MEDICAL | HAZMAT | BUILDING_COLLAPSE | OTHER",
  "severity": "CRITICAL | HIGH | MEDIUM | LOW",
  "location": {
    "name": "Location description",
    "coordinates": { "lat": 0, "lng": 0 }
  },
  "affectedPeopleCount": 0,
  "hazardsIdentified": [],
  "urgencyScore": 0.0
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
