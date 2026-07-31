const validateDashboardQuery = (data) => {
  if (data.timeframe && !['24h', '7d', '30d', 'all'].includes(data.timeframe)) {
    return { error: 'Timeframe must be one of: 24h, 7d, 30d, all' };
  }
  return { error: null };
};

module.exports = {
  validateDashboardQuery,
};
