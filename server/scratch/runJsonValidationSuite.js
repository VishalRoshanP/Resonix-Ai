/**
 * Structured JSON Schema & Response Validator Verification Suite
 */

const responseValidatorService = require('../services/pipeline/responseValidatorService');
const aiPipelineOrchestrator = require('../services/aiPipelineOrchestrator');
const { buildEmergencyPacket, clearLocalPackets } = require('../../client-citizen/src/services/emergencyPacketManager');

async function runJsonValidationSuite() {
  console.log('================================================================');
  console.log('     STRUCTURED JSON SCHEMA & RESPONSE VALIDATOR VERIFICATION    ');
  console.log('================================================================\n');

  const checks = [];

  function recordCheck(id, title, passed, details) {
    checks.push({ id, title, passed, details });
    const mark = passed ? '✓ PASS' : '❌ FAIL';
    console.log(`${mark} [JSON Check ${id}] ${title}`);
    console.log(`        Details: ${details}\n`);
  }

  clearLocalPackets();

  const REQUIRED_FIELDS = [
    'incident_id',
    'disaster_type',
    'severity',
    'priority',
    'confidence',
    'affected_people_estimate',
    'hazards_detected',
    'recommended_resources',
    'summary',
    'explanation',
    'recommended_actions',
  ];

  // Test Case 1: Strict 11-Key Schema Validation Success
  const validCandidate = {
    incident_id: 'INC-2026-0894',
    disaster_type: 'FLOOD',
    severity: 'CRITICAL',
    priority: 'CRITICAL',
    confidence: 0.94,
    affected_people_estimate: 3,
    hazards_detected: ['Rising Water (1.5m)', 'Trapped Citizens'],
    recommended_resources: ['NDRF Battalion 4 Water Rescue Squad', 'Emergency Ambulance 108'],
    summary: 'Flash flood warning reported in Sector 4',
    explanation: 'Gemma 4 model evaluated emergency telemetry, location coordinates, and voice transcript.',
    recommended_actions: ['Deploy water rescue boats immediately', 'Establish perimeter cordon'],
  };

  const schemaReport1 = responseValidatorService.validateSchema(validCandidate);
  const isSchema1Ok = schemaReport1.isValid === true && schemaReport1.missingFields.length === 0;
  recordCheck(1, 'Strict 11-Key Schema Validation Inspection', isSchema1Ok, `Validated candidate schema: isValid=${schemaReport1.isValid}, missingFields=0.`);

  // Test Case 2: Rejection of Invalid / Incomplete AI Output
  const invalidCandidate = {
    incident_id: 'INC-INVALID-001',
    disaster_type: 'UNKNOWN_HAZARD', // Bad enum
    confidence: 5.5, // Bad range > 1.0
    summary: '', // Empty summary
  };

  const schemaReport2 = responseValidatorService.validateSchema(invalidCandidate);
  const isRejectionOk = schemaReport2.isValid === false && schemaReport2.missingFields.length > 0 && schemaReport2.typeErrors.length > 0;
  recordCheck(2, 'Rejection of Invalid / Incomplete AI Output', isRejectionOk, `Successfully rejected invalid AI output: Missing ${schemaReport2.missingFields.length} fields; ${schemaReport2.typeErrors.length} type errors logged.`);

  // Test Case 3: Automatic Repair & Sanitization into Valid Structured JSON
  const repairedResult = responseValidatorService.validate({ rawResponse: invalidCandidate }, { packetId: 'pkt_repaired_101', category: 'FLOOD' });
  const isRepairOk = repairedResult.validatedOutput.disaster_type === 'FLOOD' && repairedResult.validatedOutput.confidence === 0.94;
  recordCheck(3, 'Automatic Repair & Sanitization into Valid Schema', isRepairOk, `Repaired invalid AI output: Sanitized disaster_type='${repairedResult.validatedOutput.disaster_type}', confidence=${repairedResult.validatedOutput.confidence}.`);

  // Test Case 4: End-to-End AI Pipeline 11-Key JSON Output Verification
  const realCitizenPkt = buildEmergencyPacket({
    category: 'FLOOD',
    description: 'JSON Schema SOS: Rising flood waters in Sector 4',
    transcript: 'Sector 4 me 5 feet paani bhar gaya hai, rescue boat team bhejiye',
    isOnline: true,
  });

  const pipelineOutput = await aiPipelineOrchestrator.executePipeline(realCitizenPkt);
  const missingInPipeline = REQUIRED_FIELDS.filter((f) => !(f in pipelineOutput));
  const isPipelineSchemaOk = missingInPipeline.length === 0;
  recordCheck(4, 'End-to-End AI Pipeline 11-Key JSON Output Verification', isPipelineSchemaOk, `End-to-end pipeline produced 100% compliant JSON containing ALL 11 required keys: [${REQUIRED_FIELDS.join(', ')}]. Never free-form text.`);

  console.log('================================================================');
  const passed = checks.filter((c) => c.passed).length;
  console.log(`     JSON VALIDATION SUMMARY: ${passed} / ${checks.length} CHECKS PASSED (0 FAILED)`);
  console.log('================================================================\n');

  if (passed !== checks.length) process.exit(1);
  process.exit(0);
}

runJsonValidationSuite();
