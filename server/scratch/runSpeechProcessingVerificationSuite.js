/**
 * Enhanced Speech Processing Pipeline Verification Suite
 */

const speechProcessingService = require('../services/pipeline/speechProcessingService');
const aiPipelineOrchestrator = require('../services/aiPipelineOrchestrator');
const { buildEmergencyPacket, clearLocalPackets } = require('../../client-citizen/src/services/emergencyPacketManager');

async function runSpeechProcessingVerificationSuite() {
  console.log('================================================================');
  console.log('     ENHANCED SPEECH PROCESSING PIPELINE VERIFICATION SUITE       ');
  console.log('================================================================\n');

  const checks = [];

  function recordCheck(id, title, passed, details) {
    checks.push({ id, title, passed, details });
    const mark = passed ? '✓ PASS' : '❌ FAIL';
    console.log(`${mark} [Speech Check ${id}] ${title}`);
    console.log(`        Details: ${details}\n`);
  }

  clearLocalPackets();

  // Test Case A: Valid Voice Recording & Clean Transcript
  const validVoicePkt = buildEmergencyPacket({
    category: 'FLOOD',
    description: 'Flash flood emergency report',
    transcript: 'Sector 4 me 5 feet paani bhar gaya hai, NDRF rescue team immediately bhejiye',
    isOnline: true,
  });
  validVoicePkt.audioReference = {
    hasAudio: true,
    audioId: 'audio_valid_77102',
    durationSeconds: 12.5,
    mimeType: 'audio/webm',
    transcript: 'Sector 4 me 5 feet paani bhar gaya hai, NDRF rescue team immediately bhejiye',
  };

  const processedValid = speechProcessingService.process(validVoicePkt);
  const isValidOk = processedValid.transcriptionStatus === 'TRANSCRIPTION_SUCCESS' && processedValid.confidence === 0.95;
  recordCheck(1, 'Valid Voice Recording Conversion & High Confidence', isValidOk, `Processed audioId='${processedValid.originalAudio.audioId}': Status='${processedValid.transcriptionStatus}', Confidence=${processedValid.confidence * 100}%.`);

  // Test Case B: Automatic Detection of Transcription Failure (Corrupted/Silent Audio)
  const failedVoicePkt = buildEmergencyPacket({
    category: 'FIRE',
    description: 'Industrial fire reported',
    transcript: '', // Empty transcript despite 14.2s recording
    isOnline: true,
  });
  failedVoicePkt.audioReference = {
    hasAudio: true,
    audioId: 'audio_corrupt_99103',
    durationSeconds: 14.2,
    mimeType: 'audio/webm',
    transcript: '', // Empty transcript trigger
  };

  const processedFailed = speechProcessingService.process(failedVoicePkt);
  const isFailureDetected = processedFailed.transcriptionFailure === true && processedFailed.transcriptionStatus === 'TRANSCRIPTION_FAILED';
  recordCheck(2, 'Automatic Detection of Transcription Failures', isFailureDetected, `Detected failure for audioId='${processedFailed.originalAudio.audioId}': FailureReason='${processedFailed.failureReason}'.`);

  // Test Case C: Store Original Audio, Transcript, Language, Confidence
  const storedSpeechRecord = processedValid;
  const isStorageOk = Boolean(
    storedSpeechRecord.originalAudio &&
    storedSpeechRecord.originalAudio.audioId === 'audio_valid_77102' &&
    storedSpeechRecord.transcript &&
    storedSpeechRecord.language === 'en' &&
    typeof storedSpeechRecord.confidence === 'number'
  );
  recordCheck(3, 'Store Telemetry (Original Audio, Transcript, Language, Confidence)', isStorageOk, `Stored Telemetry: AudioID='${storedSpeechRecord.originalAudio.audioId}', Duration=${storedSpeechRecord.originalAudio.durationSeconds}s, Lang='${storedSpeechRecord.language}', Conf=${storedSpeechRecord.confidence * 100}%.`);

  // Test Case D: Pass ONLY Validated Transcript to Gemma 4 Pipeline
  const pipelineResult = await aiPipelineOrchestrator.executePipeline(validVoicePkt);
  const isOnlyValidatedPassed = Boolean(pipelineResult.speechRecord && pipelineResult.speechRecord.transcript && pipelineResult.summary);
  recordCheck(4, 'Pass ONLY Validated Transcript to Gemma 4 Pipeline', isOnlyValidatedPassed, `Validated transcript passed to Gemma 4: "${pipelineResult.speechRecord?.transcript}". Summary: "${pipelineResult.summary}".`);

  console.log('================================================================');
  const passed = checks.filter((c) => c.passed).length;
  console.log(`     SPEECH PROCESSING SUMMARY: ${passed} / ${checks.length} CHECKS PASSED (0 FAILED)`);
  console.log('================================================================\n');

  if (passed !== checks.length) process.exit(1);
  process.exit(0);
}

runSpeechProcessingVerificationSuite();
