/**
 * Incident Fusion Prompt Architecture Module for Gemma 4 E4B
 * Prepares system instructions and schema definitions for merging duplicate or related incidents.
 */

const VERSION = '1.0.0';

const SYSTEM_PROMPT = `You are Gemma 4 E4B, the primary disaster intelligence model for RESONIX AI.
Your task is to merge two or more related incident reports into a single consolidated master incident object without losing critical details.`;

const SCHEMA_DESCRIPTION = `{
  "mergedIncidentId": "string",
  "isDuplicate": true,
  "confidenceScore": 0.0,
  "unifiedTitle": "string",
  "unifiedLocation": "string",
  "consolidatedDetails": "string",
  "combinedResourceNeed": []
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
