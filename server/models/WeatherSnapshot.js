/**
 * WeatherSnapshot Model
 * 
 * Persists the latest valid meteorological data snapshots in MongoDB across backend restarts.
 * Decoupled model strictly dedicated to SIH26068 Weather Intelligence.
 */

const mongoose = require('mongoose');

const weatherSnapshotSchema = new mongoose.Schema(
  {
    gridKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
    locationName: {
      type: String,
      default: 'Unknown Location',
    },
    timezone: {
      type: String,
      default: 'UTC',
    },
    current: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    hourlyForecast: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    dailyForecast: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    warnings: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    metadata: {
      source: {
        type: String,
        default: 'Open-Meteo Meteorological Ensemble',
      },
      sourceUpdateTime: {
        type: String,
        default: () => new Date().toISOString(),
      },
      cachedAt: {
        type: String,
        default: () => new Date().toISOString(),
      },
      isStale: {
        type: Boolean,
        default: false,
      },
      ttlSeconds: {
        type: Number,
        default: 600,
      },
    },
    lastSuccessfulFetch: {
      type: Date,
      default: Date.now,
      index: true,
    },
    consecutiveFailures: {
      type: Number,
      default: 0,
    },
    providerStatus: {
      type: String,
      enum: ['HEALTHY', 'DEGRADED', 'OFFLINE'],
      default: 'HEALTHY',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('WeatherSnapshot', weatherSnapshotSchema);
