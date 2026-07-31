const ApiResponse = require('../utils/apiResponse');

/**
 * @route   GET /api/analytics
 * @desc    Get system analytics and intelligence reporting data
 * @access  Private (Commander / Admin)
 */
const getAnalytics = async (req, res, next) => {
  try {
    const range = req.query.range || '24h';

    const analytics = {
      range,
      incidentsBySeverity: {
        critical: 5,
        high: 12,
        medium: 24,
        low: 8,
      },
      responseTimesAverageMinutes: 8.4,
      resourceUtilizationRatePercent: 78.5,
      meshNetworkUptimePercent: 99.9,
      aiPredictionsCount: 142,
      generatedAt: new Date().toISOString(),
    };

    return ApiResponse.success(res, 200, 'Analytics data retrieved successfully', { analytics });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAnalytics,
};
