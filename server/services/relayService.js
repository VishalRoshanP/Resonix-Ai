const RelayNode = require('../models/RelayNode');

const getAllNodes = async () => {
  return await RelayNode.find().sort({ nodeId: 1 });
};

const updateNodeStatus = async (nodeId, status, signalStrength) => {
  return await RelayNode.findOneAndUpdate(
    { nodeId },
    { status, signalStrength, lastBroadcast: Date.now() },
    { new: true, upsert: true }
  );
};

const processMeshRelayEnvelope = async (relayEnvelope) => {
  // Prepared for future P2P mesh relay envelope processing
  return {
    status: 'ENVELOPE_RECEIVED',
    relayId: relayEnvelope.targetRelayId || 'NODE-ALPHA',
    processedAt: new Date().toISOString(),
    gemmaReady: true,
  };
};

module.exports = {
  getAllNodes,
  updateNodeStatus,
  processMeshRelayEnvelope,
};
