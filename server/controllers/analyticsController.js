const ApiResponse = require('../utils/apiResponse');
const Incident = require('../models/Incident');
const EmergencyPacket = require('../models/EmergencyPacket');

/**
 * @route   GET /api/analytics
 * @desc    Get system analytics and intelligence reporting data
 * @access  Private (Commander / Admin)
 */
const getAnalytics = async (req, res, next) => {
  try {
    const range = req.query.range || '24h';

    let criticalCount = 0;
    let highCount = 0;
    let mediumCount = 0;
    let lowCount = 0;
    let totalIncidents = 0;
    let aiPredictionsCount = 0;

    const isIncidentReady = Incident?.db?.readyState === 1;
    const isPacketReady = EmergencyPacket?.db?.readyState === 1;

    const [incidents, predictionsCount] = await Promise.all([
      isIncidentReady
        ? Incident.find({}).select('severity priority').maxTimeMS(5000).lean().catch(() => [])
        : Promise.resolve([]),
      isPacketReady
        ? EmergencyPacket.countDocuments({
            $or: [
              { gemmaAnalysis: { $ne: null } },
              { 'responseLifecycle.aiCompletedAt': { $ne: null } },
            ],
          }).maxTimeMS(5000).catch(() => 0)
        : Promise.resolve(0),
    ]);

    totalIncidents = incidents.length;
    aiPredictionsCount = predictionsCount;

    incidents.forEach((inc) => {
      const sev = (inc.severity || inc.priority || '').toUpperCase();
      if (sev === 'CRITICAL') criticalCount += 1;
      else if (sev === 'HIGH' || sev === 'SEVERE') highCount += 1;
      else if (sev === 'MEDIUM' || sev === 'MODERATE' || sev === 'WARNING') mediumCount += 1;
      else lowCount += 1;
    });

    const analytics = {
      range,
      totalIncidents,
      incidentsBySeverity: {
        critical: criticalCount,
        high: highCount,
        medium: mediumCount,
        low: lowCount,
      },
      responseTimesAverageMinutes: null,
      resourceUtilizationRatePercent: null,
      meshNetworkUptimePercent: totalIncidents > 0 ? 100 : null,
      aiPredictionsCount,
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
