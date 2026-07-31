/**
 * Independent Pipeline Stage 3: Advanced Multi-Stage Language Identification Engine
 * 
 * Capabilities:
 * - Multi-Stage Identification: Script analysis -> Phonetic/Vocab Fallback -> Mixed-Language Code-Switching
 * - Supports Hindi, Tamil, Bengali, Telugu, Kannada, Marathi, Gujarati, Malayalam, English
 * - Detects mixed-language speech (e.g. "Mixed (Tamil + English)", "Mixed (Hindi + English)")
 * - Stores: detectedLanguage, languageConfidence, originalTranscript, translatedTranscript
 */

class LanguageDetectionService {
  /**
   * Normalizes whitespace and corrects malformed tokens/typos
   * @param {string} rawText
   * @returns {string} Cleaned, normalized text
   */
  normalizeText(rawText = '') {
    if (typeof rawText !== 'string') return '';

    let normalized = rawText
      .trim()
      .replace(/[\r\n\t]+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\s*([,.!?:;])\s*/g, '$1 ');

    const typoCorrections = [
      { pattern: /\bfloood+\b/gi, replacement: 'flood' },
      { pattern: /\bemergancy\b/gi, replacement: 'emergency' },
      { pattern: /\brescuee+\b/gi, replacement: 'rescue' },
      { pattern: /\bhelpp+\b/gi, replacement: 'help' },
      { pattern: /\bpaanii+\b/gi, replacement: 'paani' },
      { pattern: /\bmadadd+\b/gi, replacement: 'madad' },
      { pattern: /\bimmadiately\b/gi, replacement: 'immediately' },
    ];

    for (const { pattern, replacement } of typoCorrections) {
      normalized = normalized.replace(pattern, replacement);
    }

    return normalized.trim();
  }

  /**
   * Multi-Stage Language Identification Execution
   * @param {Object} processedSpeech
   * @param {Object} rawPayload
   * @returns {Object} Language detection record
   */
  detect(processedSpeech = {}, rawPayload = {}) {
    const originalText = processedSpeech.processedTranscript || rawPayload.description || rawPayload.combinedText || '';
    const normalizedText = this.normalizeText(originalText);
    const explicitLanguage = rawPayload.selectedLanguage || rawPayload.language;

    let primaryLang = 'English';
    let confidence = 0.88;
    let scriptName = 'LATIN';
    let isMixed = false;
    let mixedLabel = '';

    const lowerText = normalizedText.toLowerCase();

    // ----------------------------------------------------
    // STAGE 1 — Primary Script & Explicit Identification
    // ----------------------------------------------------
    if (/[\u0900-\u097F]/.test(normalizedText)) {
      primaryLang = 'Hindi';
      confidence = 0.98;
      scriptName = 'DEVANAGARI';
    } else if (/[\u0B80-\u0BFF]/.test(normalizedText)) {
      primaryLang = 'Tamil';
      confidence = 0.98;
      scriptName = 'TAMIL';
    } else if (/[\u0980-\u09FF]/.test(normalizedText)) {
      primaryLang = 'Bengali';
      confidence = 0.98;
      scriptName = 'BENGALI';
    } else if (/[\u0C00-\u0C7F]/.test(normalizedText)) {
      primaryLang = 'Telugu';
      confidence = 0.98;
      scriptName = 'TELUGU';
    } else if (/[\u0C80-\u0CFF]/.test(normalizedText)) {
      primaryLang = 'Kannada';
      confidence = 0.98;
      scriptName = 'KANNADA';
    } else if (/[\u0D00-\u0D7F]/.test(normalizedText)) {
      primaryLang = 'Malayalam';
      confidence = 0.98;
      scriptName = 'MALAYALAM';
    } else if (/[\u0A80-\u0AFF]/.test(normalizedText)) {
      primaryLang = 'Gujarati';
      confidence = 0.98;
      scriptName = 'GUJARATI';
    } else if (explicitLanguage && ['hi', 'ta', 'bn', 'te', 'kn', 'mr', 'gu', 'ml', 'en', 'Hindi', 'Tamil', 'Bengali', 'Telugu', 'Kannada', 'Marathi', 'Gujarati', 'Malayalam', 'English'].includes(explicitLanguage)) {
      const map = { hi: 'Hindi', ta: 'Tamil', bn: 'Bengali', te: 'Telugu', kn: 'Kannada', mr: 'Marathi', gu: 'Gujarati', ml: 'Malayalam', en: 'English' };
      primaryLang = map[explicitLanguage] || explicitLanguage;
      confidence = 0.92;
      scriptName = primaryLang === 'English' ? 'LATIN' : 'EXPLICIT_SELECTION';
    }

    // ----------------------------------------------------
    // STAGE 2 — Secondary Phonetic / Word-Frequency Fallback (If Confidence < 0.90 or Latin script)
    // ----------------------------------------------------
    if (confidence < 0.90 || scriptName.startsWith('LATIN')) {
      const hindiKeywords = /\b(paani|madad|bachao|aag|ghar|ndrf|bhejo|samundar|pani|lo|gaya|makan|chahiye)\b/i;
      const tamilKeywords = /\b(thaneer|kaapaaththen|thee|kaapango|maram|thanni|irukku|venum|savukku|vello)\b/i;
      const bengaliKeywords = /\b(jal|banchao|aagun|khub|banyah|dakar|sahajjo|chesta)\b/i;
      const teluguKeywords = /\b(neeru|sahayam|manta|illu|kapadandi|loiya|vachindi)\b/i;
      const kannadaKeywords = /\b(neeru|sahaya|benki|mane|kapaadi|bandide)\b/i;
      const malayalamKeywords = /\b(vellam|sahayam|theeyum|aalkkar|alukal|sahayikkuka|veedu|kudungippoyi)\b/i;

      const hasHindi = hindiKeywords.test(lowerText);
      const hasTamil = tamilKeywords.test(lowerText);
      const hasBengali = bengaliKeywords.test(lowerText);
      const hasTelugu = teluguKeywords.test(lowerText);
      const hasKannada = kannadaKeywords.test(lowerText);
      const hasMalayalam = malayalamKeywords.test(lowerText);

      if (hasTamil) {
        primaryLang = 'Tamil';
        confidence = 0.95;
        scriptName = 'LATIN_TANGLISH';
      } else if (hasHindi) {
        primaryLang = 'Hindi';
        confidence = 0.95;
        scriptName = 'LATIN_HINGLISH';
      } else if (hasBengali) {
        primaryLang = 'Bengali';
        confidence = 0.95;
        scriptName = 'LATIN_BENGLISH';
      } else if (hasTelugu) {
        primaryLang = 'Telugu';
        confidence = 0.95;
        scriptName = 'LATIN_TENGLISH';
      } else if (hasKannada) {
        primaryLang = 'Kannada';
        confidence = 0.95;
        scriptName = 'LATIN_KANGLISH';
      } else if (hasMalayalam) {
        primaryLang = 'Malayalam';
        confidence = 0.95;
        scriptName = 'LATIN_MANGLISH';
      } else if (normalizedText.length > 0 && primaryLang === 'en') {
        primaryLang = 'English';
        confidence = 0.94;
      }
    }

    // ----------------------------------------------------
    // STAGE 3 — Mixed-Language Detection (Code-Mixing Evaluation)
    // ----------------------------------------------------
    const englishKeywords = /\b(help|flood|fire|rescue|water|emergency|building|police|doctor|ambulance|people|trapped|stuck)\b/i;
    const hasEnglishWords = englishKeywords.test(lowerText);
    
    if (primaryLang !== 'English' && hasEnglishWords) {
      isMixed = true;
      mixedLabel = `Mixed (${primaryLang} + English)`;
      confidence = 0.96;
    }

    const finalDetectedLanguage = isMixed ? mixedLabel : primaryLang;

    return {
      originalLanguage: primaryLang,
      detectedLanguage: finalDetectedLanguage,
      languageConfidence: confidence,
      confidence,
      scriptName,
      isMultilingual: primaryLang !== 'English',
      isMixedLanguage: isMixed,
      originalText,
      normalizedText,
      originalTranscript: originalText,
      translatedTranscript: rawPayload.englishTranslation || rawPayload.translatedTranscript || null,
    };
  }
}

const languageDetectionService = new LanguageDetectionService();
module.exports = languageDetectionService;
