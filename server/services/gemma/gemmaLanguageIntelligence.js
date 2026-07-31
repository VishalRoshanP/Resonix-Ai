/**
 * Gemma Language Intelligence & AI Disaster Intelligence Assistant
 * 
 * Invokes local Ollama server (gemma4:e4b) with temperature 0.1 to analyze emergency voice transcripts.
 * 
 * Tasks:
 * - Detect language
 * - Translate into English if required
 * - Extract: Incident Type, Priority, Number of people, Injuries, Location, Hazards, Weather, Infrastructure damage
 * - Create responder briefing
 * - Return ONLY valid JSON
 */

const gemmaClient = require('./gemmaClient');
const responseParser = require('./responseParser');
const logger = require('../../utils/logger');

/**
 * Formats prompt for AI Disaster Intelligence Assistant
 * @param {string} transcript
 * @returns {string} Formatted prompt string
 */
function buildAiDisasterIntelligencePrompt(transcript) {
  const cleanTranscript = (transcript || '').trim();

  return `You are an AI Disaster Intelligence Assistant.

Analyze the emergency voice transcript.

Tasks

Detect language.

Translate into English if required.

Extract:

Incident Type

Priority

Number of people

Injuries

Location

Hazards

Weather

Infrastructure damage

Create a responder briefing.

Return ONLY valid JSON.

Transcript:

${cleanTranscript}

Expected JSON Schema (Return ONLY valid JSON):
{
  "language": "Detected Language (e.g. Tamil, Hindi, English, Spanish)",
  "translationRequired": true,
  "originalText": "${cleanTranscript.replace(/"/g, '\\"')}",
  "englishTranslation": "English translation if required, or original text if English",
  "englishText": "English translation if required, or original text if English",
  "incidentType": "Flood / Fire / Medical / Building Collapse / Storm / Earthquake / General",
  "priority": "LOW / MODERATE / HIGH / CRITICAL",
  "numberOfPeople": 0,
  "peopleAffected": 0,
  "injuries": "Description of injuries or None reported",
  "location": "Location mentioned in transcript or Unknown",
  "locationMentioned": "Location mentioned in transcript or Unknown",
  "hazards": ["List of identified hazards or None"],
  "weather": "Weather conditions mentioned or Clear",
  "infrastructureDamage": "Infrastructure damage description or None reported",
  "responderBriefing": "Concise emergency responder briefing",
  "summary": "Concise emergency responder briefing",
  "recommendedAction": "Immediate action for first response team"
}`;
}

/**
 * Processes emergency voice transcript through local Ollama gemma4:e4b
 * @param {Object} payload { transcript }
 * @returns {Promise<Object>} Valid JSON response matching AI Disaster Intelligence Assistant specifications
 */
async function processLanguageIntelligence({ transcript = '' }, options = {}) {
  const inputTranscript = (typeof transcript === 'string' ? transcript : '').trim();

  if (!inputTranscript) {
    return {
      language: 'Unknown',
      translationRequired: false,
      originalText: '',
      englishTranslation: '',
      englishText: '',
      incidentType: 'General',
      priority: 'LOW',
      numberOfPeople: 0,
      peopleAffected: 0,
      injuries: 'None reported',
      location: 'Unknown',
      locationMentioned: 'Unknown',
      hazards: [],
      weather: 'Unknown',
      infrastructureDamage: 'None reported',
      responderBriefing: 'No voice transcript provided.',
      summary: 'No voice transcript provided.',
      recommendedAction: 'Verify citizen situation directly.',
      gemmaModel: 'gemma4:e4b',
      aiAvailable: true,
    };
  }

  const prompt = buildAiDisasterIntelligencePrompt(inputTranscript);

  try {
    logger.info(`[GemmaDisasterIntelligence] Sending transcript to Ollama model gemma4:e4b (length: ${inputTranscript.length} chars)`);

    const result = await gemmaClient.generateText(prompt, {
      parameters: {
        temperature: 0.1,
      },
      timeoutMs: options.timeoutMs || 30000,
      maxRetries: options.maxRetries || 1,
    });

    const rawOutput = result?.generated_text || result?.response || result?.text || '';

    const fallbackJson = {
      language: null,
      translationRequired: false,
      originalText: inputTranscript,
      englishTranslation: inputTranscript,
      englishText: inputTranscript,
      incidentType: 'General',
      priority: 'HIGH',
      numberOfPeople: 1,
      peopleAffected: 1,
      injuries: 'Unknown',
      location: 'Unknown',
      locationMentioned: 'Unknown',
      hazards: ['General Emergency Hazard'],
      weather: 'Clear',
      infrastructureDamage: 'Under Assessment',
      responderBriefing: inputTranscript,
      summary: inputTranscript,
      recommendedAction: 'Dispatch first responders to citizen coordinates',
    };

    const parsedJson = responseParser.parseJson(rawOutput, fallbackJson);

    const detectedLang = parsedJson.language || null;
    const translatedText = parsedJson.englishTranslation || parsedJson.englishText || inputTranscript;
    const peopleCount = typeof parsedJson.numberOfPeople === 'number'
      ? parsedJson.numberOfPeople
      : typeof parsedJson.peopleAffected === 'number'
      ? parsedJson.peopleAffected
      : parseInt(parsedJson.numberOfPeople || parsedJson.peopleAffected, 10) || 0;
    const briefing = parsedJson.responderBriefing || parsedJson.summary || inputTranscript;

    const explainability = {
      detectedLanguage: detectedLang || null,
      languageReason: parsedJson.languageReason || (detectedLang ? `Detected script signatures and speech patterns for ${detectedLang}` : null),
      category: parsedJson.incidentType || null,
      categoryReason: parsedJson.categoryReason || (parsedJson.incidentType ? `Transcript indicates ${parsedJson.incidentType} hazard conditions` : null),
      severity: (parsedJson.priority || 'HIGH').toUpperCase(),
      severityReason: parsedJson.priorityReason || (parsedJson.priority ? `Classified as ${parsedJson.priority} based on victim density and situation urgency` : null),
      keyPhrases: Array.isArray(parsedJson.keyPhrases) ? parsedJson.keyPhrases : (parsedJson.keyPhrases ? [parsedJson.keyPhrases] : []),
      hazards: Array.isArray(parsedJson.hazards) ? parsedJson.hazards : (parsedJson.hazards ? [parsedJson.hazards] : []),
      peopleAffected: peopleCount > 0 ? peopleCount : null,
      translation: translatedText !== inputTranscript ? translatedText : null,
      recommendedResources: Array.isArray(parsedJson.recommendedResources) ? parsedJson.recommendedResources.join(', ') : (parsedJson.recommendedResources || null),
      confidence: typeof parsedJson.confidenceScore === 'number' ? parsedJson.confidenceScore : null,
    };

    return {
      language: detectedLang,
      translationRequired: Boolean(parsedJson.translationRequired),
      originalText: parsedJson.originalText || inputTranscript,
      englishTranslation: translatedText,
      englishText: translatedText,
      incidentType: parsedJson.incidentType || 'General',
      priority: (parsedJson.priority || 'HIGH').toUpperCase(),
      numberOfPeople: peopleCount,
      peopleAffected: peopleCount,
      injuries: parsedJson.injuries || 'None reported',
      location: parsedJson.location || parsedJson.locationMentioned || 'Unknown',
      locationMentioned: parsedJson.locationMentioned || parsedJson.location || 'Unknown',
      hazards: Array.isArray(parsedJson.hazards) ? parsedJson.hazards : (parsedJson.hazards ? [parsedJson.hazards] : []),
      weather: parsedJson.weather || 'Unknown',
      infrastructureDamage: parsedJson.infrastructureDamage || 'None reported',
      responderBriefing: briefing,
      summary: briefing,
      recommendedAction: parsedJson.recommendedAction || 'Dispatch emergency response team to location',
      explainability,
      gemmaModel: 'gemma4:e4b',
      aiAvailable: !result?.error,
    };
  } catch (error) {
    logger.warn('[GemmaDisasterIntelligence] Gemma inference error:', error.message);
    return {
      language: 'English',
      translationRequired: false,
      originalText: inputTranscript,
      englishTranslation: inputTranscript,
      englishText: inputTranscript,
      incidentType: 'General',
      priority: 'HIGH',
      numberOfPeople: 0,
      peopleAffected: 0,
      injuries: 'None reported',
      location: 'Unknown',
      locationMentioned: 'Unknown',
      hazards: [],
      weather: 'Unknown',
      infrastructureDamage: 'None reported',
      responderBriefing: inputTranscript,
      summary: inputTranscript,
      recommendedAction: 'Dispatch emergency team to location.',
      gemmaModel: 'gemma4:e4b',
      aiAvailable: false,
    };
  }
}

module.exports = {
  processLanguageIntelligence,
  buildAiDisasterIntelligencePrompt,
};
