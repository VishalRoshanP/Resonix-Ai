const mongoose = require('mongoose');

const aiDecisionRecordSchema = new mongoose.Schema(
  {
    decisionId: {
      type: String,
      required: true,
      unique: true,
      default: () => `dec_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    },
    incidentId: {
      type: String,
      default: null,
      index: true,
    },
    toolSelected: {
      type: String,
      required: [true, 'Tool selected is required'],
      index: true,
    },
    parameters: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    confidence: {
      type: Number,
      required: [true, 'Confidence score is required'],
      min: 0,
      max: 1,
    },
    reasoning: {
      type: String,
      required: [true, 'Reasoning justification is required'],
    },
    executionResult: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      enum: ['SUCCESS', 'FAILED', 'REJECTED'],
      default: 'SUCCESS',
    },
    gatesPassed: {
      type: Number,
      default: 6,
    },
    user: {
      type: String,
      default: 'Gemma AI Engine',
    },
    role: {
      type: String,
      default: 'system_operator',
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('AiDecisionRecord', aiDecisionRecordSchema);
