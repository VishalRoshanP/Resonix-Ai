/**
 * RESONIX AI — AI-Assisted Emergency Incident Triage Engine
 * 
 * Core Capabilities:
 * - Converts raw citizen reports (text, voice, photo, GPS) into structured incidents.
 * - Categorizes into 8 canonical disaster types:
 *     * Flood
 *     * Fire
 *     * Cyclone
 *     * Landslide
 *     * Road blockage
 *     * Medical emergency
 *     * Infrastructure damage
 *     * Other
 * - Extracts structured entities (victims/people affected, trapped persons, hazards,
 *   infrastructure damage, medical needs, landmarks).
 * - Computes numerical and qualitative AI confidence scores.
 * - Enforces zero-overwriting: Original citizen report is preserved untouched as source evidence.
 * - Injects mandatory operational disclaimer:
 *     "AI-Assisted Triage (Advisory Only) — Not an official emergency determination."
 */

const logger = require('../utils/logger');

// 8 Canonical Categories specified in system requirements
const CANONICAL_CATEGORIES = Object.freeze({
  FLOOD: 'Flood',
  FIRE: 'Fire',
  CYCLONE: 'Cyclone',
  LANDSLIDE: 'Landslide',
  ROAD_BLOCKAGE: 'Road blockage',
  MEDICAL_EMERGENCY: 'Medical emergency',
  INFRASTRUCTURE_DAMAGE: 'Infrastructure damage',
  OTHER: 'Other',
});

const OFFICIAL_DISCLAIMER =
  'AI-Assisted Triage (Advisory Only) — This automated classification is an advisory decision-support metric and is not an official emergency determination. Official incident prioritization and emergency response actions require human verification.';

/**
 * Normalizes any category string, keyword, or text evidence into one of the 8 canonical categories
 * @param {string} [rawCategory]
 * @param {string} [textEvidence]
 * @returns {string} One of the 8 canonical categories
 */
function normalizeToCanonicalCategory(rawCategory = '', textEvidence = '') {
  const combined = `${rawCategory || ''} ${textEvidence || ''}`.trim();
  const cat = String(rawCategory || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  const text = combined.toLowerCase();

  if (
    cat.includes('FLOOD') ||
    cat.includes('WATERLOG') ||
    cat.includes('TSUNAMI') ||
    /\b(flood|waterlogg|submerg|drown|water rising|flooded|inundat|overflow|tsunami)\b/i.test(text)
  ) {
    return CANONICAL_CATEGORIES.FLOOD;
  }

  if (
    cat.includes('FIRE') ||
    cat.includes('BLAZE') ||
    cat.includes('SMOKE') ||
    /\b(fire|flame|blaze|smoke|burn|burning|wildfire|gas leak|explosion)\b/i.test(text)
  ) {
    return CANONICAL_CATEGORIES.FIRE;
  }

  if (
    cat.includes('CYCLONE') ||
    cat.includes('STORM') ||
    cat.includes('TYPHOON') ||
    cat.includes('HURRICANE') ||
    cat.includes('SQUALL') ||
    /\b(cyclone|gale|storm|hurricane|typhoon|heavy wind|squall|thunderstorm)\b/i.test(text)
  ) {
    return CANONICAL_CATEGORIES.CYCLONE;
  }

  if (
    cat.includes('LANDSLIDE') ||
    cat.includes('MUDSLIDE') ||
    cat.includes('ROCKSLIDE') ||
    cat.includes('AVALANCHE') ||
    /\b(landslide|mudslide|rockfall|rockslide|debris flow|earth slip|hill collapse|avalanche)\b/i.test(text)
  ) {
    return CANONICAL_CATEGORIES.LANDSLIDE;
  }

  if (
    cat.includes('ROAD_BLOCK') ||
    cat.includes('BLOCKAGE') ||
    cat.includes('ROAD_ACCIDENT') ||
    /\b(road block|road closed|highway blocked|road blockage|tree fell|fallen tree|traffic blocked|traffic halt|obstruct|boulder on road|route cut off)\b/i.test(text)
  ) {
    return CANONICAL_CATEGORIES.ROAD_BLOCKAGE;
  }

  if (
    cat.includes('MEDICAL') ||
    cat.includes('HEART_ATTACK') ||
    cat.includes('AMBULANCE') ||
    cat.includes('CARDIAC') ||
    cat.includes('INJURY') ||
    /\b(medical|heart attack|cardiac|unconscious|bleeding|ambulance|patient|casualty|fracture|oxygen|stroke|injury|injured|pregnant)\b/i.test(text)
  ) {
    return CANONICAL_CATEGORIES.MEDICAL_EMERGENCY;
  }

  if (
    cat.includes('INFRASTRUCTURE') ||
    cat.includes('COLLAPSE') ||
    cat.includes('EARTHQUAKE') ||
    cat.includes('STRUCTURAL') ||
    /\b(building collaps\w*|wall collaps\w*|roof fell|roof collaps\w*|bridge collaps\w*|structural fail\w*|infrastructure damage|flyover|pillar crack\w*|dam crack\w*|tank crack\w*|overhead tank|water treatment.*tank|structure damag\w*)\b/i.test(text)
  ) {
    return CANONICAL_CATEGORIES.INFRASTRUCTURE_DAMAGE;
  }

  // Exact matches to the 8 canonical categories
  const canonicalValues = Object.values(CANONICAL_CATEGORIES);
  const matchedCanonical = canonicalValues.find((c) => c.toUpperCase() === cat);
  if (matchedCanonical) return matchedCanonical;

  return CANONICAL_CATEGORIES.OTHER;
}

/**
 * Extracts structured entities from multimodal citizen evidence
 * @param {Object|string} input
 * @returns {Object} Extracted entities
 */
function extractEntities(input = {}) {
  const params = typeof input === 'string' ? { rawText: input } : (input || {});
  const rawText = params.rawText || params.description || params.text || '';
  const voiceTranscript = params.voiceTranscript || '';
  const photoHazards = params.photoHazards || [];
  const combinedText = `${rawText} ${voiceTranscript}`.trim();
  const lower = combinedText.toLowerCase();

  // 1. People Affected / Victims
  let peopleAffected = null;
  const countRegexes = [
    /(\d+)\s*(?:people|persons|victims|citizens|individuals|trapped|injured|dead|casualties|stranded)/i,
    /(?:trapped|injured|rescued|stranded)\s*(?:about|approx|around)?\s*(\d+)/i,
    /family of\s*(\d+)/i,
  ];
  for (const rx of countRegexes) {
    const match = combinedText.match(rx);
    if (match && match[1]) {
      const parsed = parseInt(match[1], 10);
      if (!isNaN(parsed) && parsed > 0 && parsed < 100000) {
        peopleAffected = parsed;
        break;
      }
    }
  }

  // 2. Trapped Persons Detection
  let isTrapped = false;
  let trappedCount = null;
  const trappedMatch = combinedText.match(/(\d+)\s*(?:people|persons|citizens|victims)?\s*trapped/i) ||
                       combinedText.match(/trapped\s*(?:about|approx|around)?\s*(\d+)/i);
  if (trappedMatch && trappedMatch[1]) {
    trappedCount = parseInt(trappedMatch[1], 10);
    isTrapped = true;
  } else if (/\b(trapped|stuck|cannot escape|stranded|marooned|under rubble|on the roof|on terrace|roof top|cut off)\b/i.test(lower)) {
    isTrapped = true;
    trappedCount = peopleAffected || 1;
  }

  // 3. Hazards Detection
  const hazards = [];
  if (Array.isArray(photoHazards)) {
    photoHazards.forEach((h) => { if (h && !hazards.includes(h)) hazards.push(String(h)); });
  }
  if (/\b(electric\w*|wire\w*|spark\w*|current|power line\w*|short circuit\w*|electrocution\w*)/i.test(lower)) {
    hazards.push('Live electrical wires / sparking hazard');
  }
  if (/\b(gas leak|lpg|cylinder|chemical|toxic|fumes)\b/i.test(lower)) {
    hazards.push('Hazardous gas leak or chemical fumes');
  }
  if (/\b(flood|water|rising water|current|water level|flowing fast|floodwater)\b/i.test(lower)) {
    hazards.push('Rapidly rising floodwater current');
  }
  if (/\b(fire|flame|smoke|blaze|dense smoke|suffocation)\b/i.test(lower)) {
    hazards.push('Spreading fire and heavy smoke inhalation risk');
  }
  if (/\b(mudflow|rockfall|sliding debris|boulder)\b/i.test(lower)) {
    hazards.push('Active slope debris / rockfall risk');
  }
  if (/\b(collapse|unstable wall|crack in building)\b/i.test(lower)) {
    hazards.push('Unstable structural collapse risk');
  }

  // 4. Infrastructure Damage
  const infrastructureDamage = [];
  if (/\b(bridge|culvert|flyover)\b/i.test(lower)) {
    infrastructureDamage.push('Bridge or flyover damaged / collapsed');
  }
  if (/\b(building|apartment|house|wall|roof)\b/i.test(lower) && /\b(collaps\w*|crack\w*|damag\w*|submerg\w*|fell|rip\w*)/i.test(lower)) {
    infrastructureDamage.push('Building structure collapsed or severely damaged');
  }
  if (/\b(road|highway|expressway|street|junction)\b/i.test(lower) && /\b(block\w*|crack\w*|cut off|submerg\w*|cave-in|obstruct\w*)/i.test(lower)) {
    infrastructureDamage.push('Road or highway blocked / impassable');
  }
  if (/\b(transformer|power pole|cell tower|substation)\b/i.test(lower)) {
    infrastructureDamage.push('Utility/power infrastructure disrupted');
  }

  // 5. Medical Needs
  const medicalNeeds = [];
  if (/\b(oxygen|inhaler|breathing)\b/i.test(lower)) {
    medicalNeeds.push('Emergency respiratory support / oxygen inhaler required');
  }
  if (/\b(bleeding|trauma|fracture|wound)\b/i.test(lower)) {
    medicalNeeds.push('Severe trauma bleeding stabilization required');
  }
  if (/\b(unconscious|cardiac|heart attack|chest pain|cpr)\b/i.test(lower)) {
    medicalNeeds.push('Immediate critical medical resuscitation / cardiac care');
  }
  if (/\b(ambulance|doctor|medic|hospital|medical|first aid)\b/i.test(lower)) {
    medicalNeeds.push('Emergency ambulance & medical assistance required');
  }

  // 6. Landmarks / Location References
  const landmarks = [];
  const landmarkRegex = /(?:near|at|opposite|behind|beside|next to|close to|along)\s+([A-Z0-9][a-zA-Z0-9\s-]{2,30}?)(?=[,\.\n\r]|\band\b|\bwith\b|$)/gi;
  let lmMatch;
  while ((lmMatch = landmarkRegex.exec(combinedText)) !== null) {
    const found = lmMatch[1].trim().replace(/[,\.]$/, '');
    if (found && !landmarks.includes(found)) {
      landmarks.push(found);
    }
  }

  return {
    peopleAffected,
    trappedPersons: isTrapped ? (trappedCount || 1) : 0,
    isTrapped,
    hazards,
    infrastructureDamage,
    medicalNeeds,
    landmarks,
  };
}

/**
 * Determines incident severity based on entities, category, and evidence
 * @param {string} canonicalCategory
 * @param {Object} entities
 * @param {string} [text]
 * @returns {string} 'Critical' | 'High' | 'Moderate' | 'Low'
 */
function evaluateSeverity(canonicalCategory, entities = {}, text = '') {
  const lower = String(text || '').toLowerCase();

  // Critical conditions
  if (
    entities.isTrapped ||
    (entities.trappedPersons != null && entities.trappedPersons > 0) ||
    (entities.peopleAffected != null && entities.peopleAffected >= 5) ||
    (entities.medicalNeeds && entities.medicalNeeds.some((m) => /cardiac|chest pain|unconscious|resuscitation|breathing/i.test(m))) ||
    /\b(crush\w*|rubble|collapse.*car|collapse.*van|boulder.*crush|ripping|rip.*roof\w*|roof\w*.*rip\w*|unconscious|chest pain|severe breathing)\b/i.test(lower)
  ) {
    return 'Critical';
  }

  if (
    canonicalCategory === CANONICAL_CATEGORIES.FIRE ||
    canonicalCategory === CANONICAL_CATEGORIES.CYCLONE ||
    canonicalCategory === CANONICAL_CATEGORIES.FLOOD ||
    canonicalCategory === CANONICAL_CATEGORIES.LANDSLIDE
  ) {
    if (entities.peopleAffected != null && entities.peopleAffected > 0) return 'Critical';
    return 'High';
  }

  if (canonicalCategory === CANONICAL_CATEGORIES.INFRASTRUCTURE_DAMAGE) {
    if (/\b(collapsed|washed away|severe|cracked.*tank|wall collapsed)\b/i.test(lower)) return 'High';
    return 'Moderate';
  }

  if (canonicalCategory === CANONICAL_CATEGORIES.MEDICAL_EMERGENCY) {
    return 'High';
  }

  if (canonicalCategory === CANONICAL_CATEGORIES.ROAD_BLOCKAGE) {
    if (entities.hazards && entities.hazards.length > 0) return 'High';
    return 'Moderate';
  }

  return 'Moderate';
}

/**
 * Calculates deterministic & AI-grounded confidence score and qualitative rating
 * @param {Object} paramsOrReport
 * @param {string} [optionalCategory]
 * @returns {Object} { score: number, level: string, percentage: number, note: string }
 */
function calculateConfidence(paramsOrReport = {}, optionalCategory) {
  let canonicalCategory = optionalCategory || paramsOrReport.canonicalCategory;
  let citizenSelectedCategory = paramsOrReport.citizenSelectedCategory;
  let hasVoice = paramsOrReport.hasVoice;
  let hasText = paramsOrReport.hasText;
  let hasPhoto = paramsOrReport.hasPhoto;
  let hasGps = paramsOrReport.hasGps;
  let entities = paramsOrReport.entities;

  // If a report object was passed directly
  if (!canonicalCategory || paramsOrReport.description || paramsOrReport.gpsCoordinates || paramsOrReport.photoReference) {
    const report = paramsOrReport;
    const desc = report.rawText || report.description || report.message || report.text || '';
    const transcript = report.voiceTranscript || '';
    canonicalCategory = optionalCategory || normalizeToCanonicalCategory(report.category || report.selectedCategory, `${desc} ${transcript}`);
    citizenSelectedCategory = report.selectedCategory || report.category;
    hasVoice = Boolean(transcript || report.audioReference?.hasAudio || report.audioReference?.dataUrl);
    hasPhoto = Boolean(report.photoReference?.hasPhoto || report.photoReference?.dataUrl || report.imagePath);
    hasText = Boolean(desc.length >= 10);
    hasGps = Boolean(report.gpsCoordinates?.latitude != null || report.location?.lat != null || report.location?.latitude != null);
    entities = report.extractedEntities || extractEntities({ rawText: desc, voiceTranscript: transcript });
  }

  let score = 0.60;
  if (hasVoice) score += 0.10;
  if (hasPhoto) score += 0.10;
  if (hasText) score += 0.10;
  if (hasGps) score += 0.05;

  const selCatNormalized = normalizeToCanonicalCategory(citizenSelectedCategory);
  if (selCatNormalized === canonicalCategory && canonicalCategory !== CANONICAL_CATEGORIES.OTHER) {
    score += 0.05;
  }

  if (entities && ((entities.hazards && entities.hazards.length > 0) || entities.peopleAffected != null || entities.isTrapped)) {
    score += 0.05;
  }

  if (canonicalCategory === CANONICAL_CATEGORIES.OTHER) {
    score = Math.min(score, 0.45);
  }

  score = Math.max(0.20, Math.min(0.99, Math.round(score * 100) / 100));

  let level = 'HIGH';
  let note = 'High confidence multimodal AI assessment';
  if (score < 0.70) {
    level = 'LOW';
    note = 'Preliminary assessment with limited evidence — human responder review required';
  } else if (score < 0.85) {
    level = 'MEDIUM';
    note = 'Moderate confidence assessment — verification suggested on scene';
  }

  return {
    score,
    level,
    percentage: Math.round(score * 100),
    note,
  };
}

/**
 * Converts any Citizen Report into a Structured Incident
 * Zero-overwriting: strictly preserves original citizen report as source evidence.
 * 
 * @param {Object} reportInput - Citizen report payload or EmergencyReport document
 * @returns {Object} Structured Incident conforming to all required fields
 */
function triageCitizenReport(reportInput = {}) {
  const report = typeof reportInput.toObject === 'function' ? reportInput.toObject() : reportInput;

  // 1. Pristine Original Citizen Evidence (Unaltered, immutable source evidence)
  const reportId = report.reportId || report.id || report._id || `rpt_${Date.now()}`;
  const rawText = (
    report.rawText ||
    report.text ||
    report.description ||
    report.notes ||
    report.message ||
    ''
  ).trim();

  const voiceTranscript = (
    report.voiceTranscript ||
    report.originalVoiceTranscript ||
    report.transcript ||
    report.speechRecognitionTranscript ||
    ''
  ).trim();

  const selectedCategory = (
    report.selectedCategory ||
    report.citizenSelectedCategory ||
    report.category ||
    report.incidentMetadata?.category ||
    'General'
  ).toString();

  const submittedAt = report.submittedAt || report.timestamp || report.createdAt || new Date().toISOString();

  // Extract authoritative GPS without synthetic distortion
  let lat = null;
  let lng = null;
  let accuracy = null;
  if (report.gpsCoordinates && typeof report.gpsCoordinates === 'object') {
    lat = report.gpsCoordinates.latitude ?? report.gpsCoordinates.lat ?? null;
    lng = report.gpsCoordinates.longitude ?? report.gpsCoordinates.lng ?? null;
    accuracy = report.gpsCoordinates.accuracyMeters ?? report.gpsCoordinates.accuracy ?? null;
  }
  if (lat == null && report.location && typeof report.location === 'object') {
    lat = report.location.lat ?? report.location.latitude ?? null;
    lng = report.location.lng ?? report.location.longitude ?? null;
    accuracy = report.location.accuracy ?? null;
  }
  if (lat == null && report.latitude != null) lat = Number(report.latitude);
  if (lng == null && report.longitude != null) lng = Number(report.longitude);

  const hasGps = typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng) && (lat !== 0 || lng !== 0);

  const address = report.location?.address || report.sector || (hasGps ? `GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}` : 'Live Telemetry Sector');

  const photoRef = report.photoReference || (report.imageUrl ? { dataUrl: report.imageUrl, hasPhoto: true } : { hasPhoto: false });
  const audioRef = report.audioReference || (report.audioData ? { dataUrl: report.audioData, hasAudio: true } : { hasAudio: false });

  const originalCitizenEvidence = {
    reportId,
    rawText,
    selectedCategory,
    voiceTranscript,
    photoReference: photoRef,
    audioReference: audioRef,
    gpsCoordinates: {
      latitude: hasGps ? lat : null,
      longitude: hasGps ? lng : null,
      accuracyMeters: accuracy != null ? Number(accuracy) : null,
      status: hasGps ? 'GPS_AVAILABLE' : 'GPS_UNAVAILABLE',
    },
    locationAddress: address,
    submittedAt,
    userId: report.userId || 'usr_guest',
    citizenName: report.citizenName || report.victimName || 'Citizen User',
    deviceId: report.deviceId || null,
  };

  // 2. AI Classification into 8 Canonical Categories
  const textEvidence = `${voiceTranscript} ${rawText}`.trim();
  const rawCatHint = (selectedCategory && !/^(other|general|other emergency)$/i.test(selectedCategory))
    ? selectedCategory
    : (report.detectedCategory || report.detectedEmergencyCategory || report.category || '');
  const canonicalCategory = normalizeToCanonicalCategory(
    rawCatHint,
    textEvidence
  );

  // 3. Extracted Entities
  const photoHazards = report.photoReference?.hazards || report.imageAnalysis?.hazards || [];
  const extractedEntities = extractEntities({
    rawText,
    voiceTranscript,
    photoHazards,
    category: canonicalCategory,
  });

  // 4. Severity Evaluation
  const severity = evaluateSeverity(canonicalCategory, extractedEntities, textEvidence);

  // 5. Confidence Evaluation
  const confidence = calculateConfidence({
    canonicalCategory,
    citizenSelectedCategory: selectedCategory,
    hasVoice: Boolean(voiceTranscript || audioRef.hasAudio || audioRef.dataUrl),
    hasText: rawText.length > 0,
    hasPhoto: Boolean(photoRef.hasPhoto || photoRef.dataUrl),
    hasGps,
    entities: extractedEntities,
  });

  // 6. Structured Incident Payload Construction
  const structuredIncident = {
    incidentId: `inc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    packetId: report.packetId || `pkt_${Date.now()}`,
    clientRequestId: report.clientRequestId || report.packetId || reportId,
    title: `${canonicalCategory} Emergency Incident`,
    description: rawText || voiceTranscript || `${canonicalCategory} emergency reported by citizen.`,

    // The 7 Required Fields
    category: canonicalCategory,
    canonicalCategory: canonicalCategory,
    severity: severity,
    location: {
      lat: hasGps ? lat : null,
      lng: hasGps ? lng : null,
      accuracy: accuracy != null ? Number(accuracy) : null,
      address,
      sector: address,
    },
    timestamp: submittedAt,
    extractedEntities,
    confidence,
    originalCitizenEvidence,
    disclaimer: OFFICIAL_DISCLAIMER,

    // AI Triage Metadata & Non-Official Determination Stamp
    aiTriage: {
      isOfficialEmergencyDetermination: false,
      disclaimer: OFFICIAL_DISCLAIMER,
      triagedAt: new Date().toISOString(),
      classification: canonicalCategory,
      canonicalCategory: canonicalCategory,
      severity,
      confidenceScore: confidence.score,
      confidenceLevel: confidence.level,
      confidencePct: confidence.percentage,
      confidence,
      extractedEntities,
      originalEvidenceRef: reportId,
      notice: 'Advisory preliminary assessment for emergency responders. Official incident prioritization is verified by human emergency personnel.',
      model: 'resonix-gemma4-triage-engine',
      reasoning: `${canonicalCategory} classified with ${confidence.percentage}% confidence based on citizen evidence. Entities extracted: ${extractedEntities.hazards.length} hazards, ${extractedEntities.isTrapped ? 'trapped persons reported' : 'no trapped persons reported'}.`,
    },

    // Backward-compatible Incident fields for existing Responder & Map UI
    detectedCategory: canonicalCategory,
    detectedEmergencyCategory: canonicalCategory,
    selectedCategory,
    citizenSelectedCategory: selectedCategory,
    priority: severity.toUpperCase(),
    status: 'active',
    victimName: originalCitizenEvidence.citizenName,
    citizenName: originalCitizenEvidence.citizenName,
    userId: originalCitizenEvidence.userId,
    peopleAffected: extractedEntities.peopleAffected || 0,
    trapped: extractedEntities.isTrapped,
    originalTranscript: voiceTranscript || rawText,
    originalVoiceTranscript: voiceTranscript,
    voiceTranscript: voiceTranscript,
    notes: [],

    citizenInput: {
      selectedCategory,
      voiceTranscript,
      textDescription: rawText,
      photoReference: photoRef,
      gpsCoordinates: originalCitizenEvidence.gpsCoordinates,
    },

    aiAssessment: {
      category: canonicalCategory,
      severity: severity.toUpperCase(),
      priority: severity.toUpperCase(),
      confidence: confidence.score,
      meaning: `${canonicalCategory} emergency: ${rawText || voiceTranscript}`,
      reason: `${canonicalCategory} emergency identified from citizen evidence.`,
      hazards: extractedEntities.hazards,
      trapped: extractedEntities.isTrapped,
      keyEvidence: [rawText, voiceTranscript].filter(Boolean),
    },

    aiAnalysis: {
      summary: `${canonicalCategory} emergency reported at ${address}.`,
      disasterCategory: canonicalCategory,
      disasterType: canonicalCategory,
      severity: severity.toUpperCase(),
      confidenceScore: confidence.score,
      confidence: confidence.level,
      classificationConfidence: confidence.level,
      hazards: extractedEntities.hazards,
      trapped: extractedEntities.isTrapped,
      triage: {
        canonicalCategory,
        severity,
        confidence,
        extractedEntities,
        disclaimer: OFFICIAL_DISCLAIMER,
        isOfficialEmergencyDetermination: false,
      },
    },
  };

  return structuredIncident;
}

const CANONICAL_CATEGORY_LIST = Object.values(CANONICAL_CATEGORIES);

module.exports = {
  CANONICAL_CATEGORIES,
  CANONICAL_CATEGORY_LIST,
  OFFICIAL_DISCLAIMER,
  normalizeToCanonicalCategory,
  extractEntities,
  evaluateSeverity,
  calculateConfidence,
  triageCitizenReport,
};
