export function validateEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
}

export function validatePhone(phone) {
  if (!phone || typeof phone !== 'string') return false;
  const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
  return cleaned.length >= 7 && cleaned.length <= 15;
}

export function validateCoordinates(lat, lng) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  return !isNaN(latitude) && !isNaN(longitude) && latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

export function validateSOSPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { valid: false, message: 'Invalid payload structure' };
  }
  if (!payload.latitude || !payload.longitude) {
    return { valid: false, message: 'Missing required GPS location' };
  }
  if (!validateCoordinates(payload.latitude, payload.longitude)) {
    return { valid: false, message: 'Coordinates out of valid range' };
  }
  return { valid: true };
}
