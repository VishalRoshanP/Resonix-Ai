const validateCreateResource = (data) => {
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    return { error: 'Resource name is required' };
  }
  if (!data.category || typeof data.category !== 'string') {
    return { error: 'Resource category is required' };
  }
  if (data.quantity !== undefined && (typeof data.quantity !== 'number' || data.quantity < 0)) {
    return { error: 'Quantity must be a positive number' };
  }
  return { error: null };
};

const validateUpdateResource = (data) => {
  if (data.quantity !== undefined && (typeof data.quantity !== 'number' || data.quantity < 0)) {
    return { error: 'Quantity must be a positive number' };
  }
  if (data.status && !['available', 'allocated', 'depleted', 'reserved'].includes(data.status)) {
    return { error: 'Invalid resource status' };
  }
  return { error: null };
};

module.exports = {
  validateCreateResource,
  validateUpdateResource,
};
