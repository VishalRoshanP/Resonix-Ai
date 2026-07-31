const mongoose = require('mongoose');

const emergencyReportSchema = new mongoose.Schema(
  {
    reportId: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    packetId: {
      type: String,
      index: true,
      trim: true,
    },
    userId: {
      type: String,
      default: 'ANONYMOUS_CITIZEN',
    },
    rawText: {
      type: String,
      default: '',
    },
    audioReference: {
      type: String,
      default: null,
    },
    photoReference: {
      type: String,
      default: null,
    },
    gpsCoordinates: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      accuracyMeters: { type: Number, default: null },
      status: { type: String, default: 'NO_GPS' },
    },
    selectedLanguage: {
      type: String,
      default: 'en',
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('EmergencyReport', emergencyReportSchema);
