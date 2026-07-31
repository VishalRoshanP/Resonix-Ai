const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Incident title is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Incident description is required'],
    },
    type: {
      type: String,
      enum: ['seismic', 'flood', 'fire', 'structural', 'medical', 'general'],
      default: 'general',
    },
    severity: {
      type: String,
      enum: ['low', 'moderate', 'warning', 'critical'],
      default: 'warning',
    },
    sector: {
      type: String,
      required: true,
      default: 'Sector 7',
    },
    location: {
      lat: { type: Number },
      lng: { type: Number },
      address: { type: String },
    },
    status: {
      type: String,
      enum: ['reported', 'active', 'monitoring', 'acknowledged', 'resolved', 'cancelled'],
      default: 'active',
    },
    assignedResponders: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    aiAnalysis: {
      gemmaConfidence: { type: Number, default: null },
      confidenceScore: { type: Number, default: null },
      disasterCategory: { type: String, default: 'FLOOD' },
      disasterType: { type: String, default: 'FLOOD' },
      severity: { type: String, default: 'CRITICAL' },
      priority: { type: String, default: 'HIGH' },
      summary: { type: String },
      predictedEvolution: { type: String },
      recommendedActions: [{ type: String }],
      recommendedResponseTeam: { type: String },
      resourceRecommendations: [{ type: String }],
      explanation: { type: String },
      reasoningExplanation: { type: String },
      explainability: {
        language: { type: String, default: null },
        languageReason: { type: String, default: null },
        category: { type: String, default: null },
        categoryReason: { type: String, default: null },
        severity: { type: String, default: null },
        severityReason: { type: String, default: null },
        keyPhrases: [{ type: String }],
        hazards: [{ type: String }],
        peopleAffected: { type: Number, default: null },
        translation: { type: String, default: null },
        recommendedResources: { type: String, default: null },
        confidence: { type: Number, default: null },
      },
      visionAnalysis: { type: Object },
      ragReferences: [{ type: String }],
      gemmaStatus: { type: String },
      model: { type: String },
      aiAvailable: { type: Boolean },
    },
    gemmaAnalysis: { type: Object, default: {} },
    relayAnalytics: {
      originDevice: { type: String, default: null },
      originUser: { type: String, default: 'usr_guest' },
      relayCount: { type: Number, default: 0 },
      relayHistory: [
        {
          relayNodeId: String,
          relayedAt: Date,
          senderDeviceId: String,
          rssi: Number,
        },
      ],
      relayPath: [{ type: String }],
    },
    completedAt: { type: Date, default: null },
    completedBy: { type: String, default: null },
    completionNotes: { type: String, default: null },
    resolutionSummary: { type: String, default: null },
    resolutionTime: { type: Number, default: 0 },
    imageAnalysis: { type: Object, default: null },
    photoReference: { type: Object, default: null },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Incident', incidentSchema);
