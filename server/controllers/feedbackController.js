const Feedback = require('../models/Feedback');
const ApiResponse = require('../utils/apiResponse');
const logger = require('../utils/logger');

/**
 * Submit Citizen Feedback
 * @route POST /api/feedback
 * @access Public
 */
const submitFeedback = async (req, res, next) => {
  try {
    const { message, citizenId, citizenName, rating, category, deviceInfo } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return ApiResponse.error(res, 400, 'Feedback message is required and cannot be empty.');
    }

    const newFeedback = await Feedback.create({
      citizenId: citizenId || 'anonymous_citizen',
      citizenName: citizenName || 'Citizen User',
      message: message.trim(),
      rating: Number(rating) || 5,
      category: category || 'GENERAL',
      deviceInfo: deviceInfo || {},
    });

    logger.info(`[FeedbackController] New citizen feedback saved (ID: ${newFeedback._id})`);

    return ApiResponse.success(res, 201, 'Feedback sent successfully.', {
      feedbackId: newFeedback._id,
      createdAt: newFeedback.createdAt,
    });
  } catch (error) {
    logger.error(`[FeedbackController] Failed to submit feedback: ${error.message}`);
    next(error);
  }
};

/**
 * Get All Feedback (For Admin / Responders)
 * @route GET /api/feedback
 * @access Public / Private
 */
const getAllFeedback = async (req, res, next) => {
  try {
    const list = await Feedback.find().sort({ createdAt: -1 }).limit(100).lean();
    return ApiResponse.success(res, 200, 'Feedback retrieved successfully.', { feedback: list });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  submitFeedback,
  getAllFeedback,
};
