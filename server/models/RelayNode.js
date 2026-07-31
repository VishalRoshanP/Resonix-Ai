const mongoose = require('mongoose');

const relayNodeSchema = new mongoose.Schema(
  {
    nodeId: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    locationSector: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'degraded', 'offline'],
      default: 'active',
    },
    signalStrength: {
      type: Number,
      min: 0,
      max: 5,
      default: 5,
    },
    hopCount: {
      type: Number,
      default: 1,
    },
    lastBroadcast: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('RelayNode', relayNodeSchema);
