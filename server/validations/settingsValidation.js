const validateUpdateSettings = (data) => {
  if (data.theme && !['light', 'dark', 'system'].includes(data.theme)) {
    return { error: 'Theme must be light, dark, or system' };
  }
  if (data.language && typeof data.language !== 'string') {
    return { error: 'Language must be a valid string code' };
  }
  if (data.notifications && typeof data.notifications !== 'object') {
    return { error: 'Notifications configuration must be an object' };
  }
  return { error: null };
};

module.exports = {
  validateUpdateSettings,
};
