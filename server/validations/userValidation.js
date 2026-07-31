const validateCreateUser = (data) => {
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    return { error: 'Name is required' };
  }
  if (!data.email || typeof data.email !== 'string' || !data.email.includes('@')) {
    return { error: 'Valid email address is required' };
  }
  if (data.role && !['citizen', 'responder', 'commander', 'admin'].includes(data.role)) {
    return { error: 'Role must be one of: citizen, responder, commander, admin' };
  }
  return { error: null };
};

const validateUpdateUser = (data) => {
  if (data.email && (typeof data.email !== 'string' || !data.email.includes('@'))) {
    return { error: 'Valid email address is required if updating email' };
  }
  if (data.role && !['citizen', 'responder', 'commander', 'admin'].includes(data.role)) {
    return { error: 'Role must be one of: citizen, responder, commander, admin' };
  }
  return { error: null };
};

module.exports = {
  validateCreateUser,
  validateUpdateUser,
};
