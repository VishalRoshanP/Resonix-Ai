/**
 * RESONIX AI — AI Telemetry Synchronization Verification Suite
 * 
 * Verifies that after Gemma finishes processing:
 * 1. Summary
 * 2. Disaster Type
 * 3. Severity
 * 4. Priority
 * 5. Hazards
 * 6. Confidence
 * 7. Resource Recommendations
 * 8. Vision Analysis
 * 9. RAG References
 * 
 * Are persisted in MongoDB and retrieved directly by the responder dashboard.
 */

const emergencyController = require('../controllers/emergencyController');
const incidentService = require('../services/incidentService');
const fs = require('fs');
const path = require('path');

function createMockReqRes(body = {}) {
  const req = { body, headers: {} };
  const res = {
    statusCode: 200,
    data: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.data = payload; return this; },
  };
  return { req, res };
}

async function runAiSynchronizationVerificationSuite() {
  console.log('================================================================');
  console.log('   AI TELEMETRY MONGODB SYNCHRONIZATION VERIFICATION SUITE       ');
  console.log('================================================================\n');

  const checks = [];
  function recordCheck(id, title, passed, details) {
    checks.push({ id, title, passed, details });
    const mark = passed ? '✓ PASS' : '❌ FAIL';
    console.log(`${mark} [AiSync-${id}] ${title}`);
    console.log(`        Details: ${details}\n`);
  }

  // 1. Submit Citizen Emergency Payload
  const syncPacketId = `pkt_sync_${Date.now()}`;
  const citizenPayload = {
    packetId: syncPacketId,
    timestamp: new Date().toISOString(),
    category: 'FLOOD',
    description: 'Flash flood inundation in Sector 4, water level 1.9m, 4 victims trapped',
    voiceTranscript: 'Sector 4 me paani bohot tez bhar raha hai, 4 log balcony par trapped hain, NDRF boat squad urgent bhejiye',
    gpsCoordinates: { latitude: 12.9716, longitude: 77.5946, sector: 'Sector 4', hasGps: true },
    userId: 'usr_sync_citizen_88',
  };

  const { req, res } = createMockReqRes(citizenPayload);
  await emergencyController.createEmergencyPacket(req, res, (err) => { throw err; });

  // 2. Fetch Stored Incident from MongoDB
  const incidents = await incidentService.getAllIncidents();
  const targetIncident = incidents.find((i) => String(i.title || '').includes(syncPacketId) || String(i.description || '').includes('Flash flood inundation'));

  const ai = targetIncident?.aiAnalysis || {};

  // Check 1: Summary synchronized in MongoDB
  recordCheck(1, 'Synchronize Field 1: Summary in MongoDB',
    Boolean(ai.summary && typeof ai.summary === 'string'),
    `Persisted Summary: "${ai.summary}".`
  );

  // Check 2: Disaster Type synchronized in MongoDB
  recordCheck(2, 'Synchronize Field 2: Disaster Type in MongoDB',
    Boolean(ai.disasterType || targetIncident?.category),
    `Persisted Disaster Type: '${ai.disasterType || targetIncident?.category}'.`
  );

  // Check 3: Severity synchronized in MongoDB
  recordCheck(3, 'Synchronize Field 3: Severity in MongoDB',
    Boolean(ai.severity || targetIncident?.severity),
    `Persisted Severity: '${ai.severity || targetIncident?.severity}'.`
  );

  // Check 4: Priority synchronized in MongoDB
  recordCheck(4, 'Synchronize Field 4: Priority in MongoDB',
    Boolean(ai.priority || ai.recommendedPriority),
    `Persisted Priority: '${ai.priority || ai.recommendedPriority}'.`
  );

  // Check 5: Hazards synchronized in MongoDB
  recordCheck(5, 'Synchronize Field 5: Hazards Array in MongoDB',
    Array.isArray(ai.hazards) && ai.hazards.length >= 1,
    `Persisted Hazards (${ai.hazards?.length || 0} items): [${ai.hazards?.map((h) => h.hazard || h).join(', ')}].`
  );

  // Check 6: Confidence Score synchronized in MongoDB
  recordCheck(6, 'Synchronize Field 6: Confidence Score in MongoDB',
    typeof (ai.confidence || ai.confidenceScore) === 'number',
    `Persisted Confidence Score: ${ai.confidence || ai.confidenceScore}.`
  );

  // Check 7: Resource Recommendations synchronized in MongoDB
  recordCheck(7, 'Synchronize Field 7: Resource Recommendations in MongoDB',
    Array.isArray(ai.resourceRecommendations) && ai.resourceRecommendations.length >= 1,
    `Persisted Resource Recommendations: [${ai.resourceRecommendations?.join(', ')}].`
  );

  // Check 8: Vision Analysis synchronized in MongoDB
  recordCheck(8, 'Synchronize Field 8: Vision Analysis Telemetry in MongoDB',
    Boolean(ai.visionAnalysis && typeof ai.visionAnalysis === 'object'),
    `Persisted Vision Analysis: Scene Description="${ai.visionAnalysis?.overall_scene_description || 'Visual evidence verified'}".`
  );

  // Check 9: RAG References synchronized in MongoDB
  recordCheck(9, 'Synchronize Field 9: RAG References in MongoDB',
    Array.isArray(ai.ragReferences) && ai.ragReferences.length >= 1,
    `Persisted RAG References: [${ai.ragReferences?.join(', ')}].`
  );

  // ─── Final Summary ────────────────────────────────────────────────────────
  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.length - passed;

  console.log('================================================================');
  console.log(`  AI TELEMETRY SYNC SUMMARY: ${passed} / ${checks.length} FIELDS PASSED (${failed} FAILED)`);
  console.log('================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runAiSynchronizationVerificationSuite();
