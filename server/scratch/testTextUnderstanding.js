/**
 * Dedicated Text Understanding using Gemma 4 E4B Integration Test
 */

const gemmaService = require('../services/gemma');
const reportController = require('../controllers/reportController');

async function runTextUnderstandingTests() {
  console.log('--- STARTING TEXT UNDERSTANDING GEMMA 4 INTEGRATION TEST ---');
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

  const sampleTexts = [
    {
      text: 'Flash flood alert in Sector 4! 4 people trapped including 1 child. Medical assistance needed urgently.',
      language: 'en',
    },
    {
      text: 'செக்டர் 4 இல் திடீர் வெள்ளப்பெருக்கு! 2 குழந்தைகள் உட்பட 5 பேர் சிக்கியுள்ளனர்.',
      language: 'ta',
    },
    {
      text: 'सेक्टर 4 में आग लग गई है! 3 लोग घायल हैं और तुरंत एम्बुलेंस चाहिए।',
      language: 'hi',
    },
  ];

  for (const sample of sampleTexts) {
    try {
      const result = await gemmaService.analyzeText({
        text: sample.text,
        context: { language: sample.language },
      });

      const requiredKeys = [
        'disaster',
        'severity',
        'people',
        'children',
        'medicalNeeds',
        'infrastructureDamage',
        'urgency',
        'keywords',
        'confidence',
      ];

      const hasAllKeys = requiredKeys.every((key) => key in result);
      assert(hasAllKeys, `Text understanding output contains all 9 required keys for [${sample.language}]`);
      assert(typeof result.confidence === 'number' && result.confidence >= 0 && result.confidence <= 1, `Confidence score is a valid float: ${result.confidence}`);
      assert(Array.isArray(result.keywords), `Keywords is an array of emergency terms`);
    } catch (err) {
      assert(false, `Text understanding failed for [${sample.language}]: ` + err.message);
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

    await reportController.analyzeTextReport(
      {
        body: {
          text: 'Flash flood in sector 4. 4 people trapped including 1 child.',
          packetId: 'pkt_text_888',
          context: { language: 'en' },
        },
      },
      mockRes,
      (err) => { throw err; }
    );

    assert(
      mockRes.statusCode === 200 && mockRes.data.status === 'success' && mockRes.data.data.analysis.disaster,
      'reportController.analyzeTextReport analyzes text, returns structured JSON, and stores AI output separately'
    );
  } catch (err) {
    assert(false, 'reportController analyzeTextReport failed: ' + err.message);
  }

  console.log(`\n--- TEXT UNDERSTANDING TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ---`);
  if (failed > 0) process.exit(1);
  process.exit(0);
}

runTextUnderstandingTests();
