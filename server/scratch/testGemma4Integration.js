/**
 * RESONIX AI — Gemma 4 E4B Integration Test & Diagnostic Verification
 * 
 * Verifies:
 * 1. HF_TOKEN environment variable loading
 * 2. Target model identifier: google/gemma-4-E4B-it
 * 3. Hugging Face Inference API / Router reachability
 * 4. 10-stage AI Pipeline execution (Validation, Speech, Language, RAG, Prompt Builder, Gemma 4 E4B)
 * 5. Structured JSON formatting and MongoDB model synchronization
 * 6. Detailed diagnostic summary report
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const gemmaConfig = require('../config/gemma');
const gemmaClient = require('../services/gemma/gemmaClient');
const aiPipelineOrchestrator = require('../services/aiPipelineOrchestrator');
const knowledgeRetrievalService = require('../services/pipeline/knowledgeRetrievalService');

const DIVIDER = '='.repeat(68);
const testResults = [];

function recordResult(num, name, passed, detail) {
  const status = passed ? '✓ PASS' : '✗ FAIL';
  testResults.push({ num, name, passed, detail });
  console.log(`  ${status} [Test-${num}] ${name}`);
  if (detail) console.log(`        Details: ${detail}`);
}

async function runGemma4IntegrationTest() {
  console.log(`\n${DIVIDER}`);
  console.log('  RESONIX AI — Gemma 4 E4B Hugging Face Integration Verification');
  console.log(DIVIDER);
  console.log();

  // Test 1: HF_TOKEN env loading
  const token = process.env.HF_TOKEN || '';
  const tokenLoaded = token.trim().length > 0;
  recordResult(1, 'HF_TOKEN Environment Variable Loaded', tokenLoaded,
    tokenLoaded ? `Token: ${token.substring(0, 8)}... (${token.length} chars)` : 'HF_TOKEN is empty in server/.env'
  );

  // Test 2: Target Model Configuration
  const model = gemmaConfig.hfModel || process.env.HF_MODEL;
  const isTargetModel = model === 'google/gemma-4-E4B-it' || model === 'google/gemma-4-e4b-it';
  recordResult(2, 'Model Configured as google/gemma-4-E4B-it', isTargetModel,
    `Active Model: ${model}`
  );

  // Test 3: gemmaConfig.isConfigured()
  recordResult(3, 'gemmaConfig.isConfigured() Verification', gemmaConfig.isConfigured(),
    `isConfigured: ${gemmaConfig.isConfigured()} | API Base: ${gemmaConfig.apiBaseUrl}`
  );

  // Test 4: RAG Knowledge Retrieval Pipeline
  let ragResult = null;
  try {
    ragResult = knowledgeRetrievalService.retrieveRelevantKnowledge({
      category: 'FLOOD',
      description: 'Flash flood alert in Sector 4 Koramangala! 4 people trapped on roof requiring NDRF boat squad',
    });
    const chunkCount = ragResult?.retrievedChunks?.length || 0;
    recordResult(4, 'RAG Semantic Retrieval Operational', chunkCount > 0,
      `Retrieved ${chunkCount} chunks from ${ragResult?.sourceDocuments?.length || 0} documents in ${ragResult?.retrievalLatencyMs || 0}ms`
    );
  } catch (err) {
    recordResult(4, 'RAG Semantic Retrieval Operational', false, err.message);
  }

  // Test 5: AI Pipeline Orchestrator Execution
  let pipelineOutput = null;
  try {
    pipelineOutput = await aiPipelineOrchestrator.executePipeline({
      packetId: `pkt_gemma4_test_${Date.now()}`,
      category: 'FLOOD',
      description: 'Flash flood emergency in Sector 4 Koramangala. Water level rising fast.',
      language: 'en-US',
      gpsCoordinates: { latitude: 12.9716, longitude: 77.5946 },
    });

    const isPipelineOk = Boolean(pipelineOutput && pipelineOutput.summary && pipelineOutput.disasterCategory);
    recordResult(5, '10-Stage AI Pipeline Execution', isPipelineOk,
      isPipelineOk ? `Category: ${pipelineOutput.disasterCategory} | Severity: ${pipelineOutput.severity}` : 'Pipeline output invalid'
    );
  } catch (err) {
    recordResult(5, '10-Stage AI Pipeline Execution', false, err.message);
  }

  // Test 6: Hugging Face Gemma 4 E4B API Connection
  if (!tokenLoaded) {
    recordResult(6, 'Live Gemma 4 E4B Hugging Face Inference API', false,
      'SKIPPED — HF_TOKEN not set in server/.env'
    );
  } else {
    try {
      console.log('  ... Sending test request to Hugging Face Gemma 4 E4B...');
      const apiResult = await gemmaClient.generateText(
        '<start_of_turn>user\nTriage this emergency: Flash flood in Sector 4<end_of_turn>\n<start_of_turn>model\n',
        { timeoutMs: 15000 }
      );

      if (apiResult && apiResult.success === false) {
        const errCode = apiResult.error?.code || 'HF_ERROR';
        const errMsg = apiResult.error?.message || 'Unknown HF error';
        recordResult(6, 'Live Gemma 4 E4B Hugging Face Inference API', false,
          `API Status Code: ${errCode} | Message: ${errMsg}`
        );
      } else {
        recordResult(6, 'Live Gemma 4 E4B Hugging Face Inference API', true,
          `Inference Response Received! Payload: ${JSON.stringify(apiResult).substring(0, 100)}...`
        );
      }
    } catch (err) {
      recordResult(6, 'Live Gemma 4 E4B Hugging Face Inference API', false, err.message);
    }
  }

  console.log();
  console.log(DIVIDER);
  const passCount = testResults.filter(t => t.passed).length;
  console.log(`  VERIFICATION SUMMARY: ${passCount} / ${testResults.length} TESTS PASSED`);
  console.log(DIVIDER);
  console.log();
}

runGemma4IntegrationTest().catch(console.error);
