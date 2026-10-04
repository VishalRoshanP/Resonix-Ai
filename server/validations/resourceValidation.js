const VALID_STATUSES = ['AVAILABLE', 'ALLOCATED', 'EN ROUTE', 'ON SCENE', 'BUSY', 'OFFLINE'];

const validateCreateResource = (data) => {
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    return { error: 'Resource name is required' };
  }
  const typeOrCat = data.type || data.category;
  if (!typeOrCat || typeof typeOrCat !== 'string' || typeOrCat.trim().length === 0) {
    return { error: 'Resource type or category is required' };
  }
  if (data.status) {
    const st = String(data.status).toUpperCase();
    if (!VALID_STATUSES.includes(st)) {
      return { error: `Invalid resource status. Must be one of: ${VALID_STATUSES.join(', ')}` };
    }
  }
  return { error: null };
};

const validateUpdateResource = (data) => {
  if (data.status) {
    const st = String(data.status).toUpperCase();
    if (!VALID_STATUSES.includes(st)) {
      return { error: `Invalid resource status. Must be one of: ${VALID_STATUSES.join(', ')}` };
    }
  }
  return { error: null };
};

const validateAssignResource = (data) => {
  if (!data.incidentId || typeof data.incidentId !== 'string' || data.incidentId.trim().length === 0) {
    return { error: 'Target incidentId is required for resource assignment' };
  }
  return { error: null };
};

module.exports = {
  VALID_STATUSES,
  validateCreateResource,
  validateUpdateResource,
  validateAssignResource,
};
