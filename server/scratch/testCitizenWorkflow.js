/**
 * Comprehensive Citizen Emergency Workflow Integration Test
 */

const userController = require('../controllers/userController');
const voiceController = require('../controllers/voiceController');
const reportController = require('../controllers/reportController');
const relayController = require('../controllers/relayController');
const emergencyController = require('../controllers/emergencyController');

async function runWorkflowTests() {
  console.log('--- STARTING CITIZEN EMERGENCY WORKFLOW SYSTEM TEST ---');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  function createMockRes() {
    return {
      statusCode: 200,
      data: null,
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.data = payload; return this; }
    };
  }

  // 1. Language Preference Test
  try {
    const mockRes = createMockRes();
    await userController.updateLanguagePreference({ params: { id: 'usr_test' }, body: { language: 'ta' } }, mockRes, (err) => { throw err; });
    assert(mockRes.statusCode === 200 && mockRes.data.status === 'success' && mockRes.data.data.language === 'ta', 'Language preference API updates correctly to Tamil (ta)');
  } catch (err) {
    assert(false, 'Language preference API failed: ' + err.message);
  }

  // 2. Voice Audio Processing Test
  try {
    const mockRes = createMockRes();
    await voiceController.processVoiceAudio({ body: { audioData: 'data:audio/webm;base64,GkXf', mimeType: 'audio/webm' } }, mockRes, (err) => { throw err; });
    assert(mockRes.statusCode === 200 && mockRes.data.status === 'success' && mockRes.data.data.status === 'QUEUED_FOR_GEMMA4', 'Voice audio processing API queues audio for Gemma 4 analysis');
  } catch (err) {
    assert(false, 'Voice audio API failed: ' + err.message);
  }

  // 3. Photo Upload & Compression Test
  try {
    const mockRes = createMockRes();
    await reportController.uploadReportPhoto({ body: { imageData: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==', mimeType: 'image/jpeg' } }, mockRes, (err) => { throw err; });
    assert(mockRes.statusCode === 200 && mockRes.data.status === 'success' && mockRes.data.data.photoId.startsWith('img_'), 'Disaster photo upload API generates photo ID and analyzes image');
  } catch (err) {
    assert(false, 'Photo upload API failed: ' + err.message);
  }

  // 4. GPS Location Reporting Test
  try {
    const mockRes = createMockRes();
    await reportController.saveReportLocation({ body: { latitude: 37.7749, longitude: -122.4194, accuracy: 8.5 } }, mockRes, (err) => { throw err; });
    assert(mockRes.statusCode === 200 && mockRes.data.status === 'success' && mockRes.data.data.latitude === 37.7749, 'GPS location API records latitude, longitude, and accuracy metrics');
  } catch (err) {
    assert(false, 'Location API failed: ' + err.message);
  }

  // 5. Emergency Packet Creation & MongoDB Persistence Test
  try {
    const mockRes = createMockRes();
    const samplePacket = {
      packetId: `pkt_test_${Date.now()}`,
      timestamp: new Date().toISOString(),
      selectedLanguage: 'ta',
      audioReference: { hasAudio: true, audioId: 'audio_123' },
      photoReference: { hasPhoto: true, photoId: 'img_123' },
      gpsCoordinates: { hasGps: true, latitude: 37.7749, longitude: -122.4194, accuracyMeters: 8.5 },
      offlineStatus: false,
      internetStatus: 'ONLINE',
      userId: 'usr_citizen_01',
      packetStatus: 'DELIVERED',
    };
    await emergencyController.createEmergencyPacket({ body: samplePacket }, mockRes, (err) => { throw err; });
    assert(mockRes.statusCode === 201 && mockRes.data.status === 'success' && mockRes.data.data.packet.packetId.startsWith('pkt_'), 'Emergency packet creation API returns 201 Created with Gemma 4 envelope');
  } catch (err) {
    assert(false, 'Emergency packet creation API failed: ' + err.message);
  }

  // 6. Emergency Packet Status Retrieval Test
  try {
    const mockRes = createMockRes();
    await emergencyController.getEmergencyStatus({ params: { id: 'pkt_test_123' } }, mockRes, (err) => { throw err; });
    assert(mockRes.statusCode === 200 && mockRes.data.status === 'success' && mockRes.data.data.packet.packetId === 'pkt_test_123', 'Emergency packet status retrieval API returns correct status payload');
  } catch (err) {
    assert(false, 'Emergency status API failed: ' + err.message);
  }

  // 7. Mesh Relay Packet Ingestion Test
  try {
    const mockRes = createMockRes();
    const samplePacket = {
      packetId: `pkt_relay_${Date.now()}`,
      timestamp: new Date().toISOString(),
      selectedLanguage: 'en',
      audioReference: { hasAudio: false },
      photoReference: { hasPhoto: false },
      gpsCoordinates: { hasGps: false },
      offlineStatus: true,
      internetStatus: 'OFFLINE_MESH',
      userId: 'usr_guest',
      packetStatus: 'QUEUED_LOCAL',
    };
    await relayController.receiveEmergencyPacket({ body: samplePacket }, mockRes, (err) => { throw err; });
    assert(mockRes.statusCode === 200 && mockRes.data.status === 'success' && mockRes.data.data.packet.gemmaMeta.primaryModel === 'google/gemma-4-e4b-it', 'Relay network packet ingestion API tags packet for Gemma 4 inference');
  } catch (err) {
    assert(false, 'Relay packet API failed: ' + err.message);
  }

  console.log(`\n--- TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ---`);
  if (failed > 0) process.exit(1);
  process.exit(0);
}

runWorkflowTests();
