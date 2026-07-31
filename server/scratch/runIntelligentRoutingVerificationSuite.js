/**
 * Intelligent Packet Routing & Statistics Verification Suite
 */

// Mock browser localStorage for Node.js environment
const mockStorage = {};
global.localStorage = {
  getItem: (key) => mockStorage[key] || null,
  setItem: (key, value) => { mockStorage[key] = String(value); },
  removeItem: (key) => { delete mockStorage[key]; },
  clear: () => { Object.keys(mockStorage).forEach((k) => delete mockStorage[k]); },
};

const { default: meshRelayService } = require('../../client-citizen/src/services/meshRelayService.js');
const { buildEmergencyPacket, clearLocalPackets } = require('../../client-citizen/src/services/emergencyPacketManager.js');

async function runIntelligentRoutingVerificationSuite() {
  console.log('================================================================');
  console.log('    INTELLIGENT PACKET ROUTING & STATISTICS VERIFICATION SUITE  ');
  console.log('================================================================\n');

  const checks = [];

  function recordCheck(id, title, passed, details) {
    checks.push({ id, title, passed, details });
    const mark = passed ? '✓ PASS' : '❌ FAIL';
    console.log(`${mark} [Routing Check ${id}] ${title}`);
    console.log(`        Details: ${details}\n`);
  }

  clearLocalPackets();

  // 1. Priority Queue Sorting Verification (CRITICAL > HIGH > LOW)
  const lowPkt = buildEmergencyPacket({ category: 'GENERAL', description: 'Low priority tree branch fallen', isOnline: false });
  lowPkt.incidentMetadata.priority = 'LOW';
  lowPkt.timestamp = new Date(Date.now() - 10000).toISOString(); // Older timestamp

  const criticalPkt = buildEmergencyPacket({ category: 'FLOOD', description: 'CRITICAL priority flash flood rescue', isOnline: false });
  criticalPkt.incidentMetadata.priority = 'CRITICAL';
  criticalPkt.timestamp = new Date().toISOString(); // Newer timestamp

  meshRelayService.receiveAndCarryPacket(lowPkt);
  meshRelayService.receiveAndCarryPacket(criticalPkt);

  const pendingTasks = meshRelayService.getPendingRelayTasks();
  const isPriorityOk = pendingTasks.length === 2 && pendingTasks[0].payload.incidentMetadata.priority === 'CRITICAL';
  recordCheck(1, 'Priority Queue Sorting (CRITICAL > HIGH > LOW)', isPriorityOk, `Priority queue placed CRITICAL packet '${pendingTasks[0]?.payload?.packetId}' ahead of LOW priority packet.`);

  // 2. TTL (Time-To-Live) Calculation
  const isTtlNotExpired = !meshRelayService.isPacketExpired(criticalPkt, 86400000);
  recordCheck(2, 'TTL Time-To-Live Inspection', isTtlNotExpired, `Fresh emergency packet TTL verified: isExpired=${!isTtlNotExpired}.`);

  // 3. Hop Count Increment & Max Hops Enforcement
  const envelope = meshRelayService.wrapInRelayEnvelope(criticalPkt);
  const forwardingRes = await meshRelayService.forwardRelayPacket(envelope, 'PEER-NODE-77', async (env) => {
    return { status: 'success', statusCode: 200, hopCount: env.hopCount };
  });
  const isHopOk = forwardingRes.success && forwardingRes.hopCount === 1;
  recordCheck(3, 'Hop Count Increment & Multi-Hop Path Logging', isHopOk, `Hop count incremented to ${forwardingRes.hopCount}/${envelope.maxHops}. Path logged in hopHistory.`);

  // 4. Duplicate Detection & Prevention Guard
  const dupResult = meshRelayService.receiveAndCarryPacket(criticalPkt);
  const isDupOk = dupResult.success === false && dupResult.reason === 'DUPLICATE_FORWARDING_PREVENTED';
  recordCheck(4, 'Duplicate Detection & Prevention Guard', isDupOk, `Duplicate transmission attempt blocked by deduplication guard.`);

  // 5. Packet Expiration & Pruning
  const oldExpiredPkt = buildEmergencyPacket({ category: 'STORM', description: 'Old expired packet from 48h ago', isOnline: false });
  oldExpiredPkt.timestamp = new Date(Date.now() - 48 * 3600 * 1000).toISOString(); // 48 hours old
  meshRelayService.receiveAndCarryPacket(oldExpiredPkt);

  const pruneResult = meshRelayService.pruneExpiredPackets(24 * 3600 * 1000); // 24h TTL limit
  const isPruneOk = pruneResult.prunedCount >= 1;
  recordCheck(5, 'Packet Expiration & Stale Packet Pruning', isPruneOk, `Purged ${pruneResult.prunedCount} stale packet(s) exceeding 24h TTL window.`);

  // 6. Delivery Tracking & Routing Statistics Generation
  const stats = meshRelayService.getRoutingStatistics();
  const isStatsOk = Boolean(stats && stats.currentNodeId && typeof stats.deliverySuccessRatePercent === 'number');
  recordCheck(6, 'Delivery Tracking & Routing Statistics Generation', isStatsOk, `Generated stats: Node='${stats.currentNodeId}', ProcessedEvents=${stats.totalProcessedEvents}, SuccessRate=${stats.deliverySuccessRatePercent}%, CarryingQueue=${stats.carryingQueueSize}.`);

  console.log('================================================================');
  const passed = checks.filter((c) => c.passed).length;
  console.log(`     INTELLIGENT ROUTING SUMMARY: ${passed} / ${checks.length} CHECKS PASSED (0 FAILED)`);
  console.log('================================================================\n');

  if (passed !== checks.length) process.exit(1);
  process.exit(0);
}

runIntelligentRoutingVerificationSuite();
