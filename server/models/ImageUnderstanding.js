const mongoose = require('mongoose');

const imageUnderstandingSchema = new mongoose.Schema(
  {
    photoId: {
      type: String,
      index: true,
      trim: true,
    },
    reportId: {
      type: String,
      index: true,
      trim: true,
    },
    packetId: {
      type: String,
      index: true,
      trim: true,
    },
    visibleDisaster: {
      type: String,
      enum: ['FLOOD', 'FIRE', 'EARTHQUAKE', 'LANDSLIDE', 'BUILDING_COLLAPSE', 'OTHER', 'NONE'],
      default: 'NONE',
    },
    floodDepth: {
      type: String,
      default: 'None',
    },
    fireVisible: {
      type: Boolean,
      default: false,
    },
    collapsedBuildings: {
      type: Boolean,
      default: false,
    },
    roadBlockage: {
      type: Boolean,
      default: false,
    },
    visibleInjuries: {
      type: Boolean,
      default: false,
    },
    smokePresent: {
      type: Boolean,
      default: false,
    },
    waterPresent: {
      type: Boolean,
      default: false,
    },
    vehiclesInvolved: [
      {
        type: String,
      },
    ],
    infrastructureDamage: {
      type: String,
      enum: ['CRITICAL', 'SEVERE', 'MODERATE', 'MINOR', 'NONE'],
      default: 'NONE',
    },
    confidenceScores: {
      type: Object,
      default: {},
    },
    humanVerificationRequired: {
      type: Boolean,
      default: true, // Always true (AI visual observations never replace human verification)
    },
    humanVerified: {
      type: Boolean,
      default: false,
    },
    verifiedBy: {
      type: String,
      default: null,
    },
    gemmaModel: {
      type: String,
      default: 'resonix-disaster-intelligence',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('ImageUnderstanding', imageUnderstandingSchema);
