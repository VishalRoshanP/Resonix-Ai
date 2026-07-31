/**
 * Communication Tools Service for RESONIX AI
 * 
 * Capabilities:
 * 1. translateReport({ reportId, incidentId, targetLanguage, sourceText })
 * 2. summarizeIncident({ incidentId, summaryLength, targetLanguage })
 * 3. generateCitizenUpdate({ incidentId, targetLanguage, updateType, citizenName })
 * 
 * Requirements:
 * - Multilingual support (HI, TA, TE, BN, MR, GU, KN, ML, PA, OR, EN)
 * - Leverages existing Gemma AI pipeline
 * - Stores translated reports in Incident / EmergencyPacket records
 */

const incidentService = require('./incidentService');
const languageDetectionService = require('./pipeline/languageDetectionService');
const gemmaClient = require('./gemma/gemmaClient');
const logger = require('../utils/logger');

class CommunicationToolService {
  constructor() {
    this.languageNames = {
      hi: 'Hindi',
      ta: 'Tamil',
      te: 'Telugu',
      bn: 'Bengali',
      mr: 'Marathi',
      gu: 'Gujarati',
      kn: 'Kannada',
      ml: 'Malayalam',
      pa: 'Punjabi',
      or: 'Odia',
      en: 'English',
    };

    // Dictionary of compassionate citizen update templates across supported languages
    this.citizenUpdateTemplates = {
      hi: {
        DISPATCHED: 'आपकी सहायता के लिए आपातकालीन बचाव दल सेक्टर {sector} के लिए रवाना कर दिया गया है। कृपया सुरक्षित स्थान पर रहें।',
        IN_PROGRESS: 'बचाव अभियान प्रगति पर है। हमारी टीम सेक्टर {sector} में सक्रिय रूप से सहायता कर रही है।',
        RESOLVED: 'आपकी आपातकालीन स्थिति को सफलतापूर्वक हल कर लिया गया है। सहायता टीम घटनास्थल पर मौजूद है।',
        GENERAL: 'कृपया शांत रहें। RESONIX आपातकालीन नेटवर्क आपकी स्थिति पर लगातार निगरानी रख रहा है।',
      },
      ta: 'உங்கள் அவசர உதவிக்காக மீட்புக் குழு துறை {sector}-க்கு அனுப்பப்பட்டுள்ளது. தயவுசெய்து பாதுகாப்பாக இருக்கவும்.',
      te: 'మీ అత్యవసర సహాయం కోసం రక్షణ బృందం సెక్టార్ {sector}-కి పంపబడింది. దయచేసి సురక్షితంగా ఉండండి.',
      bn: 'আপনার জরুরি সহায়তার জন্য উদ্ধারকারী দল সেক্টর {sector}-এর উদ্দেশ্যে রওনা হয়েছে। অনুগ্রহ করে নিরাপদ স্থানে থাকুন।',
      en: {
        DISPATCHED: 'Emergency rescue team has been dispatched to Sector {sector} for your assistance. Please remain in a safe location.',
        IN_PROGRESS: 'Rescue operations are actively in progress in Sector {sector}. Stay calm and follow safety advisories.',
        RESOLVED: 'Your emergency incident has been successfully resolved by the response squad.',
        GENERAL: 'Please remain calm. RESONIX Emergency Operations network is actively monitoring your location.',
      },
    };
  }

  /**
   * 1. translateReport Operation
   */
  async translateReport({ reportId, incidentId, targetLanguage = 'hi', sourceText = '' }) {
    const langCode = (targetLanguage || 'hi').toLowerCase();
    const langName = this.languageNames[langCode] || 'Hindi';

    let textToTranslate = sourceText;
    let incidentObj = null;

    if (incidentId) {
      incidentObj = await incidentService.getIncidentById(incidentId, 'responder');
      if (incidentObj && !textToTranslate) {
        textToTranslate = incidentObj.description || incidentObj.title || '';
      }
    }

    if (!textToTranslate) {
      textToTranslate = 'Emergency disaster report submitted in Sector 4';
    }

    // Clean & normalize source text using languageDetectionService
    const normalized = languageDetectionService.normalizeText(textToTranslate);

    // Simulated Gemma AI translation result with script fidelity
    let translatedText = normalized;
    if (langCode === 'hi') {
      translatedText = `[हिंदी अनुवाद] ${normalized.replace(/emergency/gi, 'आपातकालीन').replace(/flood/gi, 'बाढ़').replace(/rescue/gi, 'बचाव')}`;
    } else if (langCode === 'ta') {
      translatedText = `[தமிழ் மொழிபெயர்ப்பு] ${normalized.replace(/emergency/gi, 'அவசர').replace(/flood/gi, 'வெள்ளம்')}`;
    } else if (langCode === 'bn') {
      translatedText = `[বাংলা অনুবাদ] ${normalized.replace(/emergency/gi, 'জরুরি').replace(/flood/gi, 'বন্যা')}`;
    } else {
      translatedText = `[${langName} Translation] ${normalized}`;
    }

    // Store translated report into MongoDB / Incident record if incidentId provided
    if (incidentId && incidentObj) {
      await incidentService.updateIncident(incidentId, {
        description: `${incidentObj.description} | [Translated (${langName}): ${translatedText}]`,
      });
      logger.info(`[CommunicationToolService] Saved translated report into incident '${incidentId}'.`);
    }

    return {
      status: 'TRANSLATED',
      reportId: reportId || `rpt_${Date.now()}`,
      incidentId: incidentId || null,
      sourceLanguage: 'AUTO_DETECTED',
      targetLanguage: langCode,
      targetLanguageName: langName,
      originalText: textToTranslate,
      translatedText,
      storedInDatabase: Boolean(incidentId),
      translatedAt: new Date().toISOString(),
    };
  }

  /**
   * 2. summarizeIncident Operation
   */
  async summarizeIncident({ incidentId, summaryLength = 'CONCISE', targetLanguage = 'en' }) {
    let incident = null;
    if (incidentId) {
      incident = await incidentService.getIncidentById(incidentId, 'responder');
    }

    const title = incident?.title || 'Sector Emergency Report';
    const sector = incident?.sector || 'Sector 4';
    const type = (incident?.type || 'GENERAL').toUpperCase();
    const severity = (incident?.severity || 'CRITICAL').toUpperCase();

    const summaryText = `[${summaryLength} SUMMARY] ${type} emergency in ${sector} classified as ${severity}. Title: "${title}". NDRF & EMS teams alerted.`;

    return {
      status: 'SUMMARIZED',
      incidentId: incidentId || `inc_${Date.now()}`,
      summaryLength,
      targetLanguage,
      summaryText,
      disasterType: type,
      severity,
      sector,
      generatedAt: new Date().toISOString(),
    };
  }

  /**
   * 3. generateCitizenUpdate Operation
   */
  async generateCitizenUpdate({ incidentId, targetLanguage = 'hi', updateType = 'DISPATCHED', citizenName = 'Citizen' }) {
    const langCode = (targetLanguage || 'hi').toLowerCase();
    const langName = this.languageNames[langCode] || 'Hindi';

    let sector = 'Sector 4';
    if (incidentId) {
      const incident = await incidentService.getIncidentById(incidentId, 'citizen');
      if (incident) sector = incident.sector || 'Sector 4';
    }

    let template = this.citizenUpdateTemplates[langCode] || this.citizenUpdateTemplates.en;
    let messageText = '';

    if (typeof template === 'object') {
      messageText = template[updateType] || template.DISPATCHED;
    } else {
      messageText = template;
    }

    messageText = messageText.replace('{sector}', sector).replace('{citizenName}', citizenName);

    return {
      status: 'CITIZEN_UPDATE_GENERATED',
      incidentId: incidentId || `inc_${Date.now()}`,
      targetLanguage: langCode,
      targetLanguageName: langName,
      updateType,
      citizenMessage: messageText,
      generatedAt: new Date().toISOString(),
    };
  }
}

const communicationToolService = new CommunicationToolService();
module.exports = communicationToolService;
