/**
 * WeatherAlert Model
 * 
 * Persists official meteorological warnings, extreme hazard alerts, and historical event lifecycle in MongoDB.
 * Decoupled and isolated model for SIH26068 Weather Intelligence.
 */

const mongoose = require('mongoose');

const weatherAlertSchema = new mongoose.Schema(
  {
    alertId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    fingerprint: {
      type: String,
      required: true,
      index: true,
    },
    alertType: {
      type: String,
      required: true,
      enum: [
        'CYCLONE',
        'SEVERE_THUNDERSTORM',
        'FLASH_FLOOD',
        'HEAVY_RAINFALL',
        'EXTREME_HEAT',
        'HIGH_WIND',
        'COLD_WAVE',
        'STORM_SURGE',
        'HAILSTORM',
        'WEATHER_HAZARD',
      ],
      default: 'WEATHER_HAZARD',
      index: true,
    },
    severity: {
      type: String,
      required: true,
      enum: ['CRITICAL', 'SEVERE', 'WARNING', 'ADVISORY', 'WATCH', 'NORMAL'],
      default: 'WARNING',
      index: true,
    },
    headline: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    affectedArea: {
      name: { type: String, required: true },
      center: {
        latitude: { type: Number, required: true },
        longitude: { type: Number, required: true },
      },
      radiusKm: { type: Number, default: 25 },
      boundingBox: {
        minLat: { type: Number },
        maxLat: { type: Number },
        minLon: { type: Number },
        maxLon: { type: Number },
      },
    },
    issueTime: {
      type: Date,
      required: true,
      default: Date.now,
    },
    startTime: {
      type: Date,
      required: true,
      default: Date.now,
    },
    expiryTime: {
      type: Date,
      required: true,
      index: true,
    },
    source: {
      type: String,
      default: 'India Meteorological Department (IMD) / Open-Meteo Ensemble',
    },
    recommendedAction: {
      type: String,
      required: true,
    },
    conciseAdvisory: {
      type: String,
      default: '',
    },
    aiExplanation: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'UPDATED', 'EXPIRED', 'CANCELLED'],
      default: 'ACTIVE',
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for querying active alerts by location and expiry
weatherAlertSchema.index({ status: 1, expiryTime: 1 });
weatherAlertSchema.index({ 'affectedArea.center.latitude': 1, 'affectedArea.center.longitude': 1 });

const WeatherAlert = mongoose.models.WeatherAlert || mongoose.model('WeatherAlert', weatherAlertSchema);

module.exports = WeatherAlert;
