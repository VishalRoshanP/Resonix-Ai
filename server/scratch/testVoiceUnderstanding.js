/**
 * Dedicated Voice Understanding using Gemma 4 E4B Integration Test
 */

const gemmaService = require('../services/gemma');
const voiceController = require('../controllers/voiceController');
const VoiceUnderstanding = require('../models/VoiceUnderstanding');

async function runVoiceUnderstandingTests() {
  console.log('--- STARTING VOICE UNDERSTANDING GEMMA 4 INTEGRATION TEST ---');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${message}`);
      failed++;
    }
  }

  const sampleTranscripts = [
    {
      transcript: 'Flash flood alert in Sector 4! 4 people trapped including 1 child. Medical assistance needed urgently.',
      language: 'en',
    },
    {
      transcript: 'செக்டர் 4 இல் திடீர் வெள்ளப்பெருக்கு! 2 குழந்தைகள் உட்பட 5 பேர் சிக்கியுள்ளனர்.',
      language: 'ta',
    },
    {
      transcript: 'सेक्टर 4 में आग लग गई है! 3 लोग घायल हैं और तुरंत एम्बुलेंस चाहिए।',
      language: 'hi',
    },
  ];

  for (const sample of sampleTranscripts) {
    try {
      const result = await gemmaService.analyzeVoice({
        transcript: sample.transcript,
        context: { language: sample.language },
      });

      const requiredKeys = [
        'disasterType',
        'summary',
        'peopleCount',
        'childrenCount',
        'medicalNeed',
        'urgency',
        'possibleHazards',
        'language',
        'confidenceScore',
      ];

      const hasAllKeys = requiredKeys.every((key) => key in result);
      assert(hasAllKeys, `Voice understanding output contains all 9 required keys for [${sample.language}]`);
      assert(typeof result.summary === 'string' && !result.summary.includes('```'), `Output returns clean JSON without free-form paragraph markdown codeblocks`);
      assert(typeof result.confidenceScore === 'number' && result.confidenceScore >= 0 && result.confidenceScore <= 1, `Confidence score is a valid float: ${result.confidenceScore}`);
    } catch (err) {
      assert(false, `Voice understanding failed for [${sample.language}]: ` + err.message);
    }
  }

  // Test Controller & Separate AI Storage
  try {
    const mockRes = {
      statusCode: 200,
      data: null,
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.data = payload; return this; }
    };

    await voiceController.processVoiceAudio(
      {
        body: {
          transcript: 'Flash flood in sector 4. 2 people stranded.',
          packetId: 'pkt_test_999',
          context: { language: 'en' },
        },
      },
      mockRes,
      (err) => { throw err; }
    );

    assert(
      mockRes.statusCode === 200 && mockRes.data.status === 'success' && mockRes.data.data.analysis.disasterType,
      'voiceController returns structured JSON output with Voice Understanding analysis'
    );
  } catch (err) {
    assert(false, 'voiceController test failed: ' + err.message);
  }

  console.log(`\n--- VOICE UNDERSTANDING TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ---`);
  if (failed > 0) process.exit(1);
  process.exit(0);
}

runVoiceUnderstandingTests();
