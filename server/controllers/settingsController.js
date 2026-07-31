const ApiResponse = require('../utils/apiResponse');

/**
 * @route   GET /api/settings
 * @desc    Get global or user application settings
 * @access  Private / Public
 */
const getSettings = async (req, res, next) => {
  try {
    const settings = {
      theme: 'dark',
      language: 'en',
      notifications: {
        email: true,
        push: true,
        smsCritical: true,
      },
      offlineSyncIntervalMinutes: 5,
      gemmaModelConfig: {
        version: 'Gemma 4',
        offlineInferenceEnabled: true,
        maxTokens: 2048,
      },
      updatedAt: new Date().toISOString(),
    };

    return ApiResponse.success(res, 200, 'Settings retrieved successfully', { settings });
  } catch (error) {
    next(error);
  }
};

/**
 * @route   PUT /api/settings
 * @desc    Update system settings
 * @access  Private (Admin / Commander)
 */
const updateSettings = async (req, res, next) => {
  try {
    const updatedSettings = {
      ...req.body,
      updatedAt: new Date().toISOString(),
    };

    return ApiResponse.success(res, 200, 'Settings updated successfully', { settings: updatedSettings });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getSettings,
  updateSettings,
};
