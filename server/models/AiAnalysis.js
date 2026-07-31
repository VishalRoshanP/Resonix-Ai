const mongoose = require('mongoose');

const aiAnalysisSchema = new mongoose.Schema(
  {
    analysisId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    reportId: {
      type: String,
      ref: 'EmergencyReport',
      index: true,
    },
    packetId: {
      type: String,
      index: true,
    },
    unifiedEmergencyId: {
      type: String,
      index: true,
    },
    voiceAnalysis: {
      type: Object,
      default: null,
    },
    imageAnalysis: {
      type: Object,
      default: null,
    },
    textAnalysis: {
      type: Object,
      default: null,
    },
    gemmaModel: {
      type: String,
      default: 'google/gemma-4-e4b-it',
    },
    analyzedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('AiAnalysis', aiAnalysisSchema);
