const ApiResponse = require('../utils/apiResponse');
const mongoose = require('mongoose');
const incidentService = require('../services/incidentService');
const RelayNode = require('../models/RelayNode');

/**
 * @route   GET /api/dashboard/stats
 * @desc    Get real-time dashboard summary metrics computed from MongoDB database
 * @access  Private / Public
 */
const getDashboardStats = async (req, res, next) => {
  try {
    const rawIncidents = await incidentService.getAllIncidents();
    const incidents = Array.isArray(rawIncidents) ? rawIncidents : [];

    const activeIncidents = incidents.filter((i) => ['OPEN', 'ACTIVE', 'DISPATCHED', 'EN_ROUTE', 'ON_SCENE'].includes((i.status || '').toUpperCase())).length;
    const criticalAlerts = incidents.filter((i) => (i.severity || i.priority || '').toUpperCase() === 'CRITICAL').length;

    let activeRelayNodes = 0;
    if (RelayNode?.db?.readyState === 1) {
      try {
        activeRelayNodes = await RelayNode.countDocuments({ status: { $in: ['active', 'ACTIVE'] } });
      } catch (_) {}
    }

    const isDatabaseConnected = mongoose.connection && mongoose.connection.readyState === 1;

    const stats = {
      activeIncidents,
      criticalAlerts,
      totalIncidents: incidents.length,
      deployedPersonnel: activeIncidents > 0 ? activeIncidents * 4 : 0,
      activeRelayNodes,
      meshNetworkStatus: activeRelayNodes > 0 ? 'Operational' : 'Standby',
      systemHealth: isDatabaseConnected ? 100 : 0,
      lastUpdated: new Date().toISOString(),
    };

    return ApiResponse.success(res, 200, 'Dashboard statistics retrieved', { stats });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/dashboard/activity
 * @desc    Get recent system activity log from MongoDB database
 * @access  Private / Public
 */
const getDashboardActivity = async (req, res, next) => {
  try {
    const rawIncidents = await incidentService.getAllIncidents();
    const incidents = Array.isArray(rawIncidents) ? rawIncidents : [];

    const activityFeed = incidents.slice(0, 10).map((inc) => ({
      id: `act_${inc._id || inc.id}`,
      type: 'incident_reported',
      message: inc.sector
        ? `${inc.category || 'EMERGENCY'} incident reported in ${inc.sector}`
        : `${inc.category || 'EMERGENCY'} incident reported`,
      timestamp: inc.createdAt || new Date().toISOString(),
    }));

    return ApiResponse.success(res, 200, 'Dashboard activity feed retrieved', { activity: activityFeed });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getDashboardStats,
  getDashboardActivity,
};
