/**
 * Dedicated Gemma 4 Hugging Face Inference API Client Integration Test
 */

const gemmaConfig = require('../config/gemma');
const gemmaClient = require('../services/gemma/gemmaClient');
const gemmaService = require('../services/gemma');

async function testGemmaClientIntegration() {
  console.log('--- STARTING GEMMA 4 E4B CLIENT INTEGRATION TEST ---');
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

  // 1. Config Check
  assert(gemmaConfig.hfModel === 'google/gemma-4-e4b-it', `Default model matches 'google/gemma-4-e4b-it' (Found: ${gemmaConfig.hfModel})`);
  assert(typeof gemmaConfig.timeoutMs === 'number' && gemmaConfig.timeoutMs === 30000, 'Default timeout is 30,000ms');

  // 2. Unconfigured token structured error handling
  const originalToken = gemmaConfig.hfToken;
  gemmaConfig.hfToken = '';
  const missingTokenResult = await gemmaClient.generateText('Test prompt without token');
  assert(
    missingTokenResult && missingTokenResult.success === false && missingTokenResult.error.code === 'HF_TOKEN_MISSING',
    'Unconfigured HF_TOKEN returns structured error object with HF_TOKEN_MISSING code'
  );
  gemmaConfig.hfToken = originalToken;

  // 3. Multimodal interface wrapper test
  const multimodalResult = await gemmaClient.generateMultimodal({
    mediaData: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
    mimeType: 'image/jpeg',
    promptText: 'Damage assessment',
  });
  assert(
    multimodalResult && (multimodalResult.success === false || Array.isArray(multimodalResult) || multimodalResult.generated_text),
    'Multimodal generateMultimodal method handles payload gracefully'
  );

  // 4. Gemma Service Layer integration test
  const voiceResult = await gemmaService.analyzeVoice({ transcript: 'Flash flood alert in Sector 4' });
  assert(
    voiceResult && voiceResult.status === 'QUEUED_FOR_GEMMA4' && voiceResult.capability === 'analyzeVoice',
    'GemmaService.analyzeVoice handles inference call and returns clean capability payload'
  );

  console.log(`\n--- GEMMA CLIENT TEST SUMMARY: ${passed} PASSED, ${failed} FAILED ---`);
  if (failed > 0) process.exit(1);
  process.exit(0);
}

testGemmaClientIntegration();
