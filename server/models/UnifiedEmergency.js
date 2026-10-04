const mongoose = require('mongoose');

const fieldWithConfidenceSchema = new mongoose.Schema(
  {
    value: mongoose.Schema.Types.Mixed,
    confidence: { type: Number, min: 0, max: 1, default: null },
    sources: [{ type: String }],
  },
  { _id: false }
);

const unifiedEmergencySchema = new mongoose.Schema(
  {
    unifiedEmergencyId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    primaryDisasterType: fieldWithConfidenceSchema,
    summary: fieldWithConfidenceSchema,
    shortSummary: {
      type: String,
      default: '',
    },
    shortSummaryLines: [
      {
        type: String,
      },
    ],
    detailedAiOutput: {
      type: Object,
      default: {},
    },
    explainableAi: {
      disasterExplanation: String,
      urgencyExplanation: String,
      severityExplanation: String,
      peopleExplanation: String,
      medicalExplanation: String,
      hazardsExplanation: String,
      fieldRationales: Object,
      model: String,
      generatedAt: Date,
    },
    severity: fieldWithConfidenceSchema,
    urgencyTier: fieldWithConfidenceSchema,
    peopleCount: fieldWithConfidenceSchema,
    childrenCount: fieldWithConfidenceSchema,
    medicalNeeds: fieldWithConfidenceSchema,
    visualHazards: fieldWithConfidenceSchema,
    locationData: {
      hasLocation: { type: Boolean, default: false },
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      accuracyMeters: { type: Number, default: null },
      confidence: { type: Number, min: 0, max: 1, default: null },
      source: { type: String, default: 'GPS_HARDWARE' },
    },
    language: {
      value: { type: String, default: 'en' },
      confidence: { type: Number, min: 0, max: 1, default: null },
      source: { type: String, default: 'LANGUAGE_CONTEXT' },
    },
    inputsProcessed: {
      voice: { type: Boolean, default: false },
      image: { type: Boolean, default: false },
      text: { type: Boolean, default: false },
      gps: { type: Boolean, default: false },
      language: { type: Boolean, default: false },
    },
    fusionModel: {
      type: String,
      default: 'resonix-disaster-intelligence',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('UnifiedEmergency', unifiedEmergencySchema);
