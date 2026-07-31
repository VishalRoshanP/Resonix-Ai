/**
 * RESONIX AI — Hugging Face Gemma 4 E4B Connection Verification
 * 
 * Tests whether the HF_TOKEN is configured, authentication succeeds,
 * and the Gemma 4 E4B model is reachable via the Hugging Face Inference API.
 * 
 * Usage: node server/scratch/verifyHuggingFaceConnection.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const gemmaConfig = require('../config/gemma');

const DIVIDER = '='.repeat(64);
const results = [];

function recordCheck(id, name, passed, detail) {
  const icon = passed ? '✓ PASS' : '✗ FAIL';
  results.push({ id, name, passed, detail });
  console.log(`  ${icon} [Check-${id}] ${name}`);
  if (detail) console.log(`        Detail: ${detail}`);
}

async function runVerification() {
  console.log(`\n${DIVIDER}`);
  console.log('  RESONIX AI — Hugging Face Connection Verification');
  console.log(DIVIDER);
  console.log();

  // ─── Check 1: HF_TOKEN loaded from .env ───
  const hfToken = process.env.HF_TOKEN || '';
  const tokenPresent = hfToken.trim().length > 0;
  recordCheck(1, 'HF_TOKEN Loaded from .env',
    tokenPresent,
    tokenPresent
      ? `Token present (${hfToken.substring(0, 6)}${'*'.repeat(8)})`
      : 'HF_TOKEN is EMPTY. Set it in server/.env (see instructions in that file).'
  );

  // ─── Check 2: HF_MODEL configured ───
  const hfModel = process.env.HF_MODEL || gemmaConfig.hfModel;
  recordCheck(2, 'HF_MODEL Configured',
    hfModel === 'google/gemma-4-e4b-it',
    `Model: ${hfModel}`
  );

  // ─── Check 3: gemmaConfig.isConfigured() ───
  recordCheck(3, 'gemmaConfig.isConfigured()',
    gemmaConfig.isConfigured(),
    gemmaConfig.isConfigured()
      ? 'Configuration module confirms token is loaded.'
      : 'isConfigured() returned false — token not available to gemmaClient.'
  );

  // ─── Check 4: Endpoint URL constructed correctly ───
  const endpoint = gemmaConfig.getEndpointUrl();
  const expectedEndpoint = 'https://api-inference.huggingface.co/models/google/gemma-4-e4b-it';
  recordCheck(4, 'Inference Endpoint URL',
    endpoint === expectedEndpoint,
    endpoint
  );

  // ─── Check 5: Authorization header constructed ───
  const headers = gemmaConfig.getHeaders();
  const hasAuth = Boolean(headers['Authorization'] && headers['Authorization'].startsWith('Bearer '));
  recordCheck(5, 'Authorization Header Present',
    hasAuth,
    hasAuth
      ? `Authorization: Bearer ${hfToken.substring(0, 6)}${'*'.repeat(8)}`
      : 'No Authorization header — HF_TOKEN is empty.'
  );

  // ─── Check 6: Live Hugging Face API Connection Test ───
  if (!tokenPresent) {
    recordCheck(6, 'Live Hugging Face API Authentication',
      false,
      'SKIPPED — Cannot test API connection without HF_TOKEN.'
    );
    recordCheck(7, 'Gemma 4 E4B Model Reachable',
      false,
      'SKIPPED — Depends on Check 6.'
    );
    recordCheck(8, 'Live Inference Test',
      false,
      'SKIPPED — Depends on Check 6.'
    );
  } else {
    // Test real HF API connection
    try {
      console.log('  ... Contacting Hugging Face Inference API...');
      const testPayload = {
        inputs: '<start_of_turn>user\nClassify this emergency: Flood reported in Sector 4<end_of_turn>\n<start_of_turn>model\n',
        parameters: {
          max_new_tokens: 50,
          temperature: 0.1,
          return_full_text: false,
        },
        options: {
          use_cache: true,
          wait_for_model: true,
        },
      };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s for cold start

      const startTime = Date.now();
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: gemmaConfig.getHeaders(),
        body: JSON.stringify(testPayload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (response.status === 401) {
        recordCheck(6, 'Live Hugging Face API Authentication',
          false,
          `HTTP 401 — Token is invalid or expired. Generate a new token at https://huggingface.co/settings/tokens`
        );
        recordCheck(7, 'Gemma 4 E4B Model Reachable', false, 'Depends on Check 6.');
        recordCheck(8, 'Live Inference Test', false, 'Depends on Check 6.');
      } else if (response.status === 403) {
        recordCheck(6, 'Live Hugging Face API Authentication',
          true,
          `HTTP 403 — Token is valid but model license not accepted.`
        );
        recordCheck(7, 'Gemma 4 E4B Model Reachable',
          false,
          `Accept the Gemma 4 license at: https://huggingface.co/google/gemma-4-e4b-it`
        );
        recordCheck(8, 'Live Inference Test', false, 'Depends on Check 7.');
      } else if (response.status === 503) {
        const body = await response.json().catch(() => ({}));
        recordCheck(6, 'Live Hugging Face API Authentication', true, 'Authentication succeeded.');
        recordCheck(7, 'Gemma 4 E4B Model Reachable',
          true,
          `Model loading (cold start). Estimated: ${body.estimated_time || '~20'}s. Retry in a moment.`
        );
        recordCheck(8, 'Live Inference Test', false, `Model still warming up. Latency: ${latencyMs}ms.`);
      } else if (response.ok) {
        const body = await response.json().catch(() => null);
        recordCheck(6, 'Live Hugging Face API Authentication', true, 'Authentication succeeded.');
        recordCheck(7, 'Gemma 4 E4B Model Reachable', true, 'Model responded successfully.');

        const generatedText = Array.isArray(body)
          ? (body[0]?.generated_text || JSON.stringify(body[0]).substring(0, 100))
          : (body?.generated_text || JSON.stringify(body).substring(0, 100));

        recordCheck(8, 'Live Inference Test',
          Boolean(generatedText && generatedText.length > 0),
          `Latency: ${latencyMs}ms | Response preview: "${String(generatedText).substring(0, 80)}..."`
        );
      } else {
        const errorText = await response.text().catch(() => 'Unknown error');
        recordCheck(6, 'Live Hugging Face API Authentication',
          false,
          `HTTP ${response.status}: ${errorText.substring(0, 150)}`
        );
        recordCheck(7, 'Gemma 4 E4B Model Reachable', false, 'Depends on Check 6.');
        recordCheck(8, 'Live Inference Test', false, 'Depends on Check 6.');
      }
    } catch (err) {
      const isTimeout = err.name === 'AbortError';
      recordCheck(6, 'Live Hugging Face API Authentication',
        false,
        isTimeout ? 'Connection timed out after 60s.' : `Network error: ${err.message}`
      );
      recordCheck(7, 'Gemma 4 E4B Model Reachable', false, 'Depends on Check 6.');
      recordCheck(8, 'Live Inference Test', false, 'Depends on Check 6.');
    }
  }

  // ─── Check 9: gemmaClient module loads ───
  try {
    const gemmaClient = require('../services/gemma/gemmaClient');
    recordCheck(9, 'gemmaClient Module Loads',
      Boolean(gemmaClient && typeof gemmaClient.generateText === 'function'),
      'gemmaClient.generateText() is available.'
    );
  } catch (err) {
    recordCheck(9, 'gemmaClient Module Loads', false, err.message);
  }

  // ─── Check 10: RAG Knowledge Base loads ───
  try {
    const knowledgeService = require('../services/pipeline/knowledgeRetrievalService');
    const testQuery = { category: 'FLOOD', description: 'flood water rising sector 4 rescue boat needed' };
    const knowledge = knowledgeService.retrieveRelevantKnowledge(testQuery);
    const chunkCount = knowledge?.retrievedChunks?.length || 0;
    const sourceCount = knowledge?.sourceDocuments?.length || 0;
    recordCheck(10, 'RAG Knowledge Base Operational',
      chunkCount > 0 || sourceCount > 0,
      `Retrieved ${chunkCount} knowledge chunks from ${sourceCount} source documents. Latency: ${knowledge?.retrievalLatencyMs || 0}ms.`
    );
  } catch (err) {
    recordCheck(10, 'RAG Knowledge Base Operational', false, err.message);
  }

  // ─── Summary ───
  console.log();
  console.log(DIVIDER);
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const failed = total - passed;
  console.log(`  VERIFICATION SUMMARY: ${passed} / ${total} CHECKS PASSED (${failed} FAILED)`);
  console.log(DIVIDER);

  if (!tokenPresent) {
    console.log(`
  ┌──────────────────────────────────────────────────────────┐
  │  ACTION REQUIRED: Set your Hugging Face Access Token     │
  │                                                          │
  │  1. Go to: https://huggingface.co/settings/tokens        │
  │  2. Create a new "Read" access token                     │
  │  3. Go to: https://huggingface.co/google/gemma-4-e4b-it  │
  │  4. Accept the model license agreement                   │
  │  5. Edit server/.env and set:                            │
  │     HF_TOKEN=hf_your_token_here                          │
  │  6. Restart the server and run this script again          │
  └──────────────────────────────────────────────────────────┘
`);
  }

  console.log();
}

runVerification().catch((err) => {
  console.error('Verification script failed:', err);
  process.exit(1);
});
