const mongoose = require('mongoose');

const personnelSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      required: true,
    },
    callsign: {
      type: String,
      unique: true,
      required: true,
    },
    sector: {
      type: String,
      default: 'Sector 7',
    },
    status: {
      type: String,
      enum: ['active', 'in-transit', 'standby', 'offline'],
      default: 'active',
    },
    biometrics: {
      heartRate: { type: Number },
      bodyTemp: { type: Number },
      oxygenSat: { type: Number },
      stressLevel: { type: String, enum: ['low', 'moderate', 'high', 'critical'], default: 'low' },
    },
    signalStrength: {
      type: Number,
      min: 0,
      max: 5,
      default: 5,
    },
    lastCheckIn: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Personnel', personnelSchema);
