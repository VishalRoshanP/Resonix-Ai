const mongoose = require('mongoose');

const emergencySummaryRecordSchema = new mongoose.Schema(
  {
    summaryId: {
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
    shortSummary: {
      type: String,
      required: true,
    },
    shortSummaryLines: [
      {
        type: String,
      },
    ],
    fullSummary: {
      type: String,
      default: '',
    },
    generatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('EmergencySummaryRecord', emergencySummaryRecordSchema);
