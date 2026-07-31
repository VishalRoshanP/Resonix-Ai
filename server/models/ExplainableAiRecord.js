const mongoose = require('mongoose');

const explainableAiRecordSchema = new mongoose.Schema(
  {
    explanationId: {
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
    disasterExplanation: { type: String, required: true },
    urgencyExplanation: { type: String, required: true },
    severityExplanation: { type: String, default: '' },
    peopleExplanation: { type: String, default: '' },
    medicalExplanation: { type: String, default: '' },
    hazardsExplanation: { type: String, default: '' },
    fieldRationales: { type: Object, default: {} },
    gemmaModel: { type: String, default: 'google/gemma-4-e4b-it' },
    generatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('ExplainableAiRecord', explainableAiRecordSchema);
