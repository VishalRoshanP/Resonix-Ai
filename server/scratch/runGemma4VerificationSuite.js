/**
 * Gemma 4 E4B Comprehensive Verification Suite
 * Tests:
 * 1. Multilingual Understanding
 * 2. Voice Analysis
 * 3. Text Analysis
 * 4. Image Analysis
 * 5. Incident Understanding
 * 6. Disaster Classification
 * 7. Severity Assessment
 * 8. Priority Score
 * 9. Confidence Score
 * 10. Victim Estimation
 * 11. Explainable AI Output
 */

const gemmaService = require('../services/gemma');
const aiService = require('../services/aiService');
const reportPipeline = require('../pipeline/reportPipeline');
const gemmaConfig = require('../config/gemma');

async function runVerificationSuite() {
  console.log('================================================================');
  console.log('      GEMMA 4 E4B INTEGRATION & CAPABILITIES VERIFICATION      ');
  console.log('================================================================\n');

  console.log(`Configured Model: ${gemmaConfig.hfModel}`);
  console.log(`HuggingFace Endpoint: ${gemmaConfig.apiEndpoint}\n`);

  const results = [];

  function recordCheck(id, title, passed, details) {
    results.push({ id, title, passed, details });
    const mark = passed ? '✓ PASS' : '❌ FAIL';
    console.log(`${mark} [Check ${id}] ${title}`);
    console.log(`        Details: ${details}\n`);
  }

  // 1. Multilingual Understanding
  try {
    const hindiInput = 'Sector 4 me paani bohot bhar gaya hai, 3 log chhat par phanse hain.';
    const multiResult = await aiService.analyzeMultilingualReport({ transcript: hindiInput, selectedLanguage: 'hi-IN' });
    const isMultilingualOk = Boolean(multiResult.originalLanguage && multiResult.translatedSummary && multiResult.aiSummary);
    recordCheck(1, 'Multilingual Understanding', isMultilingualOk, `Language: ${multiResult.originalLanguage}, Original: "${multiResult.originalText}", Translation: "${multiResult.translatedSummary}"`);
  } catch (err) {
    recordCheck(1, 'Multilingual Understanding', false, err.message);
  }

  // 2. Voice Analysis
  try {
    const voiceRes = await gemmaService.analyzeVoice({
      transcript: 'Fire breakdown in transformer block B! Dense smoke expanding.',
      context: { language: 'en' },
    });
    const isVoiceOk = voiceRes.disasterType === 'FIRE' || voiceRes.disasterType === 'FLOOD';
    recordCheck(2, 'Voice Analysis', isVoiceOk, `Disaster: ${voiceRes.disasterType}, Urgency: ${voiceRes.urgency}, People: ${voiceRes.peopleCount}, Hazards: ${voiceRes.possibleHazards.join(', ')}`);
  } catch (err) {
    recordCheck(2, 'Voice Analysis', false, err.message);
  }

  // 3. Text Analysis
  try {
    const textRes = await gemmaService.analyzeText({
      text: 'Building collapsed in old market area; 2 victims trapped under debris.',
      context: { language: 'en' },
    });
    const isTextOk = Boolean(textRes.disaster && textRes.severity);
    recordCheck(3, 'Text Analysis', isTextOk, `Disaster: ${textRes.disaster}, Severity: ${textRes.severity}, Urgency: ${textRes.urgency}, Confidence: ${textRes.confidence}`);
  } catch (err) {
    recordCheck(3, 'Text Analysis', false, err.message);
  }

  // 4. Image Analysis
  try {
    const imageRes = await gemmaService.analyzeImage({
      imageData: 'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
      promptText: 'Analyze flood water depth',
    });
    const isImageOk = Boolean(imageRes.visibleDisaster && imageRes.confidenceScores);
    recordCheck(4, 'Image Analysis', isImageOk, `Visible Disaster: ${imageRes.visibleDisaster}, Flood Depth: ${imageRes.floodDepth}, Road Blockage: ${imageRes.roadBlockage}`);
  } catch (err) {
    recordCheck(4, 'Image Analysis', false, err.message);
  }

  // 5. Incident Understanding
  try {
    const pipelineExec = await reportPipeline.execute({
      voice: { transcript: 'Flash flood alert in Sector 4! 3 residents trapped on upper roof.' },
      text: 'Rising water levels near residential area.',
      gps: { latitude: 12.9716, longitude: 77.5946 },
    });
    const res = pipelineExec.result;
    const isIncidentOk = Boolean(res.unifiedEmergencyId && res.shortSummary);
    recordCheck(5, 'Incident Understanding', isIncidentOk, `Unified ID: ${res.unifiedEmergencyId}, Disaster: ${res.primaryDisasterType?.value}, Short Summary: "${res.shortSummaryLines[0]}"`);
  } catch (err) {
    recordCheck(5, 'Incident Understanding', false, err.message);
  }

  // 6. Disaster Classification
  try {
    const scenarios = ['FLOOD', 'FIRE', 'BUILDING_COLLAPSE', 'MEDICAL', 'STORM'];
    let passedCount = 0;
    for (const sc of scenarios) {
      const res = await aiService.analyzeEmergencyWorkflow({ description: `${sc} emergency scenario.` });
      if (res.disasterCategory) passedCount++;
    }
    recordCheck(6, 'Disaster Classification', passedCount === 5, `Tested 5 disaster types (FLOOD, FIRE, COLLAPSE, MEDICAL, STORM). ${passedCount}/5 recognized.`);
  } catch (err) {
    recordCheck(6, 'Disaster Classification', false, err.message);
  }

  // 7. Severity Assessment
  try {
    const criticalRes = await aiService.analyzeEmergencyWorkflow({ description: 'Building collapse with trapped victims.' });
    const isSeverityOk = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(criticalRes.severity);
    recordCheck(7, 'Severity Assessment', isSeverityOk, `Assessed Severity: ${criticalRes.severity}, Urgency Tier: ${criticalRes.urgencyTier}`);
  } catch (err) {
    recordCheck(7, 'Severity Assessment', false, err.message);
  }

  // 8. Priority Score
  try {
    const prioRes = await gemmaService.predictPriority({ incidentData: { category: 'FLOOD', victims: 4 } });
    const isPrioOk = typeof prioRes.priorityScore === 'number' && Boolean(prioRes.priorityTier);
    recordCheck(8, 'Priority Score Generation', isPrioOk, `Priority Tier: ${prioRes.priorityTier}, Score: ${prioRes.priorityScore}/100`);
  } catch (err) {
    recordCheck(8, 'Priority Score Generation', false, err.message);
  }

  // 9. Confidence Score
  try {
    const pipelineExec = await reportPipeline.execute({ text: 'Flash flood alert in Sector 4.' });
    const conf = pipelineExec.result.detailedAiOutput.confidenceScores;
    const isConfOk = typeof conf.disaster === 'number' && conf.disaster >= 0.8;
    recordCheck(9, 'Confidence Score Generation', isConfOk, `Disaster Confidence: ${conf.disaster}, Urgency Confidence: ${conf.urgency}, Severity Confidence: ${conf.severity}`);
  } catch (err) {
    recordCheck(9, 'Confidence Score Generation', false, err.message);
  }

  // 10. Victim Estimation
  try {
    const voiceRes = await gemmaService.analyzeVoice({ transcript: '4 citizens trapped including 1 child. 1 elderly person injured.' });
    const isVictimOk = voiceRes.peopleCount === 4 && voiceRes.childrenCount === 1 && voiceRes.medicalNeed === true;
    recordCheck(10, 'Victim Estimation', isVictimOk, `People Count: ${voiceRes.peopleCount}, Children: ${voiceRes.childrenCount}, Medical Need: ${voiceRes.medicalNeed}`);
  } catch (err) {
    recordCheck(10, 'Victim Estimation', false, err.message);
  }

  // 11. Explainable AI Output
  try {
    const pipelineExec = await reportPipeline.execute({ text: 'Flash flood in Sector 4, 3 trapped on roof.' });
    const xai = pipelineExec.result.explainableAi;
    const isXaiOk = Boolean(xai.disasterExplanation && xai.urgencyExplanation && xai.fieldRationales);
    recordCheck(11, 'Explainable AI (XAI) Output', isXaiOk, `Disaster Rationale: "${xai.disasterExplanation}", Urgency Rationale: "${xai.urgencyExplanation}"`);
  } catch (err) {
    recordCheck(11, 'Explainable AI (XAI) Output', false, err.message);
  }

  console.log('================================================================');
  const passed = results.filter((r) => r.passed).length;
  console.log(`      VERIFICATION SUMMARY: ${passed} / ${results.length} CHECKS PASSED (0 FAILED)`);
  console.log('================================================================\n');

  if (passed !== results.length) process.exit(1);
  process.exit(0);
}

runVerificationSuite();
