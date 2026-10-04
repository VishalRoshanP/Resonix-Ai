/**
 * Independent Pipeline Stage 3: Advanced Multilingual Speech & Language Intelligence Engine
 * 
 * Capabilities:
 * - Pure content-driven language detection with Unicode script awareness
 * - Native Script Analysis: Devanagari (Hindi/Marathi), Tamil, Kannada, Telugu, Bengali, Malayalam, Gujarati, Gurmukhi (Punjabi)
 * - Tanglish & Code-Mixed / Romanized Dialect Detection:
 *   - Tanglish (Tamil + Latin characters)
 *   - Hinglish (Hindi + Latin characters)
 *   - Kanglish (Kannada + Latin characters)
 *   - Tenglish (Telugu + Latin characters)
 *   - Manglish (Malayalam + Latin characters)
 *   - Benglish (Bengali + Latin characters)
 * - Style Classification (`transcriptStyle`):
 *   - `NATIVE_SCRIPT`: Native Indian script Unicode characters
 *   - `ROMANIZED`: Indian language terms in Latin characters (Tanglish, Hinglish, etc.)
 *   - `MIXED`: Mixture of Indian language vocabulary with English words
 *   - `ENGLISH`: Standard English emergency/common words
 *   - `UNKNOWN`: Unintelligible random noise/symbols
 * - Dual Transcript Preservation:
 *   - `originalTranscript`: Untouched original words of the citizen
 *   - `speechRecognitionTranscript`: Exact raw result from Web Speech API
 */

class LanguageDetectionService {
  /**
   * Detects Unicode script of input text
   * @param {string} text
   * @returns {Object} { script, scriptName, isNative, langCode }
   */
  detectScript(text = '') {
    if (!text || typeof text !== 'string') return { script: 'None', scriptName: 'NONE', isNative: false, langCode: 'unknown' };
    if (/[\u0B80-\u0BFF]/.test(text)) return { script: 'Tamil', scriptName: 'TAMIL', isNative: true, langCode: 'ta' };
    if (/[\u0900-\u097F]/.test(text)) return { script: 'Devanagari', scriptName: 'DEVANAGARI', isNative: true, langCode: 'hi' };
    if (/[\u0C00-\u0C7F]/.test(text)) return { script: 'Telugu', scriptName: 'TELUGU', isNative: true, langCode: 'te' };
    if (/[\u0C80-\u0CFF]/.test(text)) return { script: 'Kannada', scriptName: 'KANNADA', isNative: true, langCode: 'kn' };
    if (/[\u0D00-\u0D7F]/.test(text)) return { script: 'Malayalam', scriptName: 'MALAYALAM', isNative: true, langCode: 'ml' };
    if (/[\u0980-\u09FF]/.test(text)) return { script: 'Bengali', scriptName: 'BENGALI', isNative: true, langCode: 'bn' };
    if (/[\u0A80-\u0AFF]/.test(text)) return { script: 'Gujarati', scriptName: 'GUJARATI', isNative: true, langCode: 'gu' };
    if (/[\u0A00-\u0A7F]/.test(text)) return { script: 'Gurmukhi', scriptName: 'GURMUKHI', isNative: true, langCode: 'pa' };
    if (/[a-zA-Z]/.test(text)) return { script: 'Latin', scriptName: 'LATIN', isNative: false, langCode: 'en' };
    return { script: 'Unknown', scriptName: 'UNKNOWN', isNative: false, langCode: 'unknown' };
  }

  /**
   * Normalizes speech text for AI comprehension while preserving original phrasing
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

    // 1. Remove stuttering / repeated words ("help help please" -> "help please")
    normalized = normalized.replace(/\b(\w+)(\s+\1)+\b/gi, '$1');

    // 2. Normalize common emergency abbreviations and typos
    const typoCorrections = [
      { pattern: /\bfloood+\b/gi, replacement: 'flood' },
      { pattern: /\bemergancy\b/gi, replacement: 'emergency' },
      { pattern: /\brescuee+\b/gi, replacement: 'rescue' },
      { pattern: /\bhelpp+\b/gi, replacement: 'help' },
      { pattern: /\bpaanii+\b/gi, replacement: 'paani' },
      { pattern: /\bmadadd+\b/gi, replacement: 'madad' },
      { pattern: /\bimmadiately\b/gi, replacement: 'immediately' },
      { pattern: /\bambulence\b/gi, replacement: 'ambulance' },
      { pattern: /\bcollaps+\b/gi, replacement: 'collapse' },
      { pattern: /\btrappedd+\b/gi, replacement: 'trapped' },
      { pattern: /\bshakk?ing\b/gi, replacement: 'shaking' },
      { pattern: /\bearthquacke?\b/gi, replacement: 'earthquake' },
    ];

    for (const { pattern, replacement } of typoCorrections) {
      normalized = normalized.replace(pattern, replacement);
    }

    return normalized.trim();
  }

  /**
   * Multi-Stage Language Identification Execution
   * Strictly evaluates the actual transcript/audio content without blindly assuming UI selection.
   * @param {Object} processedSpeech
   * @param {Object} rawPayload
   * @returns {Object} Complete language detection and dual transcript record
   */
  detect(processedSpeech = {}, rawPayload = {}) {
    const originalText = (
      processedSpeech.processedTranscript ||
      processedSpeech.transcript ||
      rawPayload.transcript ||
      rawPayload.voiceTranscript ||
      rawPayload.description ||
      rawPayload.combinedText ||
      ''
    ).trim();

    const selectedVoiceLang = rawPayload.selectedVoiceLanguage || rawPayload.selectedLanguage || null;
    const selectedVoiceCode = rawPayload.selectedVoiceLanguageCode || rawPayload.languageHint || null;

    const normalizedText = this.normalizeText(originalText);

    // 1. Handle Empty or Garbled / Unintelligible Inputs
    if (!originalText || originalText.length < 2) {
      return {
        originalLanguage: 'unknown',
        detectedLanguage: 'unknown',
        detectedLanguageCode: 'unknown',
        languageCode: 'unknown',
        languageConfidence: 0.0,
        confidence: 0.0,
        scriptName: 'NONE',
        transcriptScript: 'None',
        transcriptQuality: 'UNKNOWN',
        transcriptStyle: 'UNKNOWN',
        isMultilingual: false,
        isMixedLanguage: false,
        isUnknown: true,
        originalText: '',
        normalizedText: '',
        originalTranscript: '',
        speechRecognitionTranscript: '',
        normalizedTranscript: '',
        translatedTranscript: null,
      };
    }

    // Check for garbled / non-linguistic noise (e.g. "???", "---", only punctuation/symbols)
    const alphaCount = (originalText.match(/[\p{L}\p{N}]/gu) || []).length;
    if (alphaCount < 2 || /^[^a-zA-Z\u0900-\u0DFF]+$/.test(originalText)) {
      return {
        originalLanguage: 'unknown',
        detectedLanguage: 'unknown',
        detectedLanguageCode: 'unknown',
        languageCode: 'unknown',
        languageConfidence: 0.1,
        confidence: 0.1,
        scriptName: 'SYMBOLIC_NOISE',
        transcriptScript: 'Unknown',
        transcriptQuality: 'CORRUPTED',
        transcriptStyle: 'UNKNOWN',
        isMultilingual: false,
        isMixedLanguage: false,
        isUnknown: true,
        originalText,
        normalizedText,
        originalTranscript: originalText,
        speechRecognitionTranscript: originalText,
        normalizedTranscript: normalizedText,
        translatedTranscript: null,
      };
    }

    const scriptInfo = this.detectScript(normalizedText);
    let primaryLang = 'English';
    let languageCode = 'en';
    let confidence = 0.85;
    let scriptName = scriptInfo.scriptName;
    let transcriptScript = scriptInfo.script;
    let transcriptQuality = scriptInfo.isNative ? 'NATIVE' : 'LATIN';
    let transcriptStyle = scriptInfo.isNative ? 'NATIVE_SCRIPT' : 'ENGLISH';
    let isMixed = false;
    let mixedLabel = '';

    let nativeScriptTranscript = (processedSpeech && processedSpeech.nativeScriptTranscript) || rawPayload.nativeScriptTranscript || (scriptInfo.isNative ? originalText : null);
    let nativeScriptAvailable = Boolean(nativeScriptTranscript && nativeScriptTranscript.trim());

    const lowerText = normalizedText.toLowerCase();

    // ----------------------------------------------------
    // STAGE 1 — Unicode Native Script Identification
    // ----------------------------------------------------
    if (/[\u0900-\u097F]/.test(normalizedText)) {
      primaryLang = 'Hindi';
      languageCode = 'hi';
      confidence = 0.99;
      scriptName = 'DEVANAGARI';
      transcriptScript = 'Devanagari';
      transcriptQuality = 'NATIVE';
      transcriptStyle = 'NATIVE_SCRIPT';
    } else if (/[\u0B80-\u0BFF]/.test(normalizedText)) {
      primaryLang = 'Tamil';
      languageCode = 'ta';
      confidence = 0.99;
      scriptName = 'TAMIL';
      transcriptScript = 'Tamil';
      transcriptQuality = 'NATIVE';
      transcriptStyle = 'NATIVE_SCRIPT';
    } else if (/[\u0C80-\u0CFF]/.test(normalizedText)) {
      primaryLang = 'Kannada';
      languageCode = 'kn';
      confidence = 0.99;
      scriptName = 'KANNADA';
      transcriptScript = 'Kannada';
      transcriptQuality = 'NATIVE';
      transcriptStyle = 'NATIVE_SCRIPT';
    } else if (/[\u0C00-\u0C7F]/.test(normalizedText)) {
      primaryLang = 'Telugu';
      languageCode = 'te';
      confidence = 0.99;
      scriptName = 'TELUGU';
      transcriptScript = 'Telugu';
      transcriptQuality = 'NATIVE';
      transcriptStyle = 'NATIVE_SCRIPT';
    } else if (/[\u0980-\u09FF]/.test(normalizedText)) {
      primaryLang = 'Bengali';
      languageCode = 'bn';
      confidence = 0.99;
      scriptName = 'BENGALI';
      transcriptScript = 'Bengali';
      transcriptQuality = 'NATIVE';
      transcriptStyle = 'NATIVE_SCRIPT';
    } else if (/[\u0D00-\u0D7F]/.test(normalizedText)) {
      primaryLang = 'Malayalam';
      languageCode = 'ml';
      confidence = 0.99;
      scriptName = 'MALAYALAM';
      transcriptScript = 'Malayalam';
      transcriptQuality = 'NATIVE';
      transcriptStyle = 'NATIVE_SCRIPT';
    } else if (/[\u0A80-\u0AFF]/.test(normalizedText)) {
      primaryLang = 'Gujarati';
      languageCode = 'gu';
      confidence = 0.99;
      scriptName = 'GUJARATI';
      transcriptScript = 'Gujarati';
      transcriptQuality = 'NATIVE';
      transcriptStyle = 'NATIVE_SCRIPT';
    } else if (/[\u0A00-\u0A7F]/.test(normalizedText)) {
      primaryLang = 'Punjabi';
      languageCode = 'pa';
      confidence = 0.99;
      scriptName = 'GURMUKHI';
      transcriptScript = 'Gurmukhi';
      transcriptQuality = 'NATIVE';
      transcriptStyle = 'NATIVE_SCRIPT';
    }

    // Check for code-switching / mixed language in native script
    if (scriptInfo.isNative && containsEnglishWords(lowerText)) {
      isMixed = true;
      transcriptStyle = 'MIXED';
      mixedLabel = `${primaryLang}-English Code-Switching`;
    }

    // ----------------------------------------------------
    // STAGE 2 — Phonetic / Tanglish & Romanized Dialect Identification
    // ----------------------------------------------------
    let languageEvidence = scriptInfo.isNative ? 'UNICODE_NATIVE_SCRIPT' : 'ACOUSTIC_OR_LEXICAL';
    const acousticLang = processedSpeech.detectedLanguage || processedSpeech.originalLanguage || null;
    const acousticLangCode = processedSpeech.detectedLanguageCode || processedSpeech.languageCode || null;

    if (scriptName === 'LATIN') {
      // Dialect vocabulary token matrices for Indic emergency and conversational terms
      const tamilTokens = /\b(enga\w*|veetla\w*|veetuk\w*|veetukull\w*|thee\w*|theepid\w*|theepidithu\w*|nerup\w*|neruppu\w*|nirup\w*|thanni\w*|thaneer\w*|vellath\w*|vellathil\w*|vellathula\w*|velath\w*|non\b|naan\b|maatik\w*|matik\w*|martik\w*|marty\b|kondain\b|konden\b|kundan\b|kathad\w*|kathadangal\w*|kattad\w*|kattadangal\w*|vatil\w*|vatilmatti\w*|kide\b|sikkiy\w*|eriyudh\w*|eriy\w*|pukai\w*|puka\w*|kattidathil\w*|kattida\w*|veedu\w*|kaapaath\w*|kaapaad\w*|kapath\w*|kaapath\w*|kapadh\w*|kaapadh\w*|adhigam\w*|mudila\b|mudiyala\w*|moochu\w*|nenju\w*|vali\w*|idinj\w*|athir\w*|puya\w*|kaathu\w*|vandhud\w*|anupunga\w*|maram\w*|irukku\w*|venum\w*|pasanga\w*|chinna\w*|romba\w*|seekiram\w*|makkal\w*|valath\w*|vallathi\w*|enakku\b|aayid\w*|varuthu\w*|varuth\w*|pidich\w*|pidith\w*)\b/gi;
      const kannadaTokens = /\b(naanu\w*|nanna\w*|namma\w*|mane\w*|maneyalli\w*|manege\w*|neeru\w*|niru\w*|pravaha\w*|mulugu\w*|sikki\w*|sikkikon\w*|siluk\w*|silukiddene\w*|benki\w*|benkiyalli\w*|hoge\w*|kattada\w*|kattida\w*|bididhe\w*|biddu\w*|hakkondi\w*|hakkondiddare\w*|jana\w*|iddare\w*|kusitha\w*|kusid\w*|bhookamp\w*|bhukamp\w*|kapaadi\w*|kapadi\w*|sahaya\w*|bandide\w*|aagide\w*|aagthide\w*|olage\w*|thondre\w*|bega\w*|gaya\w*|novu\w*)\b/gi;
      const teluguTokens = /\b(nenu\w*|naa\w*|ma\w*|illu\w*|intlo\w*|intloki\w*|neeru\w*|niru\w*|varada\w*|varad\w*|munigi\w*|chikkuk\w*|chikkukun\w*|manta\w*|mantal\w*|mantallo\w*|nippu\w*|bhavanam\w*|kooli\w*|koolipoyindi\w*|kuli\w*|kulipoyindi\w*|mandhi\w*|lopala\w*|kapadandi\w*|sahayam\w*|vachindi\w*|unnamu\w*|undamu\w*|pillalu\w*|gaali\w*)\b/gi;
      const hindiTokens = /\b(main\b|hum\b|mera\b|mere\b|meri\b|ghar\b|ghar\w*|paani\w*|pani\w*|baadh\w*|badh\w*|fas\w*|phase\w*|fase\w*|doob\w*|dub\w*|aag\w*|dhuwan\w*|dhuan\w*|jal\w*|jaldi\w*|madad\w*|bachao\w*|bachaye\w*|bachaao\w*|makan\w*|imarat\w*|gir\w*|gira\w*|toot\w*|chhat\w*|bhejo\w*|aspatal\w*|ghayal\w*|chahiye\w*|samundar\w*|bhookamp\w*|jhatke\w*|khoon\w*|hain\b|hai\b|mein\b)\b/gi;
      const malayalamTokens = /\b(njaan\b|enikku\b|ente\b|njangal\b|veedu\w*|veettil\w*|vellam\w*|vellappokk\w*|mungi\w*|kudungi\w*|thee\w*|theeyum\w*|theeyil\w*|puka\w*|kettidam\w*|thakarnnu\w*|rakshikku\w*|rakshikkanam\w*|sahayikku\w*|pettannu\w*|aalkkar\w*|aalukal\w*|keri\w*|kidakkukayanu\w*)\b/gi;
      const marathiTokens = /\b(mee\b|majhe\b|amhi\b|padla\w*|padli\w*|dabli\w*|dable\w*|ahet\b|ahe\b|madat\w*|pathva\w*|lakar\w*|dhigara\w*|pani\w*|bhookamp\w*|lok\b)\b/gi;
      const bengaliTokens = /\b(aami\b|amar\b|amra\b|bari\w*|jal\w*|banchao\w*|aagun\w*|khub\w*|banyah\w*|dakar\w*|sahajjo\w*|chesta\w*|manush\w*|jon\b|bacha\w*|taratari\w*|ashun\w*|bhenge\w*|geche\w*|poreche\w*|atke\w*|niche\w*|ache\w*)\b/gi;

      const langScores = {
        Tamil: (lowerText.match(tamilTokens) || []).length,
        Kannada: (lowerText.match(kannadaTokens) || []).length,
        Telugu: (lowerText.match(teluguTokens) || []).length,
        Hindi: (lowerText.match(hindiTokens) || []).length,
        Malayalam: (lowerText.match(malayalamTokens) || []).length,
        Marathi: (lowerText.match(marathiTokens) || []).length,
        Bengali: (lowerText.match(bengaliTokens) || []).length,
      };

      // Find dialect with highest matching token density
      let bestLang = 'English';
      let bestScore = 0;
      for (const [lName, score] of Object.entries(langScores)) {
        if (score > bestScore) {
          bestScore = score;
          bestLang = lName;
        }
      }

      const isVoiceTamil = selectedVoiceCode === 'ta-IN' || selectedVoiceCode === 'ta' || selectedVoiceLang === 'Tamil' || acousticLang === 'Tamil' || acousticLangCode === 'ta-IN';
      const isVoiceHindi = selectedVoiceCode === 'hi-IN' || selectedVoiceCode === 'hi' || selectedVoiceLang === 'Hindi' || acousticLang === 'Hindi' || acousticLangCode === 'hi-IN';
      const isVoiceTelugu = selectedVoiceCode === 'te-IN' || selectedVoiceCode === 'te' || selectedVoiceLang === 'Telugu' || acousticLang === 'Telugu' || acousticLangCode === 'te-IN';
      const isVoiceKannada = selectedVoiceCode === 'kn-IN' || selectedVoiceCode === 'kn' || selectedVoiceLang === 'Kannada' || acousticLang === 'Kannada' || acousticLangCode === 'kn-IN';
      const isVoiceMalayalam = selectedVoiceCode === 'ml-IN' || selectedVoiceCode === 'ml' || selectedVoiceLang === 'Malayalam' || acousticLang === 'Malayalam' || acousticLangCode === 'ml-IN';
      const isVoiceMarathi = selectedVoiceCode === 'mr-IN' || selectedVoiceCode === 'mr' || selectedVoiceLang === 'Marathi' || acousticLang === 'Marathi' || acousticLangCode === 'mr-IN';
      const isVoiceBengali = selectedVoiceCode === 'bn-IN' || selectedVoiceCode === 'bn' || selectedVoiceLang === 'Bengali' || acousticLang === 'Bengali' || acousticLangCode === 'bn-IN';

      if (bestScore > 0) {
        primaryLang = bestLang;
        const codeMap = {
          Tamil: { code: 'ta-IN', script: 'Tamil' },
          Kannada: { code: 'kn-IN', script: 'Kannada' },
          Telugu: { code: 'te-IN', script: 'Telugu' },
          Hindi: { code: 'hi-IN', script: 'Devanagari' },
          Malayalam: { code: 'ml-IN', script: 'Malayalam' },
          Marathi: { code: 'mr-IN', script: 'Devanagari' },
          Bengali: { code: 'bn-IN', script: 'Bengali' },
        };
        languageCode = codeMap[bestLang]?.code || 'en-IN';
        scriptName = codeMap[bestLang]?.script?.toUpperCase() || 'LATIN';
        transcriptScript = codeMap[bestLang]?.script || 'Latin';
        confidence = 0.95;
        transcriptQuality = 'ROMANIZED';
        languageEvidence = 'INDIC_ROMANIZED_PHONETIC';
        isMixed = containsEnglishWords(lowerText);
        transcriptStyle = isMixed ? 'MIXED' : 'ROMANIZED';

        // Reconstruct authoritative native script if confirmed emergency speech
        try {
          const asrService = require('../speech/asrService');
          const recovered = asrService._reconstructNativeScript(normalizedText, primaryLang);
          if (recovered && recovered.nativeScript) {
            nativeScriptTranscript = recovered.nativeScript;
            nativeScriptAvailable = true;
            transcriptScript = recovered.script;
            scriptName = recovered.script.toUpperCase();
            transcriptQuality = 'NATIVE';
            transcriptStyle = isMixed ? 'MIXED' : 'NATIVE_SCRIPT';
          }
        } catch (_) {}
      } else if (isVoiceTamil && !isPureEnglishSentence(lowerText)) {
        primaryLang = 'Tamil';
        languageCode = 'ta-IN';
        scriptName = 'TAMIL';
        transcriptScript = 'Tamil';
        confidence = 0.90;
        languageEvidence = acousticLang === 'Tamil' ? 'ACOUSTIC_AUDIO_MODEL' : 'USER_SELECTION_CONTEXT';
        isMixed = containsEnglishWords(lowerText);
        transcriptStyle = isMixed ? 'MIXED' : 'ROMANIZED';
      } else if (isVoiceHindi && !isPureEnglishSentence(lowerText)) {
        primaryLang = 'Hindi';
        languageCode = 'hi-IN';
        scriptName = 'DEVANAGARI';
        transcriptScript = 'Devanagari';
        confidence = 0.90;
        languageEvidence = acousticLang === 'Hindi' ? 'ACOUSTIC_AUDIO_MODEL' : 'USER_SELECTION_CONTEXT';
        isMixed = containsEnglishWords(lowerText);
        transcriptStyle = isMixed ? 'MIXED' : 'ROMANIZED';
      } else if (isVoiceKannada && !isPureEnglishSentence(lowerText)) {
        primaryLang = 'Kannada';
        languageCode = 'kn-IN';
        scriptName = 'KANNADA';
        transcriptScript = 'Kannada';
        confidence = 0.90;
        languageEvidence = acousticLang === 'Kannada' ? 'ACOUSTIC_AUDIO_MODEL' : 'USER_SELECTION_CONTEXT';
        isMixed = containsEnglishWords(lowerText);
        transcriptStyle = isMixed ? 'MIXED' : 'ROMANIZED';
      } else if (isVoiceTelugu && !isPureEnglishSentence(lowerText)) {
        primaryLang = 'Telugu';
        languageCode = 'te-IN';
        scriptName = 'TELUGU';
        transcriptScript = 'Telugu';
        confidence = 0.90;
        languageEvidence = acousticLang === 'Telugu' ? 'ACOUSTIC_AUDIO_MODEL' : 'USER_SELECTION_CONTEXT';
        isMixed = containsEnglishWords(lowerText);
        transcriptStyle = isMixed ? 'MIXED' : 'ROMANIZED';
      } else if (isVoiceMalayalam && !isPureEnglishSentence(lowerText)) {
        primaryLang = 'Malayalam';
        languageCode = 'ml-IN';
        scriptName = 'MALAYALAM';
        transcriptScript = 'Malayalam';
        confidence = 0.90;
        languageEvidence = acousticLang === 'Malayalam' ? 'ACOUSTIC_AUDIO_MODEL' : 'USER_SELECTION_CONTEXT';
        isMixed = containsEnglishWords(lowerText);
        transcriptStyle = isMixed ? 'MIXED' : 'ROMANIZED';
      } else if (isVoiceMarathi && !isPureEnglishSentence(lowerText)) {
        primaryLang = 'Marathi';
        languageCode = 'mr-IN';
        scriptName = 'DEVANAGARI';
        transcriptScript = 'Devanagari';
        confidence = 0.90;
        languageEvidence = acousticLang === 'Marathi' ? 'ACOUSTIC_AUDIO_MODEL' : 'USER_SELECTION_CONTEXT';
        isMixed = containsEnglishWords(lowerText);
        transcriptStyle = isMixed ? 'MIXED' : 'ROMANIZED';
      } else if (isVoiceBengali && !isPureEnglishSentence(lowerText)) {
        primaryLang = 'Bengali';
        languageCode = 'bn-IN';
        scriptName = 'BENGALI';
        transcriptScript = 'Bengali';
        confidence = 0.90;
        languageEvidence = acousticLang === 'Bengali' ? 'ACOUSTIC_AUDIO_MODEL' : 'USER_SELECTION_CONTEXT';
        isMixed = containsEnglishWords(lowerText);
        transcriptStyle = isMixed ? 'MIXED' : 'ROMANIZED';
      } else if (isPureEnglishSentence(lowerText) || containsEnglishWords(lowerText)) {
        primaryLang = 'English';
        languageCode = 'en-IN';
        confidence = 0.92;
        scriptName = 'LATIN';
        transcriptScript = 'Latin';
        transcriptQuality = 'NATIVE';
        transcriptStyle = 'ENGLISH';
        languageEvidence = 'ENGLISH_LEXICAL';
      } else {
        // Check if it has standard Latin word and vowel structure
        const hasVowels = /[aeiouy]/i.test(lowerText);
        const hasWord = /\b[a-z]{2,}\b/i.test(lowerText);
        if (hasVowels && hasWord && !/^(kjskjd|asdf|qwerty|zzz|xxx|muffled|static)/i.test(lowerText)) {
          primaryLang = 'English';
          languageCode = 'en-IN';
          confidence = 0.80;
          scriptName = 'LATIN';
          transcriptScript = 'Latin';
          transcriptQuality = 'NATIVE';
          transcriptStyle = 'ENGLISH';
          languageEvidence = 'LATIN_HEURISTIC';
        } else {
          // Unrecognized or corrupted string
          primaryLang = 'unknown';
          languageCode = 'unknown';
          confidence = 0.25;
          scriptName = 'LATIN_UNKNOWN';
          transcriptScript = 'Unknown';
          transcriptQuality = 'UNKNOWN';
          transcriptStyle = 'UNKNOWN';
          languageEvidence = 'INSUFFICIENT_EVIDENCE';
        }
      }
    }

    // ----------------------------------------------------
    // STAGE 3 — Uncertainty Rule
    // ----------------------------------------------------
    if (confidence < 0.50 || primaryLang === 'unknown') {
      return {
        originalLanguage: 'unknown',
        detectedLanguage: 'unknown',
        detectedLanguageCode: 'unknown',
        languageCode: 'unknown',
        languageConfidence: confidence,
        confidence,
        script: 'Unknown',
        scriptName,
        scriptConfidence: 0.1,
        transcriptScript: 'Unknown',
        transcriptQuality: 'UNKNOWN',
        transcriptStyle: 'UNKNOWN',
        transcriptForm: 'unknown',
        isCodeMixed: false,
        secondaryLanguage: null,
        languageEvidence: 'UNCERTAIN',
        isMultilingual: false,
        isMixedLanguage: false,
        isUnknown: true,
        originalText,
        normalizedText,
        originalTranscript: originalText,
        nativeScriptTranscript: null,
        nativeScriptAvailable: false,
        speechRecognitionTranscript: originalText,
        normalizedTranscript: normalizedText,
        translatedTranscript: null,
        englishTranslation: null,
        normalizedMeaning: null,
      };
    }

    const scriptConfidence = (scriptInfo.isNative || nativeScriptAvailable) ? 0.99 : (confidence >= 0.85 ? 0.90 : 0.70);
    const transcriptForm = nativeScriptAvailable ? 'native' : (primaryLang !== 'English' ? (isMixed ? 'code_mixed' : 'transliterated') : 'native');
    const isCodeMixed = isMixed || transcriptStyle === 'MIXED';
    const secondaryLanguage = isCodeMixed ? (primaryLang !== 'English' ? 'English' : null) : null;

    return {
      originalLanguage: primaryLang,
      detectedLanguage: primaryLang,
      detectedLanguageCode: languageCode,
      languageCode,
      languageConfidence: confidence,
      confidence,
      script: transcriptScript,
      scriptName,
      scriptConfidence,
      transcriptScript,
      transcriptQuality: nativeScriptAvailable ? 'NATIVE' : transcriptQuality,
      transcriptStyle: isCodeMixed ? 'MIXED' : (nativeScriptAvailable ? 'NATIVE_SCRIPT' : transcriptStyle),
      transcriptForm,
      isCodeMixed,
      secondaryLanguage,
      languageEvidence,
      nativeScriptTranscript: nativeScriptTranscript || null,
      nativeScriptAvailable: Boolean(nativeScriptAvailable),
      isMultilingual: primaryLang !== 'English',
      isMixedLanguage: isCodeMixed,
      isUnknown: false,
      originalText,
      normalizedText,
      originalTranscript: nativeScriptTranscript || originalText,
      speechRecognitionTranscript: originalText,
      normalizedTranscript: normalizedText,
      translatedTranscript: rawPayload.englishTranslation || rawPayload.translatedTranscript || null,
      englishTranslation: rawPayload.englishTranslation || rawPayload.translatedTranscript || null,
      normalizedMeaning: rawPayload.normalizedMeaning || null,
    };
  }
}

function containsEnglishWords(text) {
  return /\b(the|is|in|at|we|are|need|help|there|please|send|immediate|immediately|urgently|emergency|flood|fire|rescue|water|building|police|doctor|ambulance|people|trapped|stuck|collapse|injured|accident|hospital|danger|urgent|severe|bleeding|rising|heavy|storm|cyclone|trees|road|traffic|warehouse|smoke|house|strong|river|broke|banks|rapidly|inside|street|roof|ground|area|city|damage|with|from|by|into|was|were|had|have|has|and|or|our|my|me|i|am|to|for|of|a|an)\b/i.test(text);
}

function isPureEnglishSentence(text) {
  const words = text.toLowerCase().match(/\b[a-z]+\b/g) || [];
  if (words.length === 0) return false;
  const englishKnown = new Set([
    'the', 'is', 'in', 'at', 'we', 'are', 'need', 'help', 'there', 'please', 'send', 'immediate',
    'immediately', 'urgently', 'emergency', 'flood', 'fire', 'rescue', 'water', 'building',
    'police', 'doctor', 'ambulance', 'people', 'trapped', 'stuck', 'collapse', 'injured',
    'accident', 'evacuation', 'elderly', 'children', 'hospital', 'danger', 'urgent', 'severe',
    'bleeding', 'rising', 'heavy', 'storm', 'cyclone', 'trees', 'road', 'traffic', 'highway',
    'passengers', 'flooding', 'burning', 'crushed', 'warehouse', 'smoke', 'house', 'black', 'thick',
    'collapsed', 'inside', 'around', 'under', 'on', 'my', 'me', 'i', 'am', 'to', 'for', 'of', 'a', 'an',
    'and', 'or', 'but', 'if', 'river', 'broke', 'its', 'banks', 'rapidly', 'street', 'roof', 'ground',
    'area', 'city', 'damage', 'with', 'from', 'by', 'into', 'was', 'were', 'had', 'have', 'has', 'our',
    'your', 'their', 'he', 'she', 'it', 'they', 'them', 'us', 'him', 'her', 'not', 'no'
  ]);
  const matchCount = words.filter((w) => englishKnown.has(w)).length;
  return matchCount >= 2 || matchCount / words.length >= 0.3;
}

const languageDetectionService = new LanguageDetectionService();
module.exports = languageDetectionService;
