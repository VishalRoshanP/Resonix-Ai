const mongoose = require('mongoose');

const emergencyPacketSchema = new mongoose.Schema(
  {
    packetId: {
      type: String,
      required: [true, 'Packet ID is required'],
      unique: true,
      index: true,
      trim: true,
    },
    clientRequestId: {
      type: String,
      index: true,
      trim: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    selectedLanguage: {
      type: String,
      default: 'en',
      trim: true,
    },
    audioReference: {
      hasAudio: { type: Boolean, default: false },
      audioId: { type: String, default: null },
      durationSeconds: { type: Number, default: 0 },
      mimeType: { type: String, default: 'audio/webm' },
      dataUrl: { type: String, default: null },
    },
    voiceTranscript: {
      type: String,
      default: '',
    },
    originalVoiceTranscript: {
      type: String,
      default: '',
    },
    speechRecognitionTranscript: {
      type: String,
      default: '',
    },
    transcriptScript: {
      type: String,
      default: 'Latin',
    },
    transcriptQuality: {
      type: String,
      default: 'NATIVE',
    },
    transcriptStyle: {
      type: String,
      default: 'ROMANIZED',
    },
    selectedVoiceLanguage: {
      type: String,
      default: null,
    },
    selectedVoiceLanguageCode: {
      type: String,
      default: null,
    },
    detectedLanguage: {
      type: String,
      default: 'English',
    },
    detectedLanguageCode: {
      type: String,
      default: 'en-US',
    },
    originalLanguage: {
      type: String,
      default: null,
    },
    nativeScriptTranscript: {
      type: String,
      default: '',
    },
    nativeScriptAvailable: {
      type: Boolean,
      default: false,
    },
    confidence: {
      type: Number,
      default: null,
    },
    englishTranslation: {
      type: String,
      default: '',
    },
    englishMeaning: {
      type: String,
      default: '',
    },
    meaning: {
      type: String,
      default: '',
    },
    reason: {
      type: String,
      default: '',
    },
    classificationConfidence: {
      type: String,
      default: 'HIGH',
    },
    categoryConflict: {
      type: Boolean,
      default: false,
    },
    evidenceBasis: {
      type: String,
      default: 'VOICE',
    },
    reportedOccurrenceTime: {
      type: Date,
      default: null,
    },
    needsReview: {
      type: Boolean,
      default: false,
    },
    gemmaAnalysis: {
      type: Object,
      default: null,
    },
    incidentSummary: {
      type: String,
      default: '',
    },
    priority: {
      type: String,
      default: 'HIGH',
    },
    peopleAffected: {
      type: Number,
      default: 0,
    },
    recommendedAction: {
      type: String,
      default: '',
    },
    recordingDuration: {
      type: Number,
      default: 0,
    },
    languageHint: {
      type: String,
      default: 'en-US',
    },
    photoReference: {
      hasPhoto: { type: Boolean, default: false },
      photoId: { type: String, default: null },
      mimeType: { type: String, default: 'image/jpeg' },
      formattedSize: { type: String, default: 'N/A' },
      dataUrl: { type: String, default: null },
    },
    imageAnalysis: {
      type: Object,
      default: null,
    },
    gpsCoordinates: {
      hasGps: { type: Boolean, default: false },
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      accuracyMeters: { type: Number, default: null },
      status: { type: String, default: 'GPS_UNAVAILABLE' },
    },
    offlineStatus: {
      type: Boolean,
      default: false,
    },
    internetStatus: {
      type: String,
      enum: ['ONLINE', 'OFFLINE_MESH'],
      default: 'ONLINE',
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
    category: {
      type: String,
      default: 'GENERAL',
    },
    detectedEmergencyCategory: {
      type: String,
      default: 'OTHER',
    },
    selectedCategory: {
      type: String,
      default: 'GENERAL',
    },
    citizenSelectedCategory: {
      type: String,
      default: 'GENERAL',
    },
    description: {
      type: String,
      default: '',
    },
    originalTranscript: {
      type: String,
      default: '',
    },
    translatedTranscript: {
      type: String,
      default: null,
    },
    packetStatus: {
      type: String,
      enum: ['CREATED', 'QUEUED_LOCAL', 'TRANSMITTING', 'DELIVERED', 'PENDING_GEMMA4', 'PENDING_AI_ANALYSIS', 'Pending AI Analysis', 'PROCESSING', 'RESOLVED'],
      default: 'DELIVERED',
    },
    responseLifecycle: {
      receivedAt: { type: Date, default: Date.now },
      aiCompletedAt: { type: Date, default: null },
      aiConfidence: { type: Number, default: 0.96 },
      aiProcessingDurationMs: { type: Number, default: 450 },
      reviewStartedAt: { type: Date, default: null },
      reviewer: { type: String, default: 'Command Center Officer' },
      reviewStatus: { type: String, default: 'PENDING' },
      dispatchTime: { type: Date, default: null },
      assignedTeams: [{ type: String }],
      assignedVehicles: [{ type: String }],
      arrivalTime: { type: Date, default: null },
      arrivalGps: {
        latitude: { type: Number, default: null },
        longitude: { type: Number, default: null },
      },
      responderId: { type: String, default: null },
      resolvedAt: { type: Date, default: null },
      resolutionSummary: { type: String, default: null },
      totalResponseTimeMs: { type: Number, default: 0 },
      lifecycleEvents: [
        {
          stage: String,
          status: { type: String, enum: ['Waiting', 'Current', 'Completed', 'Failed', 'Cancelled'], default: 'Completed' },
          timestamp: { type: Date, default: Date.now },
          user: String,
          role: String,
          action: String,
          reason: String,
        },
      ],
    },
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
      totalDeliveryTimeMs: { type: Number, default: 0 },
      finalUploadDevice: { type: String, default: null },
      relayPath: [{ type: String }],
    },
    acknowledgement: {
      status: {
        type: String,
        enum: ['UNACKNOWLEDGED', 'ACKNOWLEDGED'],
        default: 'UNACKNOWLEDGED',
      },
      acknowledgedAt: { type: Date, default: null },
      acknowledgedBy: { type: String, default: null },
    },
    selectedCategory: { type: String, default: 'GENERAL' },
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
      reason: { type: String, default: '' },
      keyEvidence: [{ type: String }],
      contradictionDetected: { type: Boolean, default: false },
      contradictionNote: { type: String, default: null },
      confidenceNote: { type: String, default: null },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for high-speed chronological queries (Phase 9)
emergencyPacketSchema.index({ timestamp: -1 });

module.exports = mongoose.model('EmergencyPacket', emergencyPacketSchema);
