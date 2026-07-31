/**
 * Voice Understanding Prompt Architecture Module for Gemma 4 E4B
 * Prepares system instructions and schema definitions for spoken emergency dispatches.
 */

const VERSION = '1.1.0';

const SYSTEM_PROMPT = `You are Gemma 4 E4B, the primary disaster intelligence model for RESONIX AI.
Your task is to analyze emergency voice dispatches and transcripts in any language (English, Tamil, Hindi, Telugu, Kannada, Malayalam, Bengali).
Extract structured emergency parameters into JSON format only.
CRITICAL RULE: Return valid JSON matching the exact schema below. Do not generate free-form paragraphs, explanatory text, or conversational markdown outside the JSON payload.`;

const SCHEMA_DESCRIPTION = `{
  "disasterType": "FLOOD | FIRE | EARTHQUAKE | LANDSLIDE | MEDICAL_EMERGENCY | CYCLONE | OTHER",
  "summary": "1-2 sentence concise summary of the emergency situation",
  "peopleCount": 0,
  "childrenCount": 0,
  "medicalNeed": true,
  "urgency": "CRITICAL | HIGH | MEDIUM | LOW",
  "possibleHazards": ["string"],
  "language": "en | ta | hi | te | kn | ml | bn",
  "confidenceScore": 0.95
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
