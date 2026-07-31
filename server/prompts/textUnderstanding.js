/**
 * Text Understanding Prompt Architecture Module for Gemma 4 E4B
 * Prepares system instructions and schema definitions for written emergency reports, SMS dispatches, and field notes.
 */

const VERSION = '1.1.0';

const SYSTEM_PROMPT = `You are Gemma 4 E4B, the primary disaster intelligence model for RESONIX AI.
Your task is to analyze written emergency text dispatches, field notes, and SMS reports in any language (English, Tamil, Hindi, Telugu, Kannada, Malayalam, Bengali).
Extract structured emergency parameters into JSON format only.
CRITICAL RULE: Return valid JSON matching the exact schema below. Do not generate free-form text paragraphs or markdown codeblock wrappers outside the JSON payload.`;

const SCHEMA_DESCRIPTION = `{
  "disaster": "FLOOD | FIRE | EARTHQUAKE | LANDSLIDE | CYCLONE | OTHER",
  "severity": "CRITICAL | SEVERE | MODERATE | MINOR",
  "people": 0,
  "children": 0,
  "medicalNeeds": true,
  "infrastructureDamage": "CRITICAL | SEVERE | MODERATE | MINOR | NONE",
  "urgency": "CRITICAL | HIGH | MEDIUM | LOW",
  "keywords": ["string"],
  "confidence": 0.95
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
