const validateCreateIncident = (data) => {
  if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
    return { error: 'Incident title is required' };
  }
  if (!data.severity || !['low', 'medium', 'high', 'critical'].includes(data.severity)) {
    return { error: 'Severity must be one of: low, medium, high, critical' };
  }
  if (!data.location || (typeof data.location !== 'string' && typeof data.location !== 'object')) {
    return { error: 'Valid incident location is required' };
  }
  return { error: null };
};

const validateUpdateIncident = (data) => {
  if (data.severity) {
    const normSev = String(data.severity).toLowerCase();
    if (!['low', 'medium', 'high', 'critical', 'warning', 'moderate'].includes(normSev)) {
      return { error: 'Severity must be one of: low, medium, high, critical, warning, moderate' };
    }
  }
  if (data.status) {
    const normStatus = String(data.status).toLowerCase();
    if (!['open', 'in_progress', 'dispatched', 'en_route', 'on_scene', 'active', 'acknowledged', 'resolved', 'completed', 'closed', 'cancelled'].includes(normStatus)) {
      return { error: 'Invalid incident status' };
    }
  }
  return { error: null };
};

module.exports = {
  validateCreateIncident,
  validateUpdateIncident,
};
