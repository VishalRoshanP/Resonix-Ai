/**
 * Independent Pipeline Stage 1: Input Validation Service
 * Validates and sanitizes incoming citizen emergency report payloads.
 */

class InputValidationService {
  validate(reportPayload = {}) {
    const errors = [];
    
    if (!reportPayload) {
      errors.push('Report payload cannot be null or undefined');
    }

    const description = typeof reportPayload.description === 'string' ? reportPayload.description.trim() : (typeof reportPayload.text === 'string' ? reportPayload.text.trim() : '');
    const transcript = typeof reportPayload.transcript === 'string' ? reportPayload.transcript.trim() : '';
    const voiceTranscript = typeof reportPayload.voiceTranscript === 'string' ? reportPayload.voiceTranscript.trim() : '';
    const textProp = typeof reportPayload.text === 'string' ? reportPayload.text.trim() : '';
    const combinedText = [description, transcript, voiceTranscript, textProp].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(' ');

    const hasText = combinedText.length > 0;
    const hasAudio = Boolean(reportPayload.audioReference?.hasAudio || reportPayload.audioData);
    const hasPhoto = Boolean(reportPayload.photoReference?.hasPhoto || reportPayload.imageData);

    if (!hasText && !hasAudio && !hasPhoto) {
      errors.push('Report payload must contain at least text description, voice recording, or photo telemetry.');
    }

    const sanitizedGps = {
      hasGps: Boolean(reportPayload.gpsCoordinates?.hasGps && reportPayload.gpsCoordinates?.latitude != null),
      latitude: reportPayload.gpsCoordinates?.latitude != null ? parseFloat(reportPayload.gpsCoordinates.latitude) : null,
      longitude: reportPayload.gpsCoordinates?.longitude != null ? parseFloat(reportPayload.gpsCoordinates.longitude) : null,
      accuracyMeters: reportPayload.gpsCoordinates?.accuracyMeters != null ? parseFloat(reportPayload.gpsCoordinates.accuracyMeters) : null,
      sector: reportPayload.gpsCoordinates?.sector || 'Location unavailable',
    };

    const photoRef = reportPayload.photoReference || (reportPayload.imageData || reportPayload.imagePath ? { dataUrl: reportPayload.imageData || reportPayload.imagePath, hasPhoto: true } : { hasPhoto: false });
    const audioRef = reportPayload.audioReference || (reportPayload.audioData ? { hasAudio: true } : { hasAudio: false });

    const citizenCategory = (reportPayload.category || reportPayload.incidentMetadata?.category || 'GENERAL').toUpperCase();
    const packetId = reportPayload.packetId || reportPayload.id || `pkt_${Date.now()}`;
    const victimName = reportPayload.victimName || reportPayload.citizenName || reportPayload.name || 'Anonymous Citizen';
    const deviceId = reportPayload.deviceId || 'DEV_UNKNOWN';
    const timestamp = reportPayload.timestamp || new Date().toISOString();

    const citizenData = {
      packetId,
      victimName,
      deviceId,
      category: citizenCategory,
      description,
      transcript: transcript || voiceTranscript,
      gpsCoordinates: sanitizedGps,
      photoReference: photoRef,
      audioReference: audioRef,
      timestamp,
    };

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedPayload: {
        ...reportPayload,
        packetId,
        citizenData,
        combinedText: combinedText || 'Emergency signal reported',
        description,
        transcript: transcript || voiceTranscript,
        gpsCoordinates: sanitizedGps,
        photoReference: photoRef,
        audioReference: audioRef,
        category: citizenCategory,
      },
    };
  }
}

const inputValidationService = new InputValidationService();
module.exports = inputValidationService;
