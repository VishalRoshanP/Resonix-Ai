const validateCreateRelayNode = (data) => {
  if (!data.nodeId || typeof data.nodeId !== 'string' || data.nodeId.trim().length === 0) {
    return { error: 'Node ID is required' };
  }
  if (!data.location || (typeof data.location !== 'string' && typeof data.location !== 'object')) {
    return { error: 'Node location details are required' };
  }
  return { error: null };
};

const validateUpdateRelayNode = (data) => {
  if (data.status && !['active', 'degraded', 'offline', 'maintenance'].includes(data.status)) {
    return { error: 'Invalid node status' };
  }
  return { error: null };
};

module.exports = {
  validateCreateRelayNode,
  validateUpdateRelayNode,
};
