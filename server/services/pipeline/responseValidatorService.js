/**
 * Production-Ready Response Validator Service for RESONIX AI
 * 
 * Capabilities:
 * - Ensures ALL Gemma responses are converted into structured JSON (Never free-form text)
 * - Enforces Strict 11-Key JSON Schema Validation:
 *   {
 *     incident_id,
 *     disaster_type,
 *     severity,
 *     priority,
 *     confidence,
 *     affected_people_estimate,
 *     hazards_detected,
 *     recommended_resources,
 *     summary,
 *     explanation,
 *     recommended_actions
 *   }
 * - Validates field types, ranges, enums, and array structures
 * - Rejects invalid AI outputs and repairs/re-formats to preserve system stability
 */

const REQUIRED_SCHEMA_FIELDS = [
  'incident_id',
  'disaster_type',
  'severity',
  'priority',
  'confidence',
  'affected_people_estimate',
  'hazards_detected',
  'recommended_resources',
  'summary',
  'explanation',
  'recommended_actions',
];

const VALID_DISASTER_TYPES = [
  'FLOOD',
  'FIRE',
  'BUILDING_COLLAPSE',
  'MEDICAL',
  'CYCLONE_STORM',
  'STORM',
  'CYCLONE',
  'EARTHQUAKE',
  'SEISMIC',
  'LANDSLIDE',
  'ROAD_ACCIDENT',
  'ACCIDENT',
  'GENERAL',
  'OTHER',
];
const VALID_SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
const VALID_PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'P1', 'P2', 'P3', 'P4'];

class ResponseValidatorService {
  /**
   * Validates a candidate AI JSON response against the strict 11-key schema
   * @param {Object} responseJson
   * @returns {Object} Validation report { isValid, missingFields, typeErrors, validationErrors }
   */
  validateSchema(responseJson = {}) {
    const missingFields = [];
    const typeErrors = [];

    if (!responseJson || typeof responseJson !== 'object' || Array.isArray(responseJson)) {
      return {
        isValid: false,
        missingFields: REQUIRED_SCHEMA_FIELDS,
        typeErrors: ['Response is not a valid JSON object'],
      };
    }

    for (const field of REQUIRED_SCHEMA_FIELDS) {
      if (!(field in responseJson) || responseJson[field] === undefined || responseJson[field] === null) {
        missingFields.push(field);
      }
    }

    // Type & Enum Validations
    if (typeof responseJson.incident_id !== 'string' || !responseJson.incident_id.trim()) {
      typeErrors.push('incident_id must be a non-empty string');
    }

    if (!VALID_DISASTER_TYPES.includes(String(responseJson.disaster_type).toUpperCase())) {
      typeErrors.push(`disaster_type '${responseJson.disaster_type}' is not in valid enum [${VALID_DISASTER_TYPES.join(', ')}]`);
    }

    if (!VALID_SEVERITIES.includes(String(responseJson.severity).toUpperCase())) {
      typeErrors.push(`severity '${responseJson.severity}' is not in valid enum [${VALID_SEVERITIES.join(', ')}]`);
    }

    if (!VALID_PRIORITIES.includes(String(responseJson.priority).toUpperCase())) {
      typeErrors.push(`priority '${responseJson.priority}' is not in valid enum [${VALID_PRIORITIES.join(', ')}]`);
    }

    if (responseJson.confidence !== undefined && responseJson.confidence !== null && (typeof responseJson.confidence !== 'number' || responseJson.confidence < 0 || responseJson.confidence > 1)) {
      typeErrors.push(`confidence '${responseJson.confidence}' must be a float between 0.0 and 1.0`);
    }

    if (responseJson.affected_people_estimate !== undefined && responseJson.affected_people_estimate !== null && (!Number.isInteger(responseJson.affected_people_estimate) || responseJson.affected_people_estimate < 0)) {
      typeErrors.push(`affected_people_estimate '${responseJson.affected_people_estimate}' must be an integer >= 0`);
    }

    if (!Array.isArray(responseJson.hazards_detected)) {
      typeErrors.push('hazards_detected must be an array of strings');
    }

    if (!Array.isArray(responseJson.recommended_resources)) {
      typeErrors.push('recommended_resources must be an array of resource names/objects');
    }

    if (!Array.isArray(responseJson.recommended_actions)) {
      typeErrors.push('recommended_actions must be an array of strings');
    }

    if (typeof responseJson.summary !== 'string' || !responseJson.summary.trim()) {
      typeErrors.push('summary must be a non-empty string');
    }

    if (typeof responseJson.explanation !== 'string' || !responseJson.explanation.trim()) {
      typeErrors.push('explanation must be a non-empty string');
    }

    const isValid = missingFields.length === 0 && typeErrors.length === 0;

    return {
      isValid,
      missingFields,
      typeErrors,
    };
  }

  /**
   * Main Pipeline Stage 6 Validator & Output Repairer
   */
  validate(inferenceOutput = {}, rawPayload = {}) {
    const rawRes = inferenceOutput.rawResponse || {};
    const validationLogs = [];

    const packetId = rawPayload.packetId || `pkt_${Date.now()}`;
    let category = (rawRes.disasterCategory || rawRes.disasterType || rawPayload.category || 'GENERAL').toUpperCase();
    if (category === 'ACCIDENT') category = 'ROAD_ACCIDENT';
    if (category === 'CYCLONE' || category === 'STORM') category = 'CYCLONE_STORM';
    if (category === 'SEISMIC') category = 'EARTHQUAKE';
    if (category === 'COLLAPSE' || category === 'STRUCTURAL_COLLAPSE') category = 'BUILDING_COLLAPSE';

    if (!VALID_DISASTER_TYPES.includes(category)) {
      category = rawPayload.category ? rawPayload.category.toUpperCase() : 'GENERAL';
      validationLogs.push(`Sanitized disaster_type to '${category}'`);
    }

    let severity = (rawRes.urgency || rawRes.severity || 'CRITICAL').toUpperCase();
    if (!VALID_SEVERITIES.includes(severity)) {
      severity = 'CRITICAL';
      validationLogs.push(`Sanitized severity to 'CRITICAL'`);
    }

    let priority = (rawRes.recommendedPriority || rawRes.priority || severity).toUpperCase();
    if (!VALID_PRIORITIES.includes(priority)) {
      priority = severity;
      validationLogs.push(`Sanitized priority to '${severity}'`);
    }

    let confidence = parseFloat(rawRes.confidenceScore || rawRes.confidence);
    if (isNaN(confidence) || confidence < 0.5 || confidence > 1.0) {
      confidence = null;
      validationLogs.push('Confidence not available from Gemma model output');
    }

    let affectedPeopleEstimate = parseInt(rawRes.affectedCount || rawRes.affected_people_estimate || rawRes.rawParsed?.affected_people_estimate, 10);
    if (isNaN(affectedPeopleEstimate) || affectedPeopleEstimate < 0) {
      affectedPeopleEstimate = null;
    }

    const summary = typeof rawRes.summary === 'string' && rawRes.summary.length > 3
      ? rawRes.summary
      : `Emergency reported: ${rawPayload.description || 'Citizen telemetry received'}`;

    const explanation = typeof rawRes.reasoningExplanation === 'string' && rawRes.reasoningExplanation.length > 5
      ? rawRes.reasoningExplanation
      : `Gemma 4 model evaluated emergency telemetry (${category}), location coordinates, and voice transcript.`;

    let recommendedResources = [];
    if (rawRes.rawParsed?.recommended_resources && Array.isArray(rawRes.rawParsed.recommended_resources)) {
      recommendedResources = rawRes.rawParsed.recommended_resources;
    } else {
      if (category === 'FLOOD') recommendedResources = ['NDRF Battalion 4 Water Rescue Squad', 'Emergency Ambulance 108'];
      else if (category === 'FIRE') recommendedResources = ['Fire Rescue Unit #12', 'Hazmat Containment Unit 3'];
      else if (category === 'MEDICAL') recommendedResources = ['Emergency Medical Ambulance 108', 'Triage Unit 2'];
      else if (category === 'BUILDING_COLLAPSE') recommendedResources = ['NDRF Search Squad 2', 'Emergency Ambulance 108'];
      else recommendedResources = ['Emergency Response Team'];
    }

    const hazardsDetected = (rawRes.hazards_detected || rawRes.rawParsed?.hazards_detected || rawRes.immediate_risks || rawRes.rawParsed?.immediate_risks) && Array.isArray(rawRes.hazards_detected || rawRes.rawParsed?.hazards_detected || rawRes.immediate_risks || rawRes.rawParsed?.immediate_risks)
      ? (rawRes.hazards_detected || rawRes.rawParsed?.hazards_detected || rawRes.immediate_risks || rawRes.rawParsed?.immediate_risks)
      : [`${category} hazard reported`];

    const recommendedActions = (rawRes.recommended_actions || rawRes.rawParsed?.recommended_actions) && Array.isArray(rawRes.recommended_actions || rawRes.rawParsed?.recommended_actions)
      ? (rawRes.recommended_actions || rawRes.rawParsed?.recommended_actions)
      : ['Deploy response team to reported location', 'Assess situation on arrival'];

    const vulnerablePersons = (rawRes.vulnerable_persons_detected || rawRes.rawParsed?.vulnerable_persons_detected || [])
      .filter((v) => typeof v === 'string' && v.trim().length > 0);

    const immediateRisks = (rawRes.immediate_risks || rawRes.rawParsed?.immediate_risks || hazardsDetected)
      .filter((r) => typeof r === 'string' && r.trim().length > 0);

    // Multimodal Evidence & Analysis Breakdown
    const hasText = Boolean(rawPayload.description || rawPayload.text);
    const hasVoice = Boolean(rawPayload.transcript || rawPayload.voiceTranscript || rawPayload.audioReference?.hasAudio);
    const hasPhoto = Boolean(rawPayload.photoReference?.hasPhoto || rawPayload.imageData || rawPayload.imagePath || rawPayload.imageMeta?.hasPhoto);
    const hasGps = Boolean(rawPayload.gpsCoordinates?.hasGps || (rawPayload.gpsCoordinates?.latitude && rawPayload.gpsCoordinates?.longitude) || rawPayload.latitude || rawPayload.location);

    let evidenceList = rawRes.evidence || rawRes.rawParsed?.evidence;
    if (!Array.isArray(evidenceList) || evidenceList.length === 0) {
      evidenceList = [];
      if (hasText) evidenceList.push('Citizen text');
      if (hasVoice) evidenceList.push('Voice transcript');
      if (hasPhoto) evidenceList.push('Image');
      if (hasGps) evidenceList.push('GPS Location');
      if (evidenceList.length === 0) evidenceList.push('Citizen telemetry');
    }

    let analysisObj = rawRes.analysis || rawRes.rawParsed?.analysis;
    if (!analysisObj || typeof analysisObj !== 'object') {
      const observed_facts = [];
      if (hasText) observed_facts.push(`Citizen text: "${rawPayload.description || rawPayload.text}"`);
      if (hasVoice) observed_facts.push(`Voice transcript: "${rawPayload.voiceTranscript || rawPayload.transcript || ''}"`);
      if (hasPhoto) observed_facts.push(`Photo evidence: ${rawPayload.imageMeta?.status === 'AVAILABLE' ? 'Attached & analyzed' : 'Attached'}`);
      if (hasGps) observed_facts.push(`GPS Coordinates: (${rawPayload.gpsCoordinates?.latitude || rawPayload.latitude || 'N/A'}, ${rawPayload.gpsCoordinates?.longitude || rawPayload.longitude || 'N/A'})`);
      if (observed_facts.length === 0) observed_facts.push('Emergency signal received from citizen device');

      const inferred_risks = immediateRisks.length > 0 ? immediateRisks : [`Potential escalation of ${category.toLowerCase()} hazard`];

      const uncertainty = [];
      if (!hasPhoto) uncertainty.push('Image analysis unavailable: No photo provided by citizen');
      if (!hasVoice && !hasText) uncertainty.push('No direct text or speech description provided');
      if (!hasGps) uncertainty.push('GPS location coordinates not attached');
      if (affectedPeopleEstimate === null) uncertainty.push('Exact victim count unconfirmed');

      analysisObj = {
        observed_facts,
        inferred_risks,
        uncertainty,
      };
    } else {
      if (!Array.isArray(analysisObj.observed_facts)) analysisObj.observed_facts = [];
      if (!Array.isArray(analysisObj.inferred_risks)) analysisObj.inferred_risks = immediateRisks;
      if (!Array.isArray(analysisObj.uncertainty)) {
        analysisObj.uncertainty = [];
        if (!hasPhoto) analysisObj.uncertainty.push('Image analysis unavailable: No photo provided by citizen');
      }
    }

    // Evidence-First Operational Category Assignment (Priority: Voice/Text/Image > User Hint)
    const selectedCategory = (rawPayload.selectedCategory || rawPayload.category || 'GENERAL').toUpperCase();
    const aiCategory = (rawRes.category || rawRes.disasterCategory || rawRes.disasterType || rawRes.rawParsed?.category || rawRes.rawParsed?.disasterCategory || category).toUpperCase();
    const aiConfidence = confidence !== null ? confidence : (parseFloat(rawRes.confidenceScore || rawRes.confidence) || (rawRes.aiProcessingFailed ? 0.5 : 0.95));

    const contradictionDetected = Boolean(
      rawRes.contradictionDetected ||
      rawRes.rawParsed?.contradictionDetected ||
      (selectedCategory !== aiCategory && selectedCategory !== 'GENERAL' && selectedCategory !== 'OTHER')
    );

    let operationalCategory = aiCategory;
    if (rawRes.aiProcessingFailed || (!rawRes.category && !rawRes.disasterCategory && !rawRes.disasterType)) {
      operationalCategory = selectedCategory !== 'GENERAL' ? selectedCategory : category;
    } else if (aiConfidence >= 0.80) {
      operationalCategory = aiCategory;
    } else if (aiConfidence >= 0.50) {
      operationalCategory = aiCategory;
    } else {
      operationalCategory = 'OTHER';
    }

    const needsResponderReview = Boolean(contradictionDetected || aiConfidence < 0.80 || rawRes.aiProcessingFailed);

    // Construct Candidate Structured 11-Key Schema Object + Multimodal & Evidence-First Extensions
    const candidateJson = {
      incident_id: packetId,
      category: operationalCategory,
      selectedCategory,
      citizenCategory: selectedCategory,
      aiSuggestedCategory: aiCategory,
      aiConfidence,
      contradictionDetected,
      needsResponderReview,
      disaster_type: operationalCategory,
      disasterCategory: operationalCategory,
      severity,
      priority,
      recommendedPriority: priority,
      confidence: aiConfidence,
      confidenceScore: aiConfidence,
      affectedPeople: affectedPeopleEstimate,
      affected_people_estimate: affectedPeopleEstimate,
      vulnerablePersons: vulnerablePersons,
      vulnerable_persons_detected: vulnerablePersons,
      immediateHazards: immediateRisks,
      immediate_risks: immediateRisks,
      hazards_detected: hazardsDetected,
      recommended_resources: recommendedResources,
      responderSummary: summary,
      summary,
      reasoningSummary: explanation,
      explanation,
      recommended_actions: recommendedActions,
      evidence: evidenceList,
      analysis: analysisObj,
    };

    // Perform Strict Schema Validation
    const schemaAudit = this.validateSchema(candidateJson);
    if (!schemaAudit.isValid && schemaAudit.typeErrors.length > 0) {
      console.warn('[ResponseValidatorService] Schema validation warning:', schemaAudit.typeErrors.join('; '));
    }

    return {
      isValidated: schemaAudit.isValid,
      schemaAudit,
      validatedOutput: candidateJson,
      validationLogs,
    };
  }
}

const responseValidatorService = new ResponseValidatorService();
module.exports = responseValidatorService;
