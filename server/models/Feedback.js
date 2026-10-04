const mongoose = require('mongoose');

/**
 * Feedback Model for RESONIX AI
 * Stores citizen and user feedback, ratings, and application suggestions in MongoDB.
 */
const feedbackSchema = new mongoose.Schema(
  {
    citizenId: {
      type: String,
      default: 'anonymous_citizen',
      trim: true,
    },
    citizenName: {
      type: String,
      default: 'Citizen User',
      trim: true,
    },
    message: {
      type: String,
      required: [true, 'Feedback message is required'],
      trim: true,
      maxlength: [2000, 'Feedback cannot exceed 2000 characters'],
    },
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: 5,
    },
    category: {
      type: String,
      default: 'GENERAL',
      trim: true,
    },
    deviceInfo: {
      type: Object,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Feedback', feedbackSchema);
