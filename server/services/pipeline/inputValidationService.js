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
      hasGps: Boolean(reportPayload.gpsCoordinates?.hasGps || reportPayload.gpsCoordinates?.latitude),
      latitude: parseFloat(reportPayload.gpsCoordinates?.latitude) || 12.9716,
      longitude: parseFloat(reportPayload.gpsCoordinates?.longitude) || 77.5946,
      accuracyMeters: parseFloat(reportPayload.gpsCoordinates?.accuracyMeters || reportPayload.gpsCoordinates?.accuracy) || 5.0,
      sector: reportPayload.gpsCoordinates?.sector || 'Sector 4',
    };

    return {
      isValid: errors.length === 0,
      errors,
      sanitizedPayload: {
        ...reportPayload,
        combinedText: combinedText || 'Emergency signal reported',
        description,
        transcript: transcript || voiceTranscript,
        gpsCoordinates: sanitizedGps,
        category: (reportPayload.category || reportPayload.incidentMetadata?.category || 'GENERAL').toUpperCase(),
      },
    };
  }
}

const inputValidationService = new InputValidationService();
module.exports = inputValidationService;
