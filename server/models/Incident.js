const mongoose = require('mongoose');

const incidentSchema = new mongoose.Schema(
  {
    packetId: {
      type: String,
      trim: true,
      index: true,
      sparse: true,
    },
    clientRequestId: {
      type: String,
      trim: true,
      unique: true,
      index: true,
      sparse: true,
    },
    title: {
      type: String,
      required: [true, 'Incident title is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Incident description is required'],
    },
    category: {
      type: String,
      trim: true,
    },
    detectedCategory: {
      type: String,
      trim: true,
    },
    detectedEmergencyCategory: {
      type: String,
      trim: true,
    },
    selectedCategory: {
      type: String,
      trim: true,
    },
    citizenSelectedCategory: {
      type: String,
      trim: true,
    },
    aiEnrichedAt: {
      type: Date,
    },
    citizenInput: {
      selectedCategory: { type: String, default: 'GENERAL' },
      voiceTranscript: { type: String, default: '' },
      textDescription: { type: String, default: '' },
      photoReference: { type: Object, default: null },
      gpsCoordinates: { type: Object, default: null },
    },
    aiAssessment: {
      category: { type: String, default: 'GENERAL' },
      severity: { type: String, default: 'HIGH' },
      priority: { type: String, default: 'HIGH' },
      confidence: { type: Number, default: 0.95 },
      meaning: { type: String, default: '' },
      reason: { type: String, default: '' },
      englishTranslation: { type: String, default: '' },
      trapped: { type: Boolean, default: false },
      hazards: [{ type: String }],
      keyEvidence: [{ type: String }],
      contradictionDetected: { type: Boolean, default: false },
      contradictionNote: { type: String, default: null },
      confidenceNote: { type: String, default: null },
    },
    type: {
      type: String,
      default: 'general',
    },
    severity: {
      type: String,
      default: 'warning',
    },
    priority: {
      type: String,
      default: 'HIGH',
    },
    peopleAffected: {
      type: Number,
      default: 0,
    },
    recordingDuration: {
      type: Number,
      default: 0,
    },
    userId: {
      type: String,
      default: 'usr_guest',
    },
    victimName: {
      type: String,
      default: 'Citizen User',
    },
    citizenName: {
      type: String,
      default: 'Citizen User',
    },
    deviceId: {
      type: String,
      default: null,
    },
    sector: {
      type: String,
      required: true,
      default: 'Sector 7',
    },
    location: {
      lat: { type: Number },
      lng: { type: Number },
      accuracy: { type: Number, default: null },
      address: { type: String },
    },
    status: {
      type: String,
      default: 'active',
    },
    assignedResponders: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    assignedUnit: { type: String, default: null },
    notes: [
      {
        text: String,
        author: String,
        createdAt: { type: Date, default: Date.now },
      },
    ],
    originalTranscript: { type: String, default: '' },
    originalVoiceTranscript: { type: String, default: '' },
    speechRecognitionTranscript: { type: String, default: '' },
    transcriptScript: { type: String, default: 'Latin' },
    transcriptQuality: { type: String, default: 'NATIVE' },
    transcriptStyle: { type: String, default: 'ROMANIZED' },
    selectedVoiceLanguage: { type: String, default: null },
    selectedVoiceLanguageCode: { type: String, default: null },
    translatedTranscript: { type: String, default: '' },
    detectedLanguage: { type: String, default: 'English' },
    detectedLanguageCode: { type: String, default: 'en-US' },
    originalLanguage: { type: String, default: null },
    nativeScriptTranscript: { type: String, default: '' },
    nativeScriptAvailable: { type: Boolean, default: false },
    confidence: { type: Number, default: null },
    englishTranslation: { type: String, default: '' },
    englishMeaning: { type: String, default: '' },
    meaning: { type: String, default: '' },
    reason: { type: String, default: '' },
    classificationConfidence: { type: String, default: 'HIGH' },
    categoryConflict: { type: Boolean, default: false },
    evidenceBasis: { type: String, default: 'VOICE' },
    reportedOccurrenceTime: { type: Date, default: null },
    needsReview: { type: Boolean, default: false },
    trapped: { type: Boolean, default: false },
    script: { type: String, default: 'Latin' },
    languageConfidence: { type: Number, default: 0.95 },
    normalizedMeaning: { type: String, default: '' },
    originalAudio: { type: String, default: null },
    audioReference: { type: Object, default: null },
    aiProcessingStatus: { type: String, default: 'PENDING' },
    aiAnalysis: { type: Object, default: {} },
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
    acknowledgement: {
      status: {
        type: String,
        enum: ['UNACKNOWLEDGED', 'ACKNOWLEDGED'],
        default: 'UNACKNOWLEDGED',
      },
      acknowledgedAt: { type: Date, default: null },
      acknowledgedBy: { type: String, default: null },
    },
    imageAnalysis: { type: Object, default: null },
    photoReference: { type: Object, default: null },
    aiTriage: { type: Object, default: null },
    originalCitizenEvidence: { type: Object, default: null },
    extractedEntities: { type: Object, default: null },
  },
  {
    timestamps: true,
  }
);

// Indexes for high-speed responder query patterns & fast idempotency
incidentSchema.index({ createdAt: -1 });
incidentSchema.index({ status: 1, createdAt: -1 });
incidentSchema.index({ severity: 1, status: 1 });
incidentSchema.index({ priority: 1, status: 1 });

module.exports = mongoose.model('Incident', incidentSchema);
