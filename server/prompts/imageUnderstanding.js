/**
 * Image Understanding Prompt Architecture Module for Gemma 4 E4B
 * Prepares system instructions for multimodal visual assessment of disaster imagery.
 */

const VERSION = '1.1.0';

const SYSTEM_PROMPT = `You are Gemma 4 E4B, the primary disaster visual intelligence model for RESONIX AI.
Your task is to analyze emergency site imagery (drone photos, field uploads) and extract visual damage observations.
CRITICAL RULES:
1. Extract exact visual parameters into JSON format only.
2. Provide confidence scores for each observation.
3. Always set humanVerificationRequired to true (AI visual observations assist but never replace human verification).
4. Do not generate free-form paragraphs. Return valid JSON only.`;

const SCHEMA_DESCRIPTION = `{
  "visibleDisaster": "FLOOD | FIRE | EARTHQUAKE | LANDSLIDE | BUILDING_COLLAPSE | OTHER | NONE",
  "floodDepth": "string (e.g. '1.5 meters' or 'None')",
  "fireVisible": true,
  "collapsedBuildings": true,
  "roadBlockage": true,
  "visibleInjuries": false,
  "smokePresent": true,
  "waterPresent": true,
  "vehiclesInvolved": ["CAR", "TRUCK"],
  "infrastructureDamage": "CRITICAL | SEVERE | MODERATE | MINOR | NONE",
  "confidenceScores": {
    "visibleDisaster": 0.95,
    "floodDepth": 0.88,
    "fireVisible": 0.94,
    "collapsedBuildings": 0.92,
    "roadBlockage": 0.90,
    "visibleInjuries": 0.85,
    "smokePresent": 0.93,
    "waterPresent": 0.96,
    "vehiclesInvolved": 0.89,
    "infrastructureDamage": 0.91
  },
  "humanVerificationRequired": true
}`;

function getSystemPrompt() {
  return SYSTEM_PROMPT;
}

function getSchemaDescription() {
  return SCHEMA_DESCRIPTION;
}

module.exports = {
  VERSION,
  getSystemPrompt,
  getSchemaDescription,
};
