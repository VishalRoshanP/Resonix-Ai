/**
 * Language & Script Analysis Engine for RESONIX AI Citizen Mobile
 * Full parity with Citizen Web EmergencyReportModal.jsx
 * Supports Tamil, Hindi, Telugu, Kannada, Malayalam, Bengali, Marathi, Gujarati, Punjabi, English
 */

const VOICE_LANGUAGES = [
  { code: 'ta-IN', name: 'Tamil', label: '\u0BA4\u0BAE\u0BBF\u0BB4\u0BCD (Tamil)' },
  { code: 'hi-IN', name: 'Hindi', label: '\u0939\u093F\u0928\u094D\u0926\u0940 (Hindi)' },
  { code: 'te-IN', name: 'Telugu', label: '\u0C24\u0C46\u0C32\u0C41\u0C17\u0C41 (Telugu)' },
  { code: 'kn-IN', name: 'Kannada', label: '\u0C95\u0CA8\u0CCD\u0CA8\u0CA1 (Kannada)' },
  { code: 'ml-IN', name: 'Malayalam', label: '\u0D2E\u0D32\u0D2F\u0D3E\u0D33\u0D02 (Malayalam)' },
  { code: 'bn-IN', name: 'Bengali', label: '\u09AC\u09BE\u0982\u09B2\u09BE (Bengali)' },
  { code: 'mr-IN', name: 'Marathi', label: '\u092E\u0930\u093E\u0920\u0940 (Marathi)' },
  { code: 'gu-IN', name: 'Gujarati', label: '\u0A97\u0AC1\u0A9C\u0CB0\u0ABE\u0AA4\u0AC0 (Gujarati)' },
  { code: 'pa-IN', name: 'Punjabi', label: '\u0A2A\u0A70\u0A1C\u0A3E\u0A2C\u0A40 (Punjabi)' },
  { code: 'en-IN', name: 'English', label: 'English (en-IN)' },
  { code: 'AUTO', name: 'Auto Detect', label: '\u{1F310} Auto Detect' },
];

const LANGUAGE_LOCALE_MAP = {
  Tamil: 'ta-IN',
  Hindi: 'hi-IN',
  Telugu: 'te-IN',
  Kannada: 'kn-IN',
  Malayalam: 'ml-IN',
  Bengali: 'bn-IN',
  Marathi: 'mr-IN',
  Gujarati: 'gu-IN',
  Punjabi: 'pa-IN',
  English: 'en-IN',
  ta: 'ta-IN',
  hi: 'hi-IN',
  te: 'te-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  bn: 'bn-IN',
  mr: 'mr-IN',
  gu: 'gu-IN',
  pa: 'pa-IN',
  en: 'en-IN',
  'ta-IN': 'ta-IN',
  'hi-IN': 'hi-IN',
  'te-IN': 'te-IN',
  'kn-IN': 'kn-IN',
  'ml-IN': 'ml-IN',
  'bn-IN': 'bn-IN',
  'mr-IN': 'mr-IN',
  'gu-IN': 'gu-IN',
  'pa-IN': 'pa-IN',
  'en-IN': 'en-IN',
  'en-US': 'en-IN',
};

/**
 * Unicode Script Analysis & Verification Engine
 */
function detectTranscriptScript(text = '') {
  if (!text || typeof text !== 'string') return { script: 'None', isNative: false, defaultLang: 'None', code: 'unknown' };
  if (/[\u0B80-\u0BFF]/.test(text)) return { script: 'Tamil', isNative: true, defaultLang: 'Tamil', code: 'ta-IN' };
  if (/[\u0900-\u097F]/.test(text)) return { script: 'Devanagari', isNative: true, defaultLang: 'Hindi', code: 'hi-IN' };
  if (/[\u0C00-\u0C7F]/.test(text)) return { script: 'Telugu', isNative: true, defaultLang: 'Telugu', code: 'te-IN' };
  if (/[\u0C80-\u0CFF]/.test(text)) return { script: 'Kannada', isNative: true, defaultLang: 'Kannada', code: 'kn-IN' };
  if (/[\u0D00-\u0D7F]/.test(text)) return { script: 'Malayalam', isNative: true, defaultLang: 'Malayalam', code: 'ml-IN' };
  if (/[\u0980-\u09FF]/.test(text)) return { script: 'Bengali', isNative: true, defaultLang: 'Bengali', code: 'bn-IN' };
  if (/[\u0A80-\u0AFF]/.test(text)) return { script: 'Gujarati', isNative: true, defaultLang: 'Gujarati', code: 'gu-IN' };
  if (/[\u0A00-\u0A7F]/.test(text)) return { script: 'Gurmukhi', isNative: true, defaultLang: 'Punjabi', code: 'pa-IN' };
  if (/[a-zA-Z]/.test(text)) return { script: 'Latin', isNative: false, defaultLang: 'English', code: 'en-IN' };
  return { script: 'Unknown', isNative: false, defaultLang: 'Unknown', code: 'unknown' };
}

/**
 * Automatic Language Detection Engine for Spoken Voice Telemetry
 */
function detectSpokenLanguage(sampleText = '') {
  const text = (sampleText || '').trim();
  if (!text) {
    return { code: null, label: 'Language not detected', name: 'Language not detected', confidence: 0 };
  }

  // 1. Native Unicode Script Range Inspection
  const scriptInfo = detectTranscriptScript(text);
  if (scriptInfo.isNative) {
    return { code: scriptInfo.code, label: scriptInfo.defaultLang, name: scriptInfo.defaultLang, confidence: 0.99, script: scriptInfo.script };
  }

  // 2. Keyword & Phonetic Transliteration Signature Inspection
  const lower = text.toLowerCase();

  if (/\b(thanneer|thanni|kaapaaththen|kaapaathunga|thee|kaapango|maram|vanakkam|illai|kaapaadunga|eriyudhu|mazhai|vada|vanga|aama|amman|perumal|mudiyala|sarakku|veedu|kodu|varudhu|vannakam|velam|vellam|vellathil|vellathula|kapathu|sikkiyirukiren|neruppu|theepidithu|maatik|martik|non|naan)\b/i.test(lower)) {
    return { code: 'ta-IN', label: 'Tamil', name: 'Tamil', confidence: 0.95, script: 'Latin' };
  }

  if (/\b(paani|madad|bachao|aag|ghar|bhejo|samundar|pani|maddad|karo|jaldi|hai|bhai|sahayata|dukan|sadak|bada|chota|raha|hoga|gaya|gaye|lagi|fasa|phase|bachaye|baadh|doob)\b/i.test(lower)) {
    return { code: 'hi-IN', label: 'Hindi', name: 'Hindi', confidence: 0.95, script: 'Latin' };
  }

  if (/\b(sahayam|neeru|kaapaadandi|kaapandi|illu|manta|gaali|sahayamu|kapadandi|niru|vachindi|randi|ledu|emiti|ela|vachadu|nenu|unnadi|unnaru|varada|munigi|chikkuk)\b/i.test(lower)) {
    return { code: 'te-IN', label: 'Telugu', name: 'Telugu', confidence: 0.95, script: 'Latin' };
  }

  if (/\b(sahaya|neeru|kaapaadi|niru|kaapadi|mane|kedu|sahayavagi|banni|illa|yaake|enu|houdu|agide|madata|nanna|iddivi|idini|benki|pravaha|sikkikon)\b/i.test(lower)) {
    return { code: 'kn-IN', label: 'Kannada', name: 'Kannada', confidence: 0.95, script: 'Latin' };
  }

  if (/\b(sahayam|vellam|thee|sahayikkuka|veedu|sahayikku|varoo|illa|enthanu|evide|aano|poyi|valla|njan|pettupoyi|rakshikku|kudungi|mungi)\b/i.test(lower)) {
    return { code: 'ml-IN', label: 'Malayalam', name: 'Malayalam', confidence: 0.95, script: 'Latin' };
  }

  if (/\b(help|flood|water|fire|rescue|trapped|emergency|house|building|please|save|ambulance|police|danger|doctor|storm|earthquake|collapse|roof|rising|stuck|people|me|my|is|are|we|us|in|on|at|i am|there is)\b/i.test(lower)) {
    return { code: 'en-IN', label: 'English', name: 'English', confidence: 0.92, script: 'Latin' };
  }

  return { code: null, label: 'Language not detected', name: 'Language not detected', confidence: 0, script: 'Latin' };
}

function getLanguageDisplayLabel(bcp47Input) {
  const code = typeof bcp47Input === 'object' && bcp47Input !== null ? bcp47Input.code || bcp47Input.locale || '' : String(bcp47Input || '');
  switch (code) {
    case 'ta-IN':
    case 'Tamil':
      return 'Tamil';
    case 'hi-IN':
    case 'Hindi':
      return 'Hindi';
    case 'te-IN':
    case 'Telugu':
      return 'Telugu';
    case 'kn-IN':
    case 'Kannada':
      return 'Kannada';
    case 'ml-IN':
    case 'Malayalam':
      return 'Malayalam';
    case 'bn-IN':
    case 'Bengali':
      return 'Bengali';
    case 'mr-IN':
    case 'Marathi':
      return 'Marathi';
    case 'gu-IN':
    case 'Gujarati':
      return 'Gujarati';
    case 'pa-IN':
    case 'Punjabi':
      return 'Punjabi';
    case 'en-US':
    case 'en-IN':
    case 'English':
      return 'English';
    default:
      if (!code || code === 'AUTO') {
        return 'Auto Detect';
      }
      return code;
  }
}

module.exports = {
  VOICE_LANGUAGES,
  LANGUAGE_LOCALE_MAP,
  detectTranscriptScript,
  detectSpokenLanguage,
  getLanguageDisplayLabel,
};
