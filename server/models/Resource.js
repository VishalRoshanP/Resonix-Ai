const mongoose = require('mongoose');

/**
 * Authoritative Emergency Resource Schema for RESONIX AI
 * 
 * Supports real operational resources:
 * - Rescue teams, Medical teams, Fire response teams, Water rescue teams,
 *   Search and rescue teams, Ambulances, Rescue equipment.
 * 
 * Strict statuses:
 * - AVAILABLE, ALLOCATED, EN ROUTE, ON SCENE, BUSY, OFFLINE
 */
const resourceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Resource name is required'],
      trim: true,
    },
    type: {
      type: String,
      required: [true, 'Resource type is required'],
      trim: true,
      uppercase: true,
    },
    category: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: ['AVAILABLE', 'ALLOCATED', 'EN ROUTE', 'ON SCENE', 'BUSY', 'OFFLINE'],
      default: 'AVAILABLE',
      uppercase: true,
    },
    capacity: {
      type: String,
      default: null,
      trim: true,
    },
    location: {
      type: String,
      default: null,
      trim: true,
    },
    gpsCoordinates: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },
    assignedIncidentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Incident',
      default: null,
    },
    currentMission: {
      type: String,
      default: null,
      trim: true,
    },
    assignedAt: {
      type: Date,
      default: null,
    },
    assignedBy: {
      type: String,
      default: null,
    },
    etaMinutes: {
      type: Number,
      default: null,
    },
    notes: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to ensure category matches type if not provided
resourceSchema.pre('save', function (next) {
  if (!this.category) {
    this.category = this.type;
  }
  if (this.status) {
    this.status = this.status.toUpperCase();
  }
  next();
});

module.exports = mongoose.model('Resource', resourceSchema);
