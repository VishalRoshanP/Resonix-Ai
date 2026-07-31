const mongoose = require('mongoose');

const voiceUnderstandingSchema = new mongoose.Schema(
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
    disasterType: {
      type: String,
      enum: ['FLOOD', 'FIRE', 'EARTHQUAKE', 'LANDSLIDE', 'MEDICAL_EMERGENCY', 'CYCLONE', 'OTHER'],
      default: 'OTHER',
    },
    summary: {
      type: String,
      required: [true, 'Emergency summary is required'],
    },
    peopleCount: {
      type: Number,
      default: 0,
    },
    childrenCount: {
      type: Number,
      default: 0,
    },
    medicalNeed: {
      type: Boolean,
      default: false,
    },
    urgency: {
      type: String,
      enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
      default: 'HIGH',
    },
    possibleHazards: [
      {
        type: String,
      },
    ],
    language: {
      type: String,
      enum: ['en', 'ta', 'hi', 'te', 'kn', 'ml', 'bn'],
      default: 'en',
    },
    confidenceScore: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.95,
    },
    rawTranscript: {
      type: String,
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

module.exports = mongoose.model('VoiceUnderstanding', voiceUnderstandingSchema);
