/**
 * Multi-Citizen Incident Fusion Controller for RESONIX AI
 * 
 * Provides HTTP endpoints for responder dashboards and command systems
 * to retrieve correlated disaster clusters derived from real MongoDB incidents.
 */

const ApiResponse = require('../utils/apiResponse');
const incidentFusionApiService = require('../services/incidentFusionApiService');

/**
 * @route   GET /api/v1/incidents/fusion
 * @route   GET /api/v1/fusion/clusters
 * @desc    Get operational Multi-Citizen Incident Fusion clusters from live MongoDB records
 * @access  Public / Private (Responders, Commanders, Dashboard)
 */
const getIncidentFusionClusters = async (req, res, next) => {
  try {
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0',
    });

    const statusFilter = req.query.status || null;
    const clusters = await incidentFusionApiService.getFusionClusters({ status: statusFilter });

    const multiCitizenClustersCount = clusters.filter((c) => c.reportCount > 1).length;

    return ApiResponse.success(res, 200, 'Incident fusion clusters retrieved successfully', {
      clusters,
      data: clusters,
      totalClusters: clusters.length,
      multiCitizenClustersCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   POST /api/v1/fusion/cluster-reports
 * @route   POST /api/v1/incidents/cluster-reports
 * @desc    Group citizen reports into geographic and time-based incident clusters
 * @access  Public / Private
 */
const clusterReports = async (req, res, next) => {
  try {
    const rawReports = req.body.reports || req.body.incidents || req.body.data || [];
    if (!Array.isArray(rawReports)) {
      return ApiResponse.error(res, 400, 'Invalid request payload: reports array is required.');
    }

    const options = {
      clusterRadiusMeters: req.body.clusterRadiusMeters || req.body.radiusMeters || req.body.maxDistanceMeters,
      maxTimeDeltaMinutes: req.body.maxTimeDeltaMinutes || req.body.timeWindowMinutes,
    };

    const clusters = incidentFusionApiService.clusterReports(rawReports, options);
    const multiCitizenClustersCount = clusters.filter((c) => c.numberOfReports > 1).length;

    return ApiResponse.success(res, 200, 'Reports clustered successfully', {
      clusters,
      data: clusters,
      totalClusters: clusters.length,
      multiCitizenClustersCount,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getIncidentFusionClusters,
  clusterReports,
};
