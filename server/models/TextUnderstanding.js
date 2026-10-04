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
      enum: [
        'FLOOD', 'FIRE', 'MEDICAL', 'BUILDING_COLLAPSE', 'CYCLONE_STORM', 'CYCLONE', 'STORM',
        'EARTHQUAKE', 'LANDSLIDE', 'TSUNAMI', 'AVALANCHE', 'LIGHTNING', 'THUNDERSTORM', 'DUSTSTORM',
        'SQUALL', 'HEATWAVE', 'COLDWAVE', 'DROUGHT', 'FOREST_FIRE', 'URBAN_FLOOD',
        'CHEMICAL_EMERGENCY', 'BIOLOGICAL_EMERGENCY', 'NUCLEAR_RADIOLOGICAL_EMERGENCY', 'AIR_POLLUTION_SMOG',
        'OTHER', 'GENERAL'
      ],
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
      default: 'resonix-disaster-intelligence',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('TextUnderstanding', textUnderstandingSchema);
