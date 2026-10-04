const validateRegister = (data = {}) => {
  if (!data.name || typeof data.name !== 'string' || data.name.trim().length === 0) {
    return { error: 'Name is required' };
  }
  if (!data.email || typeof data.email !== 'string' || !data.email.includes('@')) {
    return { error: 'Valid email address is required' };
  }
  if (!data.password || typeof data.password !== 'string' || data.password.length < 6) {
    return { error: 'Password must be at least 6 characters long' };
  }
  if (data.role) {
    const validRoles = ['citizen', 'responder', 'coordinator', 'commander', 'admin', 'administrator'];
    if (!validRoles.includes(String(data.role).toLowerCase())) {
      return { error: 'Role must be one of: citizen, responder, coordinator, commander, admin' };
    }
  }
  if (data.language && typeof data.language !== 'string') {
    return { error: 'Language must be a valid string code (e.g., en, ta)' };
  }
  if (data.phone && typeof data.phone !== 'string') {
    return { error: 'Phone must be a valid string' };
  }
  return { error: null };
};

const validateLogin = (data = {}) => {
  const identifier = data.email || data.badgeId || data.username || data.identifier;
  if (!identifier || typeof identifier !== 'string' || identifier.trim().length === 0) {
    return { error: 'Email address or Badge ID is required to log in' };
  }
  if (!data.password || typeof data.password !== 'string' || data.password.trim().length === 0) {
    return { error: 'Password is required' };
  }
  return { error: null };
};

const validateForgotPassword = (data = {}) => {
  const identifier = data.email || data.badgeId || data.identifier;
  if (!identifier || typeof identifier !== 'string' || identifier.trim().length === 0) {
    return { error: 'Email address or Badge ID is required for password recovery' };
  }
  return { error: null };
};

const validateResetPassword = (data = {}) => {
  const identifier = data.email || data.badgeId || data.identifier;
  const otp = data.otp || data.otpCode;
  if (!identifier || typeof identifier !== 'string' || identifier.trim().length === 0) {
    return { error: 'Email address or Badge ID is required' };
  }
  if (!otp || typeof otp !== 'string' || otp.trim().length === 0) {
    return { error: 'Verification OTP code is required' };
  }
  if (!data.newPassword || typeof data.newPassword !== 'string' || data.newPassword.length < 6) {
    return { error: 'New password must be at least 6 characters long' };
  }
  return { error: null };
};

module.exports = {
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
};

