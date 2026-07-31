/**
 * Resource Recommendation Prompt Architecture Module for Gemma 4 E4B
 * Prepares system instructions for calculating optimal resource and personnel allocation.
 */

const VERSION = '1.0.0';

const SYSTEM_PROMPT = `You are Gemma 4 E4B, the primary disaster intelligence model for RESONIX AI.
Your task is to recommend optimal emergency personnel, vehicles, and medical supply dispatch for verified incidents.`;

const SCHEMA_DESCRIPTION = `{
  "incidentId": "string",
  "recommendedUnits": [
    {
      "type": "FIRE_TRUCK | AMBULANCE | HAZMAT_SQUAD | RESCUE_DRONE | POLICE",
      "quantity": 2,
      "urgency": "IMMEDIATE | STANDBY"
    }
  ],
  "estimatedDeploymentEtaMinutes": 10,
  "optimizationNotes": "string"
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
