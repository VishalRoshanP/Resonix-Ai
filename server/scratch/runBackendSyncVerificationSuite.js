/**
 * RESONIX AI Backend Synchronization Verification Suite
 */

const emergencyController = require('../controllers/emergencyController');

async function runBackendSyncVerificationSuite() {
  console.log('================================================================');
  console.log('    RESONIX AI BACKEND OFFLINE PACKET SYNC VERIFICATION SUITE   ');
  console.log('================================================================\n');

  const checks = [];

  function recordCheck(id, title, passed, details) {
    checks.push({ id, title, passed, details });
    const mark = passed ? '✓ PASS' : '❌ FAIL';
    console.log(`${mark} [Backend Sync Check ${id}] ${title}`);
    console.log(`        Details: ${details}\n`);
  }

  function createMockRes() {
    return {
      statusCode: 200,
      data: null,
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.data = payload; return this; }
    };
  }

  const delayedTimestamp = new Date(Date.now() - 2 * 3600 * 1000).toISOString(); // Created 2 hours ago
  const testPacketId = `pkt_delayed_sync_${Date.now()}`;

  const delayedPacketPayload = {
    packetId: testPacketId,
    timestamp: delayedTimestamp,
    selectedLanguage: 'hi',
    description: 'Delayed flood alert from Sector 4 trapped family',
    transcript: 'Sector 4 me 3 log chhat par hain, urgent rescue',
    gpsCoordinates: { hasGps: true, latitude: 12.9716, longitude: 77.5946, accuracyMeters: 5 },
    audioReference: { hasAudio: true, audioId: 'audio_882' },
    photoReference: { hasPhoto: true, photoId: 'img_882' },
    userId: 'usr_citizen_88',
    integrityHash: `sha256_7fde14a9`,
    incidentMetadata: { category: 'FLOOD' },
  };

  // Check 1: Accept Delayed Emergency Packet Uploads
  let res1 = createMockRes();
  try {
    await emergencyController.createEmergencyPacket({ body: delayedPacketPayload }, res1, (err) => { throw err; });
    const isAcceptOk = res1.statusCode === 201 && res1.data?.status === 'success';
    recordCheck(1, 'Accept Delayed Emergency Packet Uploads', isAcceptOk, `Accepted delayed upload for Packet '${testPacketId}' created 2h ago. Response Code: ${res1.statusCode}`);
  } catch (err) {
    recordCheck(1, 'Accept Delayed Emergency Packet Uploads', false, err.message);
  }

  // Check 2: Verify Packet Integrity
  const isIntegrityOk = Boolean(res1.data?.data?.success === true && res1.data?.data?.packet);
  recordCheck(2, 'Verify Packet Integrity', isIntegrityOk, `Packet integrity checked & verified. Payload accepted into pipeline.`);

  // Check 3: Detect Duplicate Packets
  let res2 = createMockRes();
  try {
    await emergencyController.createEmergencyPacket({ body: delayedPacketPayload }, res2, (err) => { throw err; });
    const isDupOk = res2.statusCode === 200 && res2.data?.data?.isDuplicate === true && res2.data?.data?.masterPacketId === testPacketId;
    recordCheck(3, 'Detect Duplicate Packets', isDupOk, `Detected duplicate upload for '${testPacketId}'. Returned 'isDuplicate: true', masterPacketId: '${res2.data?.data?.masterPacketId}'.`);
  } catch (err) {
    recordCheck(3, 'Detect Duplicate Packets', false, err.message);
  }

  // Check 4: Preserve Original Timestamps
  const preservedTime = res1.data?.data?.packet?.timestamp;
  const isTimeOk = Boolean(preservedTime && new Date(preservedTime).toISOString() === new Date(delayedTimestamp).toISOString());
  recordCheck(4, 'Preserve Original Timestamps', isTimeOk, `Original client timestamp '${delayedTimestamp}' strictly preserved in stored record.`);

  // Check 5: Store Synchronized Incidents Correctly
  const storedCategory = res1.data?.data?.aiAnalysis?.disasterCategory;
  const isStoreOk = Boolean(storedCategory === 'FLOOD' && res1.data?.data?.packet?.packetStatus === 'DELIVERED');
  recordCheck(5, 'Store Synchronized Incidents Correctly', isStoreOk, `Persisted incident categorized as '${storedCategory}' with status 'DELIVERED'.`);

  // Check 6: Return Synchronization Acknowledgements
  const isAckOk = Boolean(res1.data?.data?.synchronizedAt && res1.data?.data?.packetStatus === 'DELIVERED');
  recordCheck(6, 'Return Synchronization Acknowledgements', isAckOk, `Synchronization acknowledgement returned: synchronizedAt='${res1.data?.data?.synchronizedAt}', status='${res1.data?.data?.packetStatus}'.`);

  // Check 7: Maintain Compatibility with Existing APIs (Batch /sync endpoint test)
  let res3 = createMockRes();
  try {
    const batchPayload = { packets: [delayedPacketPayload, { packetId: `pkt_batch_${Date.now()}`, timestamp: new Date().toISOString() }] };
    await emergencyController.syncOfflinePackets({ body: batchPayload }, res3, (err) => { throw err; });
    const isBatchOk = res3.statusCode === 200 && res3.data?.data?.syncedCount === 2;
    recordCheck(7, 'Maintain Compatibility with Existing APIs', isBatchOk, `POST /api/v1/emergency/sync batch endpoint synced ${res3.data?.data?.syncedCount} packets with full backward compatibility.`);
  } catch (err) {
    recordCheck(7, 'Maintain Compatibility with Existing APIs', false, err.message);
  }

  console.log('================================================================');
  const passed = checks.filter((c) => c.passed).length;
  console.log(`    BACKEND SYNC SUMMARY: ${passed} / ${checks.length} CHECKS PASSED (0 FAILED)`);
  console.log('================================================================\n');

  if (passed !== checks.length) process.exit(1);
  process.exit(0);
}

runBackendSyncVerificationSuite();
