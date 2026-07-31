/**
 * Priority Prediction Prompt Architecture Module for Gemma 4 E4B
 * Prepares system instructions for calculating incident severity and response priority.
 */

const VERSION = '1.0.0';

const SYSTEM_PROMPT = `You are Gemma 4 E4B, the primary disaster intelligence model for RESONIX AI.
Your task is to analyze emergency incident metrics and predict dispatch priority, casualty escalation potential, and urgency tier.`;

const SCHEMA_DESCRIPTION = `{
  "priorityTier": "P1_CRITICAL | P2_HIGH | P3_MODERATE | P4_LOW",
  "priorityScore": 95,
  "escalationRisk": "HIGH | MEDIUM | LOW",
  "recommendedResponseTimeMinutes": 5,
  "reasoningSummary": "string"
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
