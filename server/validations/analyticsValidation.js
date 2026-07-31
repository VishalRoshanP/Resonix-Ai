const validateAnalyticsQuery = (data) => {
  if (data.range && !['1h', '24h', '7d', '30d', '90d'].includes(data.range)) {
    return { error: 'Range must be one of: 1h, 24h, 7d, 30d, 90d' };
  }
  return { error: null };
};

module.exports = {
  validateAnalyticsQuery,
};
