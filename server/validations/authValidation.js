const validateRegister = (data) => {
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    return { error: 'Name is required' };
  }
  if (!data.email || typeof data.email !== 'string' || !data.email.includes('@')) {
    return { error: 'Valid email address is required' };
  }
  if (!data.password || typeof data.password !== 'string' || data.password.length < 6) {
    return { error: 'Password must be at least 6 characters long' };
  }
  if (data.role && !['citizen', 'responder', 'commander', 'admin'].includes(data.role)) {
    return { error: 'Role must be one of: citizen, responder, commander, admin' };
  }
  if (data.language && typeof data.language !== 'string') {
    return { error: 'Language must be a valid string code (e.g., en, es)' };
  }
  if (data.phone && typeof data.phone !== 'string') {
    return { error: 'Phone must be a valid string' };
  }
  return { error: null };
};

const validateLogin = (data) => {
  if (!data.email || typeof data.email !== 'string' || !data.email.includes('@')) {
    return { error: 'Valid email address is required' };
  }
  if (!data.password || typeof data.password !== 'string') {
    return { error: 'Password is required' };
  }
  return { error: null };
};

module.exports = {
  validateRegister,
  validateLogin,
};
