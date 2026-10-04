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
      enum: [
        'FLOOD', 'FIRE', 'MEDICAL', 'MEDICAL_EMERGENCY', 'BUILDING_COLLAPSE', 'CYCLONE_STORM', 'CYCLONE', 'STORM',
        'EARTHQUAKE', 'LANDSLIDE', 'TSUNAMI', 'AVALANCHE', 'LIGHTNING', 'THUNDERSTORM', 'DUSTSTORM',
        'SQUALL', 'HEATWAVE', 'COLDWAVE', 'DROUGHT', 'FOREST_FIRE', 'URBAN_FLOOD',
        'CHEMICAL_EMERGENCY', 'BIOLOGICAL_EMERGENCY', 'NUCLEAR_RADIOLOGICAL_EMERGENCY', 'AIR_POLLUTION_SMOG',
        'OTHER', 'GENERAL'
      ],
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
      default: 'resonix-disaster-intelligence',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('VoiceUnderstanding', voiceUnderstandingSchema);
