const validateCreateEmergency = (data) => {
  const errors = [];

  if (!data || typeof data !== 'object') {
    errors.push('Emergency payload must be an object');
    return { error: errors.join('; ') };
  }

  if (data.packetId && typeof data.packetId !== 'string') {
    errors.push('Packet ID must be a valid string');
  }

  if (data.selectedLanguage && typeof data.selectedLanguage !== 'string') {
    errors.push('Selected language must be a string code');
  }

  return { error: errors.length > 0 ? errors.join('; ') : null };
};

const validateLocation = (data) => {
  const errors = [];

  if (!data) {
    errors.push('Location payload is required');
    return { error: errors.join('; ') };
  }

  if (data.latitude !== undefined && data.latitude !== null && isNaN(Number(data.latitude))) {
    errors.push('Latitude must be a valid number');
  }

  if (data.longitude !== undefined && data.longitude !== null && isNaN(Number(data.longitude))) {
    errors.push('Longitude must be a valid number');
  }

  return { error: errors.length > 0 ? errors.join('; ') : null };
};

module.exports = {
  validateCreateEmergency,
  validateLocation,
};
