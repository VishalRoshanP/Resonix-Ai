/**
 * Communication Operational Tools Verification Suite
 */

const toolRegistry = require('../services/tools/toolRegistry');
const gemmaFunctionCallingService = require('../services/pipeline/gemmaFunctionCallingService');
const incidentService = require('../services/incidentService');

async function runCommunicationToolsVerification() {
  console.log('================================================================');
  console.log('    COMMUNICATION OPERATIONAL TOOLS VERIFICATION SUITE         ');
  console.log('================================================================\n');

  const checks = [];
  function recordCheck(id, title, passed, details) {
    checks.push({ id, title, passed, details });
    const mark = passed ? '✓ PASS' : '❌ FAIL';
    console.log(`${mark} [CommTools-${id}] ${title}`);
    console.log(`        Details: ${details}\n`);
  }

  // 1. Setup real test incident
  const testIncident = await incidentService.createIncident({
    title: 'Flash Flood and Embankment Breach',
    category: 'FLOOD',
    sector: 'Sector 4',
    description: 'Flash flood waters rising fast near river bank, 5 feet inundation',
  });

  const incidentId = String(testIncident._id);

  // ─── Check 1: Tool Registry Registration ──────────────────────────────────
  const requiredTools = ['translateReport', 'summarizeIncident', 'generateCitizenUpdate'];
  const allRegistered = requiredTools.every((t) => toolRegistry.isValidTool(t));

  recordCheck(1, 'Expose Communication Tools to Gemma in ToolRegistry',
    allRegistered,
    `Registered 3 required communication tools: [${requiredTools.join(', ')}].`
  );

  // ─── Check 2: Tool 1 — translateReport Execution & Multilingual Storage ─────
  const translateCall = {
    tool_name: 'translateReport',
    parameters: {
      incidentId,
      targetLanguage: 'hi',
      sourceText: 'Emergency rescue boat needed immediately in Sector 4 low lying area',
    },
    confidence: 0.96,
    reasoning: 'Translate emergency report into Hindi for field responder team.',
  };

  const translateRes = await gemmaFunctionCallingService.processToolCallRequest(translateCall);
  const translateOk = translateRes.executed === true && translateRes.result?.status === 'TRANSLATED' && translateRes.result?.storedInDatabase === true;

  recordCheck(2, 'Tool 1: translateReport() Multilingual Translation & Storage',
    translateOk,
    `Translated to '${translateRes.result?.targetLanguageName}': "${translateRes.result?.translatedText}". Saved in MongoDB: ${translateRes.result?.storedInDatabase}.`
  );

  // ─── Check 3: Tool 2 — summarizeIncident Execution ──────────────────────────
  const summarizeCall = {
    tool_name: 'summarizeIncident',
    parameters: {
      incidentId,
      summaryLength: 'CONCISE',
      targetLanguage: 'en',
    },
    confidence: 0.97,
    reasoning: 'Generate concise summary for multi-agency commander briefing.',
  };

  const summarizeRes = await gemmaFunctionCallingService.processToolCallRequest(summarizeCall);
  const summarizeOk = summarizeRes.executed === true && summarizeRes.result?.status === 'SUMMARIZED';

  recordCheck(3, 'Tool 2: summarizeIncident() Gemma Pipeline Execution',
    summarizeOk,
    `Summary generated: "${summarizeRes.result?.summaryText}". Granularity: '${summarizeRes.result?.summaryLength}'.`
  );

  // ─── Check 4: Tool 3 — generateCitizenUpdate Execution (Hindi) ─────────────
  const updateHindiCall = {
    tool_name: 'generateCitizenUpdate',
    parameters: {
      incidentId,
      targetLanguage: 'hi',
      updateType: 'DISPATCHED',
      citizenName: 'Rahul Verma',
    },
    confidence: 0.98,
    reasoning: 'Generate compassionate Hindi update for affected citizen.',
  };

  const updateHindiRes = await gemmaFunctionCallingService.processToolCallRequest(updateHindiCall);
  const updateHindiOk = updateHindiRes.executed === true && updateHindiRes.result?.status === 'CITIZEN_UPDATE_GENERATED';

  recordCheck(4, 'Tool 3: generateCitizenUpdate() Hindi Alert Generation',
    updateHindiOk,
    `Hindi message for citizen: "${updateHindiRes.result?.citizenMessage}". Language: '${updateHindiRes.result?.targetLanguageName}'.`
  );

  // ─── Check 5: Tool 3 — generateCitizenUpdate Execution (Tamil & English) ───
  const updateTaCall = {
    tool_name: 'generateCitizenUpdate',
    parameters: {
      incidentId,
      targetLanguage: 'ta',
      updateType: 'DISPATCHED',
      citizenName: 'Karthik',
    },
    confidence: 0.95,
    reasoning: 'Generate Tamil status update for citizen.',
  };

  const updateTaRes = await gemmaFunctionCallingService.processToolCallRequest(updateTaCall);
  const updateTaOk = updateTaRes.executed === true && updateTaRes.result?.status === 'CITIZEN_UPDATE_GENERATED';

  recordCheck(5, 'Tool 3: Multilingual Citizen Status Update (Tamil / Indic Scripts)',
    updateTaOk,
    `Tamil update message: "${updateTaRes.result?.citizenMessage}". Target: '${updateTaRes.result?.targetLanguageName}'.`
  );

  // ─── Check 6: MongoDB Verification of Translated Audit Log ────────────────
  const updatedIncident = await incidentService.getIncidentById(incidentId, 'responder');
  const mongoOk = Boolean(updatedIncident && updatedIncident.description.includes('Translated'));

  recordCheck(6, 'MongoDB Audit Verification of Stored Translation',
    mongoOk,
    `Verified MongoDB record '${incidentId}' contains stored translation audit.`
  );

  // ─── Final Summary ────────────────────────────────────────────────────────
  const passed = checks.filter((c) => c.passed).length;
  const failed = checks.length - passed;

  console.log('================================================================');
  console.log(`  COMMUNICATION TOOLS SUMMARY: ${passed} / ${checks.length} CHECKS PASSED (${failed} FAILED)`);
  console.log('================================================================\n');

  process.exit(failed > 0 ? 1 : 0);
}

runCommunicationToolsVerification();
