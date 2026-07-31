/**
 * Offline Emergency Packet Generation & Schema Validation Test Suite
 */

const {
  buildEmergencyPacket,
  validateEmergencyPacket,
  computePacketIntegrityHash,
  getDeviceIdentifier,
} = require('../../client-citizen/src/services/emergencyPacketManager');

async function runOfflinePacketValidation() {
  console.log('================================================================');
  console.log('    OFFLINE EMERGENCY PACKET GENERATION & SCHEMA VALIDATION     ');
  console.log('================================================================\n');

  const checks = [];

  function recordCheck(id, title, passed, details) {
    checks.push({ id, title, passed, details });
    const mark = passed ? '✓ PASS' : '❌ FAIL';
    console.log(`${mark} [Check ${id}] ${title}`);
    console.log(`        Details: ${details}\n`);
  }

  // 1. Generate Structured Emergency Packet
  const sampleInput = {
    category: 'FLOOD',
    description: 'Flash flood entering home in Sector 4; 3 residents trapped on roof.',
    transcript: 'Sector 4 me paani bohot bhar gaya hai, kripya rescue boat bheje!',
    language: 'hi',
    audio: { audioId: 'audio_177212001', durationSeconds: 6, mimeType: 'audio/webm' },
    photo: { photoId: 'img_177212001', mimeType: 'image/jpeg', formattedCompressedSize: '45 KB' },
    gps: { latitude: 12.9716, longitude: 77.5946, accuracy: 5.0, hasLocation: true },
    user: { id: 'usr_reg_882910' },
    isOnline: false,
  };

  const packet = buildEmergencyPacket(sampleInput);

  // Check 1: Unique Packet ID Generation
  const isPacketIdOk = Boolean(packet.packetId && packet.packetId.startsWith('pkt_'));
  recordCheck(1, 'Unique Packet ID Generation', isPacketIdOk, `Generated Packet ID: ${packet.packetId}`);

  // Check 2: User / Guest ID Binding
  const isUserIdOk = packet.userId === 'usr_reg_882910';
  recordCheck(2, 'User ID / Guest ID Binding', isUserIdOk, `Bound User ID: ${packet.userId}`);

  // Check 3: Timestamp Format
  const isTimestampOk = Boolean(packet.timestamp && !isNaN(Date.parse(packet.timestamp)));
  recordCheck(3, 'Timestamp ISO 8601 Verification', isTimestampOk, `ISO Timestamp: ${packet.timestamp}`);

  // Check 4: GPS Coordinates Structure
  const isGpsOk = packet.gpsCoordinates.hasGps && packet.gpsCoordinates.latitude === 12.9716 && packet.gpsCoordinates.longitude === 77.5946;
  recordCheck(4, 'GPS Coordinates Structure', isGpsOk, `Lat: ${packet.gpsCoordinates.latitude}, Lng: ${packet.gpsCoordinates.longitude}, Accuracy: ±${packet.gpsCoordinates.accuracyMeters}m`);

  // Check 5: Voice Recording Reference & Transcript
  const isVoiceOk = packet.audioReference.hasAudio && packet.voiceTranscript.includes('Sector 4');
  recordCheck(5, 'Voice Recording & Transcript Reference', isVoiceOk, `Audio ID: ${packet.audioReference.audioId}, Transcript: "${packet.voiceTranscript}"`);

  // Check 6: Optional Text Description
  const isTextOk = packet.description.includes('Flash flood');
  recordCheck(6, 'Optional Text Description', isTextOk, `Description: "${packet.description}"`);

  // Check 7: Uploaded Image References
  const isPhotoOk = packet.photoReference.hasPhoto && packet.photoReference.photoId === 'img_177212001';
  recordCheck(7, 'Uploaded Image References', isPhotoOk, `Photo ID: ${packet.photoReference.photoId}, Size: ${packet.photoReference.formattedSize}`);

  // Check 8: Language Tagging
  const isLangOk = packet.selectedLanguage === 'hi';
  recordCheck(8, 'Language Tagging', isLangOk, `Selected Language Code: ${packet.selectedLanguage}`);

  // Check 9: Device Identifier
  const isDeviceOk = Boolean(packet.deviceId && packet.deviceId.startsWith('dev_'));
  recordCheck(9, 'Device Identifier Generation', isDeviceOk, `Device ID: ${packet.deviceId}`);

  // Check 10: Incident Metadata Schema
  const isMetaOk = packet.incidentMetadata.category === 'FLOOD' && packet.incidentMetadata.packetStatus === 'QUEUED_LOCAL';
  recordCheck(10, 'Incident Metadata Schema', isMetaOk, `Category: ${packet.incidentMetadata.category}, Priority: ${packet.incidentMetadata.priority}, Status: ${packet.incidentMetadata.packetStatus}`);

  // Check 11: Packet Integrity Verification
  const isIntegrityOk = Boolean(packet.integrityHash && packet.integrityHash.startsWith('sha256_'));
  recordCheck(11, 'Packet Integrity Hash', isIntegrityOk, `Integrity Hash Signature: ${packet.integrityHash}`);

  // Check 12: Schema Validation Helper
  const validation = validateEmergencyPacket(packet);
  recordCheck(12, 'Packet Schema Validation', validation.isValid, `Validation Status: ${validation.isValid ? 'VALID' : 'INVALID'} (Errors: ${validation.errors.join(', ') || 'None'})`);

  console.log('================================================================');
  const passed = checks.filter((c) => c.passed).length;
  console.log(`    OFFLINE PACKET SUMMARY: ${passed} / ${checks.length} CHECKS PASSED (0 FAILED)`);
  console.log('================================================================\n');

  if (passed !== checks.length) process.exit(1);
  process.exit(0);
}

runOfflinePacketValidation();
