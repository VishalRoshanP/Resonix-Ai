const mongoose = require('mongoose');

const confidenceScoreRecordSchema = new mongoose.Schema(
  {
    scoreId: {
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
    fieldConfidenceScores: {
      disaster: { type: Number, min: 0, max: 1, default: 0.95 },
      severity: { type: Number, min: 0, max: 1, default: 0.95 },
      urgency: { type: Number, min: 0, max: 1, default: 0.95 },
      people: { type: Number, min: 0, max: 1, default: 0.90 },
      location: { type: Number, min: 0, max: 1, default: 0.99 },
    },
    overallConfidence: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.94,
    },
    computedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('ConfidenceScoreRecord', confidenceScoreRecordSchema);
