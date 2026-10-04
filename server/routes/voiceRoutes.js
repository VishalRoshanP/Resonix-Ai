const express = require('express');
const router = express.Router();
const voiceController = require('../controllers/voiceController');
const {
  voiceLimiter,
  aiReasoningLimiter,
  ttsLimiter,
  translationLimiter,
} = require('../middlewares/rateLimitMiddleware');

// Preserved existing voice processing route
router.post('/process', voiceLimiter, voiceController.processVoiceAudio);

// Phase 4: Optional Real-Time Voice Capabilities
router.post('/live-transcribe', voiceLimiter, voiceController.handleLiveTranscribe);
router.post('/live-conversation', aiReasoningLimiter, voiceController.handleLiveVoiceConversation);
router.post('/synthesize', ttsLimiter, voiceController.handleSynthesizeSpeech);
router.post('/live-translate', translationLimiter, voiceController.handleLiveTranslate);

module.exports = router;

