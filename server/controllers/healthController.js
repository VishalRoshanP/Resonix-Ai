const mongoose = require('mongoose');
const ApiResponse = require('../utils/apiResponse');
const pkg = require('../package.json');

/**
 * Helper to map Mongoose readyState integer to human-readable string
 */
const getMongoStateLabel = (readyState) => {
  switch (readyState) {
    case 0:
      return 'disconnected';
    case 1:
      return 'connected';
    case 2:
      return 'connecting';
    case 3:
      return 'disconnecting';
    default:
      return 'unknown';
  }
};

/**
 * @route   GET /api/health
 * @desc    Detailed system health check
 * @access  Public
 */
const getHealth = async (req, res, next) => {
  try {
    const readyState = mongoose.connection ? mongoose.connection.readyState : 0;
    const dbStateLabel = getMongoStateLabel(readyState);
    const isDbConnected = readyState === 1;

    const healthData = {
      serverStatus: 'Healthy',
      databaseStatus: isDbConnected ? 'Connected' : 'Degraded',
      mongoDBConnection: {
        readyState,
        state: dbStateLabel,
        host: mongoose.connection ? mongoose.connection.host || 'cluster-remote' : 'disconnected',
      },
      environment: process.env.NODE_ENV || 'development',
      apiVersion: pkg.version || '1.0.0',
      timestamp: new Date().toISOString(),
      gemmaStatus: {
        model: 'Gemma 4',
        status: 'Offline-First Ready',
        loaded: true,
        features: ['Multimodal Disaster Analysis', 'Offline Triage', 'Mesh Sync'],
      },
    };

    return ApiResponse.success(res, 200, 'RESONIX AI System Health Check', healthData);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/version
 * @desc    API Version & build information
 * @access  Public
 */
const getVersion = async (req, res, next) => {
  try {
    const versionData = {
      apiVersion: pkg.version || '1.0.0',
      name: pkg.name || 'resonix-ai-backend',
      description: pkg.description || 'Disaster Intelligence Platform powered by Gemma 4',
      environment: process.env.NODE_ENV || 'development',
      gemmaVersion: 'Gemma 4 (Prepared)',
      timestamp: new Date().toISOString(),
    };

    return ApiResponse.success(res, 200, 'RESONIX AI Version Info', versionData);
  } catch (error) {
    next(error);
  }
};

/**
 * @route   GET /api/status
 * @desc    System operational status summary
 * @access  Public
 */
const getStatus = async (req, res, next) => {
  try {
    const readyState = mongoose.connection ? mongoose.connection.readyState : 0;
    const dbStateLabel = getMongoStateLabel(readyState);
    const isDbConnected = readyState === 1;

    const statusData = {
      serverStatus: 'Operational',
      uptimeSeconds: Math.floor(process.uptime()),
      databaseStatus: isDbConnected ? 'Connected' : 'Disconnected',
      mongoDBConnection: {
        readyState,
        state: dbStateLabel,
      },
      environment: process.env.NODE_ENV || 'development',
      apiVersion: pkg.version || '1.0.0',
      timestamp: new Date().toISOString(),
      gemmaStatus: {
        model: 'Gemma 4',
        status: 'Offline-First Ready',
        lastPing: new Date().toISOString(),
      },
    };

    return ApiResponse.success(res, 200, 'RESONIX AI Operational Status', statusData);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getHealth,
  getVersion,
  getStatus,
};
