const validateCreateReport = (data) => {
  if (!data.title || typeof data.title !== 'string' || data.title.trim().length === 0) {
    return { error: 'Report title is required' };
  }
  if (!data.type || typeof data.type !== 'string') {
    return { error: 'Report type is required' };
  }
  if (!data.location || (typeof data.location !== 'string' && typeof data.location !== 'object')) {
    return { error: 'Report location details are required' };
  }
  return { error: null };
};

const validateUpdateReport = (data) => {
  if (data.status && !['draft', 'submitted', 'under_review', 'resolved', 'archived'].includes(data.status)) {
    return { error: 'Invalid report status' };
  }
  return { error: null };
};

module.exports = {
  validateCreateReport,
  validateUpdateReport,
};
