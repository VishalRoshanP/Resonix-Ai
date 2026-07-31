const mongoose = require('mongoose');

const textUnderstandingSchema = new mongoose.Schema(
  {
    packetId: {
      type: String,
      index: true,
      trim: true,
    },
    reportId: {
      type: String,
      index: true,
      trim: true,
    },
    disaster: {
      type: String,
      enum: ['FLOOD', 'FIRE', 'EARTHQUAKE', 'LANDSLIDE', 'CYCLONE', 'OTHER'],
      default: 'OTHER',
    },
    severity: {
      type: String,
      enum: ['CRITICAL', 'SEVERE', 'MODERATE', 'MINOR'],
      default: 'SEVERE',
    },
    people: {
      type: Number,
      default: 0,
    },
    children: {
      type: Number,
      default: 0,
    },
    medicalNeeds: {
      type: Boolean,
      default: false,
    },
    infrastructureDamage: {
      type: String,
      enum: ['CRITICAL', 'SEVERE', 'MODERATE', 'MINOR', 'NONE'],
      default: 'NONE',
    },
    urgency: {
      type: String,
      enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
      default: 'HIGH',
    },
    keywords: [
      {
        type: String,
      },
    ],
    confidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.95,
    },
    rawText: {
      type: String,
      required: [true, 'Raw text input is required'],
    },
    gemmaModel: {
      type: String,
      default: 'google/gemma-4-e4b-it',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('TextUnderstanding', textUnderstandingSchema);
