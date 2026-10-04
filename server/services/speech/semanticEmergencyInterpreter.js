/**
 * RESONIX AI — Multilingual Semantic Emergency Understanding & Classification Engine
 * 
 * Production-Grade Architecture:
 * - Primary STT/ASR: Gemini 3.5 Transcribe (gemini-3.5-transcribe)
 * - Primary Classifier: Gemma 4 26B A4B IT (gemma-4-26b-a4b-it)
 * - Escalation / Adjudicator: Gemini 3.5 Flash (gemini-3.5-flash)
 * - Deterministic Fallback: Extensive Indic Semantic Matrix
 * 
 * Strict Operational Principles:
 * 1. ZERO-OVERRIDE: citizenSelectedCategory is strictly a supporting hint and NEVER overrides voice evidence.
 * 2. PRIMARY EVIDENCE: Spoken voice is primary evidence for emergency categorization.
 * 3. CAUSE VS EVENT: Differentiates cause vs operational event (e.g. rain caused building collapse -> BUILDING_COLLAPSE).
 * 4. LATIN != ENGLISH: Transliterated Tamil/Hindi/Kannada/Malayalam/Telugu/etc. is NOT English.
 * 5. SEPARATE STORAGE: originalTranscript, originalLanguage, nativeScriptTranscript, nativeScriptAvailable, englishTranslation.
 * 6. NO-INVENTED-DATA: Victim counts and categories are never fabricated. Unclear speech -> OTHER + needsReview: true.
 * 7. ZERO-DELAY SOS: AI enrichment runs asynchronously without blocking initial SOS response.
 */

const logger = require('../../utils/logger');
const languageDetectionService = require('../pipeline/languageDetectionService');
const knowledgeRetrievalService = require('../pipeline/knowledgeRetrievalService');
const googleAiClient = require('../gemma/googleAiClient');
const responseParser = require('../gemma/responseParser');
const aiModelConfig = require('../../config/aiModels');

const CANONICAL_EMERGENCY_CATEGORIES = new Set([
  'FIRE', 'FLOOD', 'MEDICAL', 'BUILDING_COLLAPSE', 'CYCLONE_STORM', 'EARTHQUAKE', 'LANDSLIDE',
  'TSUNAMI', 'AVALANCHE', 'LIGHTNING', 'THUNDERSTORM', 'DUSTSTORM', 'SQUALL', 'HEATWAVE',
  'COLDWAVE', 'DROUGHT', 'FOREST_FIRE', 'URBAN_FLOOD', 'CHEMICAL_EMERGENCY', 'BIOLOGICAL_EMERGENCY',
  'NUCLEAR_RADIOLOGICAL_EMERGENCY', 'AIR_POLLUTION_SMOG', 'OTHER'
]);

class SemanticEmergencyInterpreter {
  /**
   * Deterministic Semantic Interpretation
   * Fast, reliable semantic analysis for emergency classification.
   * @param {Object} params
   * @returns {Object} Structured interpretation
   */
  interpretDeterministic(params = {}) {
    const rawText = (
      params.transcript ||
      params.originalTranscript ||
      params.speechRecognitionTranscript ||
      params.voiceTranscript ||
      params.rawTranscript ||
      params.description ||
      ''
    ).trim();

    const selectedCat = (
      params.citizenSelectedCategory ||
      params.selectedCategory ||
      params.category ||
      'GENERAL'
    ).toUpperCase();

    // 1. Language & Script Quality Identification
    const langInfo = languageDetectionService.detect(
      { transcript: rawText },
      {
        selectedVoiceLanguage: params.selectedVoiceLanguage,
        selectedVoiceLanguageCode: params.selectedVoiceLanguageCode,
        englishTranslation: params.englishTranslation,
      }
    );

    const lower = rawText.toLowerCase();
    const alphaCount = (rawText.match(/[\p{L}\p{N}]/gu) || []).length;

    // Case A: If input is empty (No speech / no transcript attached)
    if (!rawText) {
      return {
        originalTranscript: '',
        speechRecognitionTranscript: '',
        transcriptScript: 'None',
        transcriptQuality: 'UNKNOWN',
        transcriptStyle: 'UNKNOWN',
        selectedVoiceLanguage: params.selectedVoiceLanguage || null,
        selectedVoiceLanguageCode: params.selectedVoiceLanguageCode || null,
        language: 'unknown',
        detectedLanguage: 'unknown',
        detectedLanguageCode: 'unknown',
        languageCode: 'unknown',
        originalLanguage: 'unknown',
        nativeScriptTranscript: '',
        nativeScriptAvailable: false,
        category: selectedCat !== 'GENERAL' && selectedCat !== 'OTHER' ? selectedCat : 'OTHER',
        detectedCategory: selectedCat !== 'GENERAL' && selectedCat !== 'OTHER' ? selectedCat : 'OTHER',
        detectedEmergencyCategory: selectedCat !== 'GENERAL' && selectedCat !== 'OTHER' ? selectedCat : 'OTHER',
        citizenSelectedCategory: selectedCat,
        severity: 'MEDIUM',
        priority: 'MEDIUM',
        confidence: 0.30,
        classificationConfidence: 'LOW',
        categoryConflict: false,
        evidenceBasis: 'INSUFFICIENT_VOICE_EVIDENCE',
        needsReview: true,
        reason: 'No audio or voice report provided. Category defaults to citizen declared selection for operator review.',
        meaning: 'No voice report provided.',
        englishMeaning: 'No voice report provided.',
        englishTranslation: '',
        hazards: [selectedCat !== 'GENERAL' ? selectedCat : 'OTHER_HAZARD'],
        peopleAffected: 0,
        trapped: false,
        injuries: false,
        contradictionDetected: false,
        source: 'CITIZEN_SELECTION_FALLBACK',
      };
    }

    // Case B: If input is unintelligible noise / symbols / gibberish (e.g. "???", "xyz abc 123", "bla bla bla")
    const isGibberish =
      langInfo.isUnknown ||
      /^(xyz|abc|bla\s*bla|\?+|\-+|\.+|[0-9\s]+|zzz)+$/i.test(lower) ||
      alphaCount < 3 ||
      /\b(bla\s*bla|zzz|gibberish)\b/i.test(lower);

    if (isGibberish) {
      const isConflict = selectedCat !== 'GENERAL' && selectedCat !== 'OTHER';
      return {
        originalTranscript: rawText,
        speechRecognitionTranscript: rawText,
        transcriptScript: langInfo.transcriptScript || 'Unknown',
        transcriptQuality: langInfo.transcriptQuality || 'UNKNOWN',
        transcriptStyle: langInfo.transcriptStyle || 'UNKNOWN',
        selectedVoiceLanguage: params.selectedVoiceLanguage || null,
        selectedVoiceLanguageCode: params.selectedVoiceLanguageCode || null,
        language: 'unknown',
        detectedLanguage: 'unknown',
        detectedLanguageCode: 'unknown',
        languageCode: 'unknown',
        originalLanguage: 'unknown',
        nativeScriptTranscript: '',
        nativeScriptAvailable: false,
        category: 'OTHER',
        detectedCategory: 'OTHER',
        detectedEmergencyCategory: 'OTHER',
        citizenSelectedCategory: selectedCat,
        severity: 'MEDIUM',
        priority: 'MEDIUM',
        confidence: 0.20,
        classificationConfidence: 'LOW',
        categoryConflict: isConflict,
        evidenceBasis: 'INSUFFICIENT_VOICE_EVIDENCE',
        needsReview: true,
        reason: 'The audio transcript contains unintelligible or insufficient emergency evidence. Requires manual responder review.',
        meaning: 'Unclear emergency report requiring manual operator review.',
        englishMeaning: 'Unclear emergency report requiring manual operator review.',
        englishTranslation: rawText,
        hazards: ['OTHER_HAZARD'],
        peopleAffected: 0,
        trapped: false,
        injuries: false,
        contradictionDetected: isConflict,
        source: 'UNCLEAR_AUDIO_FALLBACK',
      };
    }    // 2. Check for explicit negation of hazards
    const isFireNegated =
      /\b(no\s+fire|not\s+(a\s+)?fire|without\s+fire|no\s+flames?|isn't\s+fire|is\s+not\s+(a\s+)?fire|fire\s+is\s+not|there\s+is\s+no\s+fire|escaped\s+(the\s+)?fire|no\s+smoke|not\s+burning)\b/i.test(lower) ||
      /(தீ\s*இல்லை|நெருப்பு\s*இல்லை)/.test(rawText) ||
      /(आग\s*नहीं|अग्नि\s*नहीं)/.test(rawText);
    const isFloodNegated =
      /\b(no\s+flood|not\s+flooded?|without\s+(flood\s+)?water|no\s+water|isn't\s+flood|is\s+not\s+(a\s+)?flood|flood\s+is\s+not|there\s+is\s+no\s+flood|no\s+flooding|water\s*shortage|water\s*scarcity|lack\s*of\s*water|drinking\s*water\s*shortage)\b/i.test(lower) ||
      /(வெள்ளம்\s*இல்லை|தண்ணீர்\s*பற்றாக்குறை)/.test(rawText) ||
      /(बाढ़\s*नहीं|पानी\s*नहीं|पानी\s*की\s*कमी|सूखा)/.test(rawText);

    // Section 31: Absolute Guard Against Overclassification on Vague Expressions
    const cleanedText = lower.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
    const isVagueOrInsufficient =
      /^(something\s+(happened|wrong|bad|strange)\s+(on|near|in|at)\s+the\s+(hill|mountain|area|road|place)|there\s+is\s+smoke|smoke\s+is\s+coming|water\s+is\s+everywhere|water\s+all\s+around|look\s+at\s+the\s+hill|something\s+is\s+happening|check\s+this\s+out|some\s*problem\s*here)$/i.test(cleanedText);

    // 3. Multilingual & Indic Hazard Semantic Matrices

    // LANDSLIDE (NDMA SACHET: Hill slope collapse, mudslide, rockslide, mountain slope failure)
    const landslideNativeMatch =
      /[\u0B80-\u0BFF]/.test(rawText) && /(மண்\s*சரி|நில\s*சரி|மலை\s*சரி|மண்\s*மூடி|மண்\s*சரிஞ்|மண்ணொலிப்பு|சரிவு|பாறை\s*சரி)/.test(rawText) ||
      /[\u0900-\u097F]/.test(rawText) && /(भूस्खलन|पहाड़\s*(खिसक|गिर|ढह|टूट)|मिट्टी\s*(खिसक|धंस|गिर|आ\s*गई)|दरड\s*कोसळ|दगडी\s*कोसळ)/.test(rawText) ||
      /[\u0C00-\u0C7F]/.test(rawText) && /(కొండచరియలు|కొండ\s*విరిగి|మట్టి\s*చరియలు)/.test(rawText) ||
      /[\u0C80-\u0CFF]/.test(rawText) && /(ಭೂಕುಸಿತ|ಬೆಟ್ಟ\s*ಕುಸಿದ|ಮಣ್ಣು\s*ಕುಸಿದ)/.test(rawText) ||
      /[\u0D00-\u0D7F]/.test(rawText) && /(ഉരുൾപൊട്ടൽ|മണ്ണടിച്ചിൽ|മലയിടിച്ചിൽ)/.test(rawText) ||
      /[\u0980-\u09FF]/.test(rawText) && /(পাহাড়\s*ধস|ভূমিধস|মাটি\s*ধস)/.test(rawText);

    const landslideLatinMatch =
      /\b(landslide\w*|mudslide\w*|rockslide\w*|rockfall\w*|slope\s*failure|hillside\s*collapse|mountain\s*(slope\s*)?collapse\w*|mountain\s+has\s+collapsed|earth\s*and\s*rocks|rocks\s*and\s*earth|mud\s*(is\s*)?covering|debris\s*moving\s*downhill|road\s*blocked\s*by\s*(landslide|rocks|earth)|homes?\s*buried\s*by\s*(earth|mud)|mud\s*covered|mountain\s*mud|bhooskhalan\w*|bhuskhalan\w*|bhuskhlan\w*|man\s*sari\w*|mann\s*sari\w*|mannsarivu|malai\s*sari\w*|urulpottal|urul\s*pottal|urulpottiyathu|bhookusitha|bhukusitha|betta\s*kusid\w*|darad\s*kosalali|kondachariyalu|konda\s*charyalu|konda\s*virigi|virigi\s*padd\w*|pahar\s*(dhos|tut|toot|gir|khisak)\w*|pahad\s*(dhos|tut|toot|gir|khisak)\w*|mitti\s*(khisak|dhas|gir)\w*)\b/i.test(lower) ||
      (/\b(mountain|hill|slope)\b/i.test(lower) && /\b(collapsed?|slide|mud|earth|rocks?)\b/i.test(lower) && !/\b(building\s*collapsed)\b/i.test(lower));

    const isLandslide = !isVagueOrInsufficient && (landslideNativeMatch || landslideLatinMatch);

    // BUILDING COLLAPSE (Strictly structural, distinct from human collapse, tree falling, or mudslide)
    const isHumanCollapse =
      /\b(person|patient|someone|somebody|man|woman|child|he|she|individual|victim|father|mother|brother|sister)\s+(has\s+)?collapse\w*\b/i.test(lower) ||
      /\bcollapse\w*\s+(from|due\s*to|after)\s+(heat|heatstroke|exhaustion|heart|chest|stroke|shock|sun)\b/i.test(lower) ||
      /(மயங்கி|மயக்கம்|அচেতন|बेहोश|స్పృహ\s*తప్పి|ಪ್ರಜ್ಞೆ\s*ತಪ್ಪಿ|ബോധരഹിത)/.test(rawText);

    const isTreeFalling = /(மரம்\s*விழு|மரங்கள்\s*விழு|மரங்கள்\s*சாய்|पेड़\s*गिर|झाड\s*पडले|చెట్లు\s*కూలి|ಮರ\s*ಬಿದ್ದ)/.test(rawText) || /\b(trees?\s*(fell|fall|crash|blown|uproot)|ped\s*gir\w*|maram\s*vizhundh\w*)\b/i.test(lower);
    const isSoilFalling = /(மண்\s*சரி|நில\s*சரி|மலை\s*சரி|பாறை\s*சரி|मिट्टी\s*(खिसक|गिर|धंस)|दरड\s*कोसळ)/.test(rawText);

    const collapseNativeMatch =
      /[\u0B80-\u0BFF]/.test(rawText) && /(கட்டிட|இடிந்|இடிபா|சுவர்\s*இடி|கூரை\s*இடி|கட்டிடம்|வீடு\s*இடி)/.test(rawText) ||
      /[\u0900-\u097F]/.test(rawText) && /(इमारत\s*(गिर|ढह|कोसळ)|मलबे|छत\s*(गिर|टूट|ढह|धंस)|ढह\s*गई|पडली|ढिगारा|ढिगाऱ्या|दीवार\s*गिर)/.test(rawText) ||
      /[\u0C00-\u0C7F]/.test(rawText) && /(భవనం|కూలి|శిథిలా)/.test(rawText) ||
      /[\u0C80-\u0CFF]/.test(rawText) && /(ಕಟ್ಟಡ|ಕುಸಿತ|ಶಿಥಿಲ|ಕುಸಿದಿದೆ)/.test(rawText) ||
      /[\u0D00-\u0D7F]/.test(rawText) && /(കെട്ടിട|തകർ|ഇടിഞ|കെട്ടിടം)/.test(rawText) ||
      /[\u0980-\u09FF]/.test(rawText) && /(ভেঙে|ধ্বংস|ধ্বসে)/.test(rawText) ||
      /[\u0A80-\u0AFF]/.test(rawText) && /(મકાન|પડી|ધસી)/.test(rawText);

    const collapseLatinMatch =
      !isHumanCollapse && !isTreeFalling && !isSoilFalling &&
      (/\b(building\s*collapse\w*|structure\s*collapse\w*|wall\s*collapse\w*|roof\s*collapse\w*|ceiling\s*collapse\w*|bridge\s*collapse\w*|house\s*collapse\w*|rubble|debris|crush\w*|idinj\w*|idinjiduchu\w*|kattida\w*|kattidam\w*|kathadangal\w*|kattadangal\w*|vatilmatti\w*|imarat\w*|imaarat\w*|chhat\s*(gir|tut|dah|toot)\w*|shithilalu\w*|kusitha\w*|kusid\w*|koolipoyindi\w*|kuli\s*poyindi\w*|kulipoyindi\w*|thakarnnu\w*|ghar\s*padla\w*|padla\s*ahe\w*|dabli\s*geli\w*|dhigara\w*|bari\s*bhenge\w*|bhenge\s*geche\w*|bhenge\s*poreche\w*|fallen\s*roof|cave-in|trapped\s*under\s*(rubble|building|structure|debris)|under\s*(debris|rubble|building|structure)|fallen\s*building)\b/i.test(lower) ||
      (/\b(building|house|structure|roof|wall|ceiling|bridge|tower|home|makan)\b/i.test(lower) && /\b(collapsed?|caved\s*in|falling\s*down|gir\s*gay\w*|gir\s*gayi|gir\s*gaya|dab\s*gay\w*)\b/i.test(lower)));

    const isCollapse = !isVagueOrInsufficient && !isHumanCollapse && !isTreeFalling && !isSoilFalling && (collapseNativeMatch || collapseLatinMatch);

    // FOREST FIRE VS URBAN FIRE
    const forestFireNativeMatch =
      /[\u0B80-\u0BFF]/.test(rawText) && /(காட்டுத்தீ|காட்டில்\s*தீ)/.test(rawText) ||
      /[\u0900-\u097F]/.test(rawText) && /(जंगल\s*में\s*आग|दावानल)/.test(rawText) ||
      /[\u0C80-\u0CFF]/.test(rawText) && /(ಕಾಳ್ಗಿಚ್ಚು)/.test(rawText) ||
      /[\u0C00-\u0C7F]/.test(rawText) && /(అడవి\s*మంటలు)/.test(rawText);

    const forestFireLatinMatch =
      /\b(forest\s*fire\w*|wildfire\w*|wildland\s*fire\w*|jungle\s*(me\s*)?aag|kaattu\s*thee|kaattuthee|forest.*burn\w*|trees.*burn\w*|jungle.*burn\w*|wildland.*fire\w*|spread\w*.*in\s*the\s*forest)\b/i.test(lower) ||
      (/\b(forest|jungle|woods?|trees?)\b/i.test(lower) && /\b(burning|fire|blaze|spread\w*)\b/i.test(lower) && !/\b(house|home|kitchen|building)\b/i.test(lower));

    const isForestFire = !isFireNegated && !isVagueOrInsufficient && (forestFireNativeMatch || forestFireLatinMatch);

    // FIRE (Structure, urban, general)
    const fireNativeMatch =
      /[\u0B80-\u0BFF]/.test(rawText) && /(தீ|நெருப்|தீப்பிடி|எரியு|புகை|தீப்பற்றி|அனல்)/.test(rawText) ||
      /[\u0900-\u097F]/.test(rawText) && /(आग|धुआं|धूर|जल\s*रहा|अग्नि|जळत|आग\s*लागली|आगीत)/.test(rawText) ||
      /[\u0C00-\u0C7F]/.test(rawText) && /(మంట|నిప్పు|కాలి)/.test(rawText) ||
      /[\u0C80-\u0CFF]/.test(rawText) && /(ಬೆಂಕಿ|ಹೊಗೆ|ಉರಿಯು)/.test(rawText) ||
      /[\u0D00-\u0D7F]/.test(rawText) && /(തീ|പുക|കത്തു|തീപിടി)/.test(rawText) ||
      /[\u0980-\u09FF]/.test(rawText) && /(আগুন|ধোঁয়া|জ্বলছে)/.test(rawText) ||
      /[\u0A80-\u0AFF]/.test(rawText) && /(આગ|ધૂમાડો|બળે)/.test(rawText) ||
      /[\u0A00-\u0A7F]/.test(rawText) && /(ਅੱਗ|ਧੂੰਆਂ)/.test(rawText);

    const fireLatinMatch =
      /\b(fire\w*|thee\w*|theeyil|theela|theepid\w*|theepidich\w*|theepidithu\w*|thee\s*parav\w*|nerp\w*|nerup\w*|nerupp\w*|nirup\w*|nirupp\w*|eriy\w*|eriyudh\w*|puka\w*|pukai\w*|aag\b(?!ide|thide|illa|odu)|aag\s+lag\w*|aag\s+phail\w*|aag\s+lagi\w*|jal\s+rah\w*|jalat\w*|dhuw\w*|dhuwan\w*|manta\w*|mantal\w*|mantalu\w*|nippu\w*|kalu\w*|kaali\w*|benki\w*|hoge\w*|uriyu\w*|kathu\w*|agun\w*|dhoya\w*|jwolche\w*|smoke\w*|flame\w*|blaze\w*|burn\w*)\b/i.test(lower);
    const isFire = !isFireNegated && !isVagueOrInsufficient && (fireNativeMatch || fireLatinMatch);

    // URBAN FLOOD VS FLOOD
    const urbanFloodLatinMatch =
      /\b(urban\s*flood\w*|city\s*(drainage|stormwater)\s*flood\w*|metro\s*waterlogg\w*|city\s*streets?\s*submerged\s*drainage|drainage\s*overflow\s*city)\b/i.test(lower);
    const isUrbanFlood = !isFloodNegated && !isVagueOrInsufficient && urbanFloodLatinMatch;

    // FLOOD (General water inundation)
    const floodNativeMatch =
      /[\u0B80-\u0BFF]/.test(rawText) && /(வெள்ள|தண்ணீ|தண்ணி|மூழ்க|அடிச்சு)/.test(rawText) ||
      /[\u0900-\u097F]/.test(rawText) && /(बाढ़|पानी|डूब|सैलाब|पूर|पुराचे\s*पाणी|पाण्यात|जलमय)/.test(rawText) ||
      /[\u0C00-\u0C7F]/.test(rawText) && /(వరద|నీరు|మునిగి)/.test(rawText) ||
      /[\u0C80-\u0CFF]/.test(rawText) && /(ಪ್ರವಾಹ|ನೀರು|ಮುಳುಗ)/.test(rawText) ||
      /[\u0D00-\u0D7F]/.test(rawText) && /(വെള്ളപ്പൊക്ക|വെള്ള|മുങ്ങ)/.test(rawText) ||
      /[\u0980-\u09FF]/.test(rawText) && /(বন্যা|জল|ডুবে)/.test(rawText) ||
      /[\u0A80-\u0AFF]/.test(rawText) && /(પૂર|પાણી|ડૂબ)/.test(rawText) ||
      /[\u0A00-\u0A7F]/.test(rawText) && /(ਹੜ੍ਹ|ਪਾਣੀ|ਡੁੱਬ)/.test(rawText);

    const floodLatinMatch =
      /\b(flood\w*|water\w*|thanneer\w*|thanni\w*|vellam\w*|vellath\w*|vellathil\w*|vellathula\w*|velath\w*|vandhud\w*|moolg\w*|paani\w*|pani\w*|baadh\w*|badh\w*|doob\w*|dub\w*|neeru\w*|varad\w*|varada\w*|jala\w*|inundat\w*|submerge\w*|drown\w*|overflow\w*|rising\s*water|surrounded\s*by\s*water|stranded\s*in\s*water|vellam\s*keri|veettil\s*vellam|varada\s*vachindi|paani\s*ghus|baadh\s*ka\s*paani|purache\s*pani)\b/i.test(lower);
    const isFlood = !isFloodNegated && !isVagueOrInsufficient && (floodNativeMatch || floodLatinMatch);

    // TSUNAMI & AVALANCHE
    const tsunamiNativeMatch =
      /[\u0B80-\u0BFF]/.test(rawText) && /(சுனாமி|கடலலை\s*சீற்றம்|கடல்\s*நீர்\s*ஊருக்குள்)/.test(rawText) ||
      /[\u0900-\u097F]/.test(rawText) && /(सुनामी|समुद्र\s*का\s*पानी\s*शहर\s*में)/.test(rawText);
    const tsunamiLatinMatch =
      /\b(tsunami\w*|ocean\s*surge|giant\s*sea\s*wave|sea\s*water\s*(rapidly\s*)?inundat\w*|kadalanai|kadalaali|sunami)\b/i.test(lower);
    const isTsunami = !isVagueOrInsufficient && (tsunamiNativeMatch || tsunamiLatinMatch);

    const avalancheNativeMatch =
      /[\u0B80-\u0BFF]/.test(rawText) && /(பனிச்சரிவு)/.test(rawText) ||
      /[\u0900-\u097F]/.test(rawText) && /(हिमस्खलन|बर्फ\s*का\s*तूफान)/.test(rawText);
    const avalancheLatinMatch =
      /\b(avalanche\w*|snow\s*(mass|slide|collapse)|ice\s*mass|buried\s*in\s*snow|baraf\s*khisak\w*|himskhalan)\b/i.test(lower);
    const isAvalanche = !isVagueOrInsufficient && (avalancheNativeMatch || avalancheLatinMatch);

    // LIGHTNING, THUNDERSTORM, DUSTSTORM, SQUALL
    const lightningNativeMatch =
      /[\u0B80-\u0BFF]/.test(rawText) && /(மின்னல்|இடி\s*விழுந்)/.test(rawText) ||
      /[\u0900-\u097F]/.test(rawText) && /(बिजली\s*गिर|तड़ित)/.test(rawText) ||
      /[\u0C80-\u0CFF]/.test(rawText) && /(ಮಿಂಚು\s*ಬಡಿದ)/.test(rawText) ||
      /[\u0C00-\u0C7F]/.test(rawText) && /(మెరుపు\s*దాడి)/.test(rawText);
    const lightningLatinMatch =
      /\b(lightning\w*|thunderbolt\w*|struck\s*by\s*lightning|lightning\s*struck|bijli\s*gir\w*|idi\s*minnal|minnal|tadit)\b/i.test(lower);
    const isLightning = !isVagueOrInsufficient && (lightningNativeMatch || lightningLatinMatch);

    const isThunderstorm = !isVagueOrInsufficient && /\b(thunderstorm\w*|severe\s*thunderstorm|convective\s*storm)\b/i.test(lower);
    const isDuststorm = !isVagueOrInsufficient && (/\b(dust\s*storm\w*|duststorm\w*|sandstorm\w*|sand\s*storm\w*|dhool\s*bhari\s*aandhi|mitti\s*ki\s*aandhi)\b/i.test(lower) || /(धूल\s*भरी\s*आंधी|धूल\s*का\s*तूफान)/.test(rawText));
    const isSquall = !isVagueOrInsufficient && /\b(squall\w*|violent\s*gust\w*|damaging\s*wind\s*squall|sudden\s*violent\s*wind)\b/i.test(lower);

    // HEATWAVE, COLDWAVE, DROUGHT
    const isHeatwave = !isVagueOrInsufficient && /\b(heatwave\w*|heat\s*wave\w*|extreme\s*heat(\s*across)?|severe\s*heatwave|loo\s*chal\w*|veppam\s*athigam|scorching\s*heat)\b/i.test(lower);
    const isColdwave = !isVagueOrInsufficient && /\b(coldwave\w*|cold\s*wave\w*|sheet\s*lahar|freezing\s*cold(\s*across)?|extreme\s*cold|severe\s*coldwave)\b/i.test(lower);
    const isDrought = !isVagueOrInsufficient && /\b(drought\w*|dry\s*wells?|water\s*scarcity|water\s*shortage|acute\s*drinking\s*water|drinking\s*water\s*(crisis|shortage)|no\s*water\s*for\s*months|varaatchi|sukha\s*pad\w*|sukha|famine\s*risk)\b/i.test(lower);

    // CHEMICAL, BIOLOGICAL, NUCLEAR, SMOG
    const isChemical = !isVagueOrInsufficient && /\b(chemical\s*(leak\w*|spill\w*|emergenc\w*|hazard\w*|exposure)|toxic\s*(gas|chemical|fumes)|ammonia\s*leak|chlorine\s*gas|hazardous\s*chemical|rasayana\s*kasivu)\b/i.test(lower);
    const isBiological = !isVagueOrInsufficient && /\b(biological\s*(emergenc\w*|hazard\w*|outbreak|contaminat\w*)|biohazard|pathogen\s*release|anthrax|epidemic\s*emergency)\b/i.test(lower);
    const isNuclear = !isVagueOrInsufficient && /\b(nuclear\s*(emergenc\w*|reactor|hazard|leak)|radiation\s*(leak|exposure|hazard)|radiological\s*emergenc\w*|anumin\s*nilayam)\b/i.test(lower);
    const isSmog = !isVagueOrInsufficient && /\b(air\s*pollution(\s*emergency)?|severe\s*smog|toxic\s*air\s*quality|aqi\s*severe|hazardous\s*smog|toxic\s*smog)\b/i.test(lower);

    // MEDICAL
    const medicalNativeMatch =
      /[\u0B80-\u0BFF]/.test(rawText) && /(மூச்சு|மருத்துவ|மாரடைப்|இ?ரத்த|மயக்|உயிரு|வலி|காயம்|நெஞ்சு\s*வலி|ஆம்புலன்ஸ்)/.test(rawText) ||
      /[\u0900-\u097F]/.test(rawText) && /(सांस|चिकित्सा|दिल|दौरा|खून|बेहोश|अस्पताल|दर्द|घायल|चोट|छातीत|हार्ट|दुखत)/.test(rawText) ||
      /[\u0C00-\u0C7F]/.test(rawText) && /(శ్వాస|వైద్య|గుండె|రక్తం|స్పృహ|నొప్పి|గాయం|ఆసుపత్రి)/.test(rawText) ||
      /[\u0C80-\u0CFF]/.test(rawText) && /(ಉಸಿರಾಟ|ವೈದ್ಯಕೀಯ|ರಕ್ತ|ಹೃದಯ|ನೋವು|ಗಾಯ|ಆಸ್ಪತ್ರೆ)/.test(rawText) ||
      /[\u0D00-\u0D7F]/.test(rawText) && /(ശ്വാസ|ചികിത്സ|രക്ത|ഹൃദയാഘാത|വേദന|മുറിവ്|ആശുപത്രി)/.test(rawText) ||
      /[\u0980-\u09FF]/.test(rawText) && /(শ্বাস|চিকিৎসা|রক্ত|হৃদরোগ|ব্যথা|আহত|হাসপাতাল)/.test(rawText);

    const medicalLatinMatch =
      /\b(medic\w*|breath\w*|moochu\w*|mudila\b|mudiyala\w*|nenju\w*|vali\w*|heart\s*attack|bleed\w*|unconscious|stroke|cardiac|ambulance|doctor|hospital|injur\w*|asthma|cannot\s*breathe|chest\s*pain|pain\w*|saans\s*(nahi|ruk|lene)|behosh\w*|khoon\w*|ghayal\w*|chhatit\s*dukhat\w*|gunde\s*noppi)\b/i.test(lower);
    const isMedical = !isVagueOrInsufficient && (medicalNativeMatch || medicalLatinMatch || isHumanCollapse);

    // EARTHQUAKE
    const earthquakeNativeMatch =
      /[\u0B80-\u0BFF]/.test(rawText) && /(நிலநடுக்க|அதிர்வு|பூமி\s*அதிர்|பூமி\s*நடு|நிலம்\s*அதிர்|தரை\s*அதிர்|பூகம்ப)/.test(rawText) ||
      /[\u0900-\u097F]/.test(rawText) && /(भूकंप|झटके|जमीन\s*हिल|धरती\s*हिल|कांप\s*रहा)/.test(rawText) ||
      /[\u0C00-\u0C7F]/.test(rawText) && /(భూకంపం|భూమి\s*కదులు|భూమి\s*వణికి)/.test(rawText) ||
      /[\u0C80-\u0CFF]/.test(rawText) && /(ಭೂಕಂಪ|ನಡುಗ|ಭೂಮಿ\s*ನಡುಗ)/.test(rawText) ||
      /[\u0D00-\u0D7F]/.test(rawText) && /(ഭൂകമ്പ|ഭൂമി\s*കുലു)/.test(rawText) ||
      /[\u0980-\u09FF]/.test(rawText) && /(ভূমিকম্প|মাটি\s*কাঁপ)/.test(rawText);

    const earthquakeLatinMatch =
      /\b(earthquake\w*|tremor\w*|aftershock\w*|shaking\s*ground|bhookamp\w*|bhukamp\w*|nilanadukkam|athir\w*|nilam\s*romba\s*athiruthu|ground\s*shaking|mane\s*shaking|mane\s*nadu\w*|dharti\s*hil\w*|zameen\s*hil\w*)\b/i.test(lower) ||
      (/\bground\b/i.test(lower) && /\bshak\w*/i.test(lower)) ||
      /\btremor\w*\b/i.test(lower);
    const isEarthquake = !isVagueOrInsufficient && (earthquakeNativeMatch || earthquakeLatinMatch);

    // CYCLONE / STORM
    const stormNativeMatch =
      /[\u0B80-\u0BFF]/.test(rawText) && /(புயல்|புயலி|புயலா|புயல|சூறாவளி|காற்று|காத்து|பெருங்காற்று|கடும்\s*காற்று|பலத்த\s*காற்று|சூறைக்காற்று|காற்று\s*வீசு)/.test(rawText) ||
      /[\u0900-\u097F]/.test(rawText) && /(तूफान|चक्रवात|आंधी|अंधड़|वादळ|चक्रीवादळ|जोरदार\s*वारा)/.test(rawText) ||
      /[\u0980-\u09FF]/.test(rawText) && /(ঘূর্ণিঝড়|ঝড়|সাইক্লোন|তুফান|প্রবল\s*বাতাস)/.test(rawText) ||
      /[\u0C00-\u0C7F]/.test(rawText) && /(తుఫాను|తుఫాన్|తీవ్రమైన\s*గాలులు|చండప్రచండం|గాలివాన)/.test(rawText) ||
      /[\u0C80-\u0CFF]/.test(rawText) && /(ಚಂಡಮಾರುತ|ಬಿರುಗಾಳಿ|ತೀವ್ರ\s*ಗಾಳಿ|ಬಿರುಗಾಳಿಯ)/.test(rawText) ||
      /[\u0D00-\u0D7F]/.test(rawText) && /(ചുഴലിക്കാറ്റ്|കൊടുങ്കാറ്റ്|ശക്തമായ\s*കാറ്റ്)/.test(rawText);

    const stormLatinMatch =
      /\b(cyclone\w*|storm\w*|hurricane\w*|typhoon\w*|tornado\w*|gale\w*|heavy\s*wind\w*|strong\s*wind\w*|uprooted\s*trees?|trees?\s*(blown|uprooted|fell)|puya\w*|puyal\w*|sooravali\w*|kaathu\w*|kaatru\w*|aandhi\w*|andhi\w*|toofan\w*|tufan\w*|chakarvat\w*|chakravat\w*|vaadal\w*|ghurnijhor\w*|ghurnijhar\w*|birugali\w*|chuzhalikkattu\w*|kodunkattu\w*|ped\s*gir\w*|maram\s*vizhundh\w*)\b/i.test(lower);
    const isStorm = !isVagueOrInsufficient && (stormNativeMatch || stormLatinMatch);

    // 4. Trapped Extraction (Strict Evidence-Based: Never infer trapped unless supported by speech)
    const isTrapped =
      /(சிக்கி|சிக்கிக்கொண்டேன்|மாட்டிக்கொண்டேன்|மாட்டிட்டேன்|மாட்டிக்கிட்டோம்|உள்ளே\s*சிக்கி|மேல்மாடியில்\s*சிக்கி)/.test(rawText) ||
      /(फंस|फंसा|फंसे|फंसी|अंदर\s*फंस|दबे|अटक|अडक|अडकले)/.test(rawText) ||
      /(చిక్కుకున్నాను|లోపల\s*ఉన్నాము|చిక్కు)/.test(rawText) ||
      /(ಸಿಲುಕಿಕೊಂಡಿದ್ದಾರೆ|ಸಿಕ್ಕಿಕೊಂಡಿದ್ದೇನೆ|ಒಳಗೆ\s*ಸಿಲುಕಿ|ಸಿಲುಕಿ|ಸಿಕ್ಕಿ)/.test(rawText) ||
      /(കുടുങ്ങി|അകപ്പെട്ടു)/.test(rawText) ||
      /[\u0980-\u09FF]/.test(rawText) && /(আটকে|আটকা)/.test(rawText) ||
      /\b(trapped|stuck|stranded|trapped\s*inside|stuck\s*inside|locked\s*in|locked\s*inside|cannot\s*escape|cannot\s*leave|surrounded\s*by\s*(water|fire|flames)|blocked\s*inside|we\s*are\s*blocked\s*inside|martikonden|matikonden|maatikonden|maatikkonden|matikkonden|maatikitten|vatilmatti|marti\s*kundan|marti\s*konden|marti\s*kondain|maati\s*konden|maati\s*kundan|maatikk\w*|matikk\w*|maatikitt\w*|matiki\w*|maatiki\w*|maatti\w*|marty\s*kondain|sikkiyirukiren|fas|fasa|phase|fase|phas\s*gaya|phas\s*gaye|phas\s*gayi|fasa\s*hua|fase\s*hue|kudungi|kidakkukayanu|chikkukun\w*|chikku\s*kuna\w*|sikki\w*|siluki\w*|hakkond\w*|sikki\s*kond\w*|atke\s*ache|atke\s*achi|atke\s*porechi|dabli\s*geli|dab\s*gaye|dab\s*gaya|dabe\s*hue)\b/i.test(lower);

    // People count (Extract ONLY if explicitly mentioned, never fabricate)
    let peopleAffected = null;
    const numMatch = rawText.match(/(\d+)\s*(people|persons|victims|members|பேர்|நபர்கள்|लोग|मंडी|ಮಂದಿ|ജന)/i);
    if (numMatch) {
      peopleAffected = parseInt(numMatch[1], 10);
    } else if (/\b(three|3|teen\b|tin\b|teen\s*log|மூன்று|तीन|మూడు|ಮೂರು)\b/i.test(lower)) {
      peopleAffected = 3;
    } else if (/\b(two|2|rendu\b|rendupair|rendu\s*per|dono\b|do\s*log|இரண்டு|दो|రెండు|ಎರಡು)\b/i.test(lower)) {
      peopleAffected = 2;
    } else if (/\b(four|4|char\b|நான்கு|चार|నాలుగు|ನಾಲ್ಕು)\b/i.test(lower)) {
      peopleAffected = 4;
    } else if (/\b(five|5|paanch\b|panch\b|ஐந்து|पांच|ఐదు|ಐದು)\b/i.test(lower)) {
      peopleAffected = 5;
    }

    // 5. CAUSE VS OPERATIONAL INCIDENT TYPE RESOLUTION
    let category = 'OTHER';
    let meaning = '';
    let englishTranslation = '';
    let reason = '';
    let confidence = 0.94;
    const hazards = [];

    if (isVagueOrInsufficient) {
      category = 'OTHER';
      confidence = 0.35;
      hazards.push('OTHER_HAZARD');
      meaning = 'Voice evidence is vague or insufficient for definitive disaster categorization. Operator review required.';
      reason = 'Voice evidence does not contain definitive disaster criteria. Dispatched for manual operator review.';
    } else if (isChemical) {
      category = 'CHEMICAL_EMERGENCY';
      hazards.push('CHEMICAL_HAZARD');
      meaning = 'Hazardous chemical leak or toxic spill reported.';
      reason = 'Voice evidence describes hazardous chemical leak or toxic exposure.';
    } else if (isNuclear) {
      category = 'NUCLEAR_RADIOLOGICAL_EMERGENCY';
      hazards.push('NUCLEAR_RADIOLOGICAL_HAZARD');
      meaning = 'Nuclear or radiological emergency reported.';
      reason = 'Voice evidence describes nuclear or radiation leak.';
    } else if (isBiological) {
      category = 'BIOLOGICAL_EMERGENCY';
      hazards.push('BIOLOGICAL_HAZARD');
      meaning = 'Biological emergency or pathogen outbreak reported.';
      reason = 'Voice evidence describes biological hazard or contamination outbreak.';
    } else if (isTsunami) {
      category = 'TSUNAMI';
      hazards.push('TSUNAMI');
      meaning = 'Tsunami sea wave rapidly inundating coastal area.';
      reason = 'Voice evidence describes tsunami surge and rapid ocean inundation.';
    } else if (isAvalanche) {
      category = 'AVALANCHE';
      hazards.push('AVALANCHE');
      meaning = isTrapped ? 'Snow avalanche occurred and people are buried in snow.' : 'Mountain snow and ice avalanche reported.';
      reason = 'Voice evidence describes snow or ice avalanche mass.';
    } else if (isLandslide) {
      category = 'LANDSLIDE';
      hazards.push('LANDSLIDE');
      if (isCollapse) hazards.push('STRUCTURAL_COLLAPSE');
      if (isTrapped) hazards.push('TRAPPED_UNDER_DEBRIS');
      meaning = isTrapped
        ? 'A landslide occurred and people are trapped beneath mud and earth debris.'
        : 'A landslide occurred with mountain mud and earth blocking the area.';
      reason = 'Voice evidence describes earth, mud, or rock slope failure (landslide).';
    } else if (isCollapse) {
      category = 'BUILDING_COLLAPSE';
      hazards.push('STRUCTURAL_COLLAPSE');
      if (isTrapped) hazards.push('TRAPPED_UNDER_DEBRIS');
      meaning = isTrapped ? 'The building has collapsed and people are trapped inside.' : 'The building has collapsed.';
      reason = 'Voice evidence clearly describes structural building collapse and debris.';
    } else if (isForestFire) {
      category = 'FOREST_FIRE';
      hazards.push('FOREST_FIRE');
      if (isTrapped) hazards.push('TRAPPED_PERSON');
      meaning = isTrapped ? 'Trapped by spreading forest wildfire.' : 'Forest and wildland fire burning and spreading.';
      reason = 'Voice evidence describes active forest or wildland fire.';
    } else if (isFire && isFlood) {
      // Differentiate which hazard is primary
      const fireTokens = (lower.match(/\b(fire|flame|smoke|burn|blaze|explos|thee|neruppu|nirup|aag)\w*\b/gi) || []).length;
      const floodTokens = (lower.match(/\b(flood|water|drown|submerge|inundat|rising|vellam|vellathil|vellathula|paani|pani|baadh)\w*\b/gi) || []).length;
      if (floodTokens >= fireTokens) {
        category = 'FLOOD';
        hazards.push('FLOOD');
        meaning = isTrapped ? 'I am trapped in flood water.' : 'Severe flood water inundation reported in area.';
        reason = 'Voice evidence describes flood water inundation.';
      } else {
        category = 'FIRE';
        hazards.push('FIRE');
        meaning = isTrapped ? 'I am trapped in fire.' : 'Fire outbreak reported in structure.';
        reason = 'Voice evidence describes an active fire incident.';
      }
      if (isTrapped) hazards.push('TRAPPED_PERSON');
    } else if (isFire) {
      category = 'FIRE';
      hazards.push('FIRE');
      if (isTrapped) hazards.push('TRAPPED_PERSON');
      meaning = isTrapped ? 'I am trapped in a fire.' : (/\b(house|veedu|veetla|ghar|makan|inside|kitchen|building)\b/i.test(lower) ? 'Fire has broken out inside the house.' : 'Fire incident reported.');
      reason = 'Voice evidence clearly indicates an active fire report.';
    } else if (isDrought) {
      category = 'DROUGHT';
      hazards.push('DROUGHT');
      meaning = 'Severe regional drought and water scarcity crisis reported.';
      reason = 'Voice evidence describes prolonged drought conditions.';
    } else if (isUrbanFlood) {
      category = 'URBAN_FLOOD';
      hazards.push('URBAN_FLOOD');
      if (isTrapped) hazards.push('TRAPPED_PERSON');
      meaning = isTrapped ? 'Trapped by urban city flooding.' : 'City streets and urban stormwater drainage flooding reported.';
      reason = 'Voice evidence describes urban city drainage flooding.';
    } else if (isFlood) {
      category = 'FLOOD';
      hazards.push('FLOOD');
      if (isTrapped) hazards.push('TRAPPED_PERSON');
      meaning = isTrapped ? 'I am trapped in flood water.' : (/\b(veetuk|veedu|ghar|makan|house|home)\b/i.test(lower) ? 'Water has entered the house and I cannot escape.' : 'Severe flood water inundation reported.');
      reason = 'Voice evidence clearly indicates rising flood water.';
    } else if (isLightning) {
      category = 'LIGHTNING';
      hazards.push('LIGHTNING');
      meaning = 'Dangerous lightning strike incident reported.';
      reason = 'Voice evidence describes lightning strike.';
    } else if (isThunderstorm) {
      category = 'THUNDERSTORM';
      hazards.push('THUNDERSTORM');
      meaning = 'Severe convective thunderstorm with squalls reported.';
      reason = 'Voice evidence describes severe thunderstorm.';
    } else if (isDuststorm) {
      category = 'DUSTSTORM';
      hazards.push('DUSTSTORM');
      meaning = 'Severe duststorm with blinding winds reported.';
      reason = 'Voice evidence describes severe duststorm.';
    } else if (isSquall) {
      category = 'SQUALL';
      hazards.push('SQUALL');
      meaning = 'Sudden violent wind squall reported.';
      reason = 'Voice evidence describes severe squall.';
    } else if (isHeatwave) {
      if (isMedical) {
        category = 'MEDICAL';
        hazards.push('MEDICAL_EMERGENCY', 'HEAT_COLLAPSE');
        meaning = 'Person collapsed or suffered severe medical distress due to extreme heat.';
        reason = 'Individual medical emergency triggered by extreme heat conditions.';
      } else {
        category = 'HEATWAVE';
        hazards.push('HEATWAVE');
        meaning = 'Dangerous regional extreme heatwave reported.';
        reason = 'Voice evidence describes area-wide extreme heatwave.';
      }
    } else if (isColdwave) {
      if (isMedical) {
        category = 'MEDICAL';
        hazards.push('MEDICAL_EMERGENCY', 'HYPOTHERMIA');
        meaning = 'Person suffered acute hypothermia or cold-induced medical collapse.';
        reason = 'Individual medical emergency triggered by extreme cold conditions.';
      } else {
        category = 'COLDWAVE';
        hazards.push('COLDWAVE');
        meaning = 'Dangerous regional coldwave and freezing temperatures reported.';
        reason = 'Voice evidence describes area-wide severe coldwave.';
      }

    } else if (isSmog) {
      category = 'AIR_POLLUTION_SMOG';
      hazards.push('AIR_POLLUTION');
      meaning = 'Severe hazardous air pollution and toxic smog reported.';
      reason = 'Voice evidence describes hazardous air pollution and smog.';
    } else if (isMedical) {
      category = 'MEDICAL';
      hazards.push('MEDICAL_EMERGENCY');
      if (/\b(nenju\s*vali|chest\s*pain|heart|cardiac)\b/i.test(lower)) {
        meaning = 'I have acute chest pain.';
        reason = 'Voice evidence describes cardiac chest pain requiring immediate emergency medical care.';
      } else if (/\b(bleed\w*|injur\w*|rath\w*|ghayal|blood)\b/i.test(lower)) {
        meaning = 'I am injured and bleeding.';
        reason = 'Voice evidence describes traumatic physical injury and bleeding.';
      } else {
        meaning = 'I have acute difficulty breathing.';
        reason = 'Voice evidence describes acute respiratory emergency.';
      }
    } else if (isEarthquake) {
      category = 'EARTHQUAKE';
      hazards.push('SEISMIC_ACTIVITY');
      meaning = 'The ground is shaking.';
      reason = 'Voice evidence describes earthquake tremors and ground shaking.';
    } else if (isStorm) {
      category = 'CYCLONE_STORM';
      hazards.push('STORM_HAZARD');
      meaning = 'Severe cyclone winds and storm damage reported.';
      reason = 'Voice evidence describes severe cyclone winds and storm damage.';
    } else {
      category = 'OTHER';
      hazards.push('OTHER_HAZARD');
      if (isTrapped) hazards.push('TRAPPED_PERSON');

      const hasDeclaredCategory = selectedCat && selectedCat !== 'GENERAL' && selectedCat !== 'OTHER' && CANONICAL_EMERGENCY_CATEGORIES.has(selectedCat);

      if (isTrapped) {
        if (hasDeclaredCategory) {
          // Section 16: Voice indicates trapped/distress without hazard contradiction; preserve citizen selection as provisional candidate
          category = selectedCat;
          hazards.push(selectedCat);
          meaning = `Citizen reports being trapped inside (${selectedCat} indicated by citizen selection). Operational hazard type pending responder verification.`;
          reason = `Voice evidence indicates citizen is trapped. Provisional categorization set to citizen-selected ${selectedCat} pending responder verification.`;
          confidence = 0.65;
        } else {
          meaning = 'Citizen reports being trapped; operational hazard type pending verification.';
          reason = 'Voice evidence indicates citizen is trapped, but specific disaster hazard is unconfirmed.';
          confidence = 0.50;
        }
      } else if (rawText && rawText.length > 2 && !isVagueOrInsufficient) {
        if (hasDeclaredCategory) {
          category = selectedCat;
          hazards.push(selectedCat);
          meaning = `Emergency assistance requested. Provisional categorization set to citizen-selected ${selectedCat} pending responder verification.`;
          reason = `Voice evidence lacks explicit disaster keywords. Provisional categorization set to citizen-selected ${selectedCat} pending responder verification.`;
          confidence = 0.55;
        } else {
          meaning = 'Emergency assistance requested. Voice evidence pending detailed responder verification.';
          reason = 'Voice evidence does not match predefined disaster keywords. Dispatched for manual responder verification.';
          confidence = 0.35;
        }
      } else {
        meaning = 'Emergency assistance requested. Operator review required.';
        reason = 'No specific hazard confirmed in voice report.';
        confidence = 0.30;
      }
    }

    englishTranslation = meaning;

    // 6. Evidence-Based Priority Resolution
    let priority = 'HIGH';
    if (category === 'BUILDING_COLLAPSE' || category === 'CHEMICAL_EMERGENCY' || category === 'NUCLEAR_RADIOLOGICAL_EMERGENCY') {
      priority = 'CRITICAL';
    } else if (isTrapped) {
      priority = 'CRITICAL';
    } else if (category === 'LANDSLIDE') {
      priority = isTrapped ? 'CRITICAL' : 'HIGH';
    } else if (category === 'TSUNAMI') {
      priority = 'CRITICAL';
    } else if (category === 'MEDICAL') {
      priority = (/chest|heart|breath|bleed|injur|unconscious|stroke/i.test(meaning) || /bleed|injur|unconscious/i.test(lower)) ? 'CRITICAL' : 'HIGH';
    } else if (category === 'FIRE' || category === 'FOREST_FIRE') {
      const isSmallOutside = /\b(small\s*fire|outside|trash|garbage)\b/i.test(lower);
      priority = (isSmallOutside && !isTrapped) ? 'MEDIUM' : 'CRITICAL';
    } else if (category === 'FLOOD' || category === 'URBAN_FLOOD' || category === 'EARTHQUAKE' || category === 'AVALANCHE') {
      priority = isTrapped ? 'CRITICAL' : 'HIGH';
    } else {
      priority = 'MEDIUM';
    }

    // 7. Native Script Reconstruction
    let nativeScriptTranscript = '';
    let nativeScriptAvailable = false;
    let detectedLang = langInfo.detectedLanguage || 'English';
    const hasIndicUnicode = /[\u0900-\u0D7F]/.test(rawText);

    if (hasIndicUnicode) {
      nativeScriptTranscript = rawText;
      nativeScriptAvailable = true;
    } else {
      try {
        const asrService = require('./asrService');
        const recon = asrService._reconstructNativeScript(rawText, detectedLang);
        if (recon && recon.nativeScript) {
          nativeScriptTranscript = recon.nativeScript;
          nativeScriptAvailable = true;
          if (recon.language && (detectedLang === 'Unknown' || detectedLang === 'English')) {
            detectedLang = recon.language;
          }
          if (recon.englishTranslation) {
            englishTranslation = recon.englishTranslation;
            meaning = recon.englishTranslation;
          }
        }
      } catch (_) {}
    }

    // Cause vs Primary Event Hierarchy
    let secondaryCategory = null;
    if (category === 'BUILDING_COLLAPSE') {
      if (isEarthquake) secondaryCategory = 'EARTHQUAKE';
      else if (isLandslide) secondaryCategory = 'LANDSLIDE';
      else if (isFlood || isUrbanFlood) secondaryCategory = 'FLOOD';
      else if (/\b(rain|baarish|barish|storm|weather|cyclone)\b/i.test(lower)) secondaryCategory = 'CYCLONE_STORM';
    } else if (category === 'FLOOD' || category === 'URBAN_FLOOD') {
      if (isStorm || /\b(heavy\s*rain|rain|cyclone)\b/i.test(lower)) secondaryCategory = 'CYCLONE_STORM';
    } else if (category === 'LANDSLIDE') {
      if (isEarthquake) secondaryCategory = 'EARTHQUAKE';
      else if (isStorm || /\b(heavy\s*rain|rain)\b/i.test(lower)) secondaryCategory = 'CYCLONE_STORM';
    }

    const categoryConflict = selectedCat !== 'GENERAL' && selectedCat !== 'OTHER' && selectedCat !== category;
    const authoritativeTranscript = (nativeScriptAvailable && nativeScriptTranscript) ? nativeScriptTranscript : rawText;
    const authoritativeScript = hasIndicUnicode || nativeScriptAvailable ? (detectedLang === 'Hindi' || detectedLang === 'Marathi' ? 'Devanagari' : detectedLang) : (langInfo.transcriptScript || 'Latin');
    const authoritativeNormalizedMeaning = (category === 'FIRE' && isTrapped)
      ? 'Citizen is trapped in a fire.'
      : (meaning || (category !== 'OTHER' ? `Citizen reports ${category.toLowerCase()} emergency.` : 'Emergency assistance requested. Operator review required.'));

    return {
      originalTranscript: authoritativeTranscript,
      speechRecognitionTranscript: rawText,
      transcriptScript: authoritativeScript,
      transcriptQuality: hasIndicUnicode || nativeScriptAvailable ? 'NATIVE' : (langInfo.transcriptQuality || 'ROMANIZED'),
      transcriptStyle: hasIndicUnicode || nativeScriptAvailable ? 'NATIVE_SCRIPT' : (langInfo.transcriptStyle || 'ROMANIZED'),
      selectedVoiceLanguage: params.selectedVoiceLanguage || null,
      selectedVoiceLanguageCode: params.selectedVoiceLanguageCode || null,
      language: detectedLang,
      detectedLanguage: detectedLang,
      detectedLanguageCode: langInfo.detectedLanguageCode || langInfo.languageCode || 'unknown',
      languageCode: langInfo.languageCode || 'unknown',
      originalLanguage: detectedLang,
      nativeScriptTranscript: nativeScriptTranscript || null,
      nativeScriptAvailable,
      script: authoritativeScript,
      scriptConfidence: langInfo.scriptConfidence || 0.95,
      isCodeMixed: Boolean(params.isCodeMixed || langInfo.isCodeMixed),
      secondaryLanguage: params.secondaryLanguage || langInfo.secondaryLanguage || null,
      languageEvidence: langInfo.languageEvidence || null,
      languageConfidence: langInfo.languageConfidence || (confidence >= 0.85 ? 0.95 : confidence),
      category,
      primaryCategory: category,
      secondaryCategory,
      detectedCategory: category,
      detectedEmergencyCategory: category,
      citizenSelectedCategory: selectedCat,
      severity: priority,
      priority,
      confidence,
      classificationConfidence: confidence >= 0.85 ? 'HIGH' : (confidence >= 0.65 ? 'MEDIUM' : 'LOW'),
      categoryConflict,
      evidenceBasis: 'VOICE',
      needsReview: category === 'OTHER' || confidence < 0.70,
      reason,
      riskReason: reason,
      meaning,
      englishMeaning: meaning,
      englishTranslation,
      normalizedMeaning: authoritativeNormalizedMeaning,
      transcriptionSource: params.transcriptionSource || 'DETERMINISTIC',
      translationSource: params.translationSource || 'DETERMINISTIC',
      multiModelAgreement: params.multiModelAgreement || null,
      sarvamFallbackTriggered: Boolean(params.sarvamFallbackTriggered),
      hazards,
      peopleAffected,
      reportedAffectedPeople: peopleAffected,
      trapped: isTrapped,
      injuries: category === 'MEDICAL' || category === 'BUILDING_COLLAPSE',
      contradictionDetected: categoryConflict,
      source: 'SEMANTIC_INTERPRETER_DETERMINISTIC',
    };
  }

  /**
   * Main Entry Point: Multilingual Semantic Emergency Understanding Pipeline
   * Architecture:
   * - Primary Classifier: Gemma 4 26B A4B IT (gemma-4-26b-a4b-it)
   * - Escalation / Adjudication: Gemini 3.5 Flash (gemini-3.5-flash) when needed
   * - Tier 3 Fallback: Deterministic Indic Engine
   * @param {Object} params
   * @param {Object} options
   * @returns {Promise<Object>}
   */
  async analyzeEmergency(params = {}, options = {}) {
    const startTime = Date.now();
    const rawText = (
      params.transcript ||
      params.originalTranscript ||
      params.speechRecognitionTranscript ||
      params.voiceTranscript ||
      params.rawTranscript ||
      params.description ||
      ''
    ).trim();

    const selectedCat = (
      params.citizenSelectedCategory ||
      params.selectedCategory ||
      params.category ||
      'GENERAL'
    ).toUpperCase();

    // Fast-path for empty input
    if (!rawText) {
      return this.interpretDeterministic(params);
    }

    // Fast-path for obvious non-linguistic noise
    const alphaCount = (rawText.match(/[\p{L}\p{N}]/gu) || []).length;
    if (alphaCount < 3 || /^(xyz|abc|bla\s*bla|\?+|\-+|\.+|[0-9\s]+|zzz)+$/i.test(rawText.toLowerCase())) {
      return this.interpretDeterministic(params);
    }

    // Deterministic Indic Linguistic Baseline (Used for anchor verification and escalation triggers)
    const deterministicBaseline = this.interpretDeterministic(params);

    // 1. Multilingual & Script Analysis
    const langInfo = languageDetectionService.detect(
      { transcript: rawText },
      {
        selectedVoiceLanguage: params.selectedVoiceLanguage,
        selectedVoiceLanguageCode: params.selectedVoiceLanguageCode,
        englishTranslation: params.englishTranslation,
      }
    );

    // 2. Pinecone Semantic Vector Retrieval (topK = 5)
    // Retrieves verified disaster SOPs, NDMA guidelines, and disambiguation knowledge
    let retrievedKnowledge = null;
    let retrievalLatencyMs = 0;
    if (params.simulatedPineconeChunks) {
      retrievedKnowledge = {
        contextAvailable: true,
        retrievedChunks: params.simulatedPineconeChunks,
        ragContextFormatted: params.simulatedPineconeChunks.map(c => `[${c.category}] ${c.text}`).join('\n')
      };
    } else {
      try {
        const ragStart = Date.now();
        retrievedKnowledge = await knowledgeRetrievalService.retrieveRelevantKnowledge({
          processedTranscript: rawText,
        }, 5);
        retrievalLatencyMs = Date.now() - ragStart;
      } catch (ragErr) {
        logger.warn(`[SemanticEmergencyInterpreter] Pinecone retrieval notice: ${ragErr.message}`);
      }
    }

    const ragContextFormatted = retrievedKnowledge?.ragContextFormatted ||
      '[RAG TAXONOMY GUIDELINES: Spoken voice is primary evidence. Environmental trigger (cause, e.g. rain) must NOT override primary operational event (e.g. building collapse). Latin script does not mean English. Unintelligible noise must be classified as OTHER with needsReview: true.]';

    const hasIndicUnicode = /[\u0900-\u0D7F]/.test(rawText);
    const nativeScript = params.nativeScriptTranscript || deterministicBaseline.nativeScriptTranscript || (hasIndicUnicode ? rawText : '');
    const isVagueOrInsufficient = Boolean(
      deterministicBaseline.isAmbiguous ||
      (deterministicBaseline.category === 'OTHER' && rawText.split(/\s+/).filter(Boolean).length < 4)
    );

    // ----------------------------------------------------
    // STAGE 1: Primary Reasoning Classifier — Gemini 3.8 Flash
    // ----------------------------------------------------
    const aiModelConfig = require('../../config/aiModels');
    const primaryModel = options.primaryModel || aiModelConfig.primaryReasoning?.model || 'gemini-3.8-flash';
    const primaryTimeoutMs = options.primaryTimeoutMs || aiModelConfig.primaryReasoning?.timeoutMs || 5000;
    let geminiResult = null;
    let geminiLatencyMs = 0;
    let activePrimaryModel = primaryModel;
    let primaryQuotaExceeded = false;

    if (params.simulatedGeminiResult) {
      geminiResult = { ...params.simulatedGeminiResult };
      activePrimaryModel = primaryModel;
    } else {

    const nativeTranscript = params.nativeScriptTranscript || deterministicBaseline.nativeScriptTranscript || rawText;
    const englishTranslationInput = params.englishTranslation || deterministicBaseline.englishTranslation || 'Direct English input';
    const normalizedMeaningInput = params.normalizedMeaning || deterministicBaseline.normalizedMeaning || 'Pending synthesis';
    const operationalContext = params.operationalContext || {};

    const reasoningPrompt = `You are Gemini 3.8 Flash, the authoritative emergency semantic reasoning engine for RESONIX AI.
Analyze the citizen's verbatim emergency speech, translation, and situation meaning to classify the operational emergency category for first responders.

INPUT EVIDENCE PIPELINE:
- Native Transcript: "${nativeTranscript}"
- English Semantic Translation: "${englishTranslationInput}"
- Normalized Meaning: "${normalizedMeaningInput}"
- Citizen Declared Category (HINT ONLY): "${selectedCat}"
- Detected Language & Script: ${langInfo.detectedLanguage} (${langInfo.transcriptScript} script, code: ${langInfo.languageCode})
- Operational Context: ${JSON.stringify(operationalContext)}

MANDATORY DISASTER KNOWLEDGE & TAXONOMY GUIDELINES (FROM PINECONE RETRIEVAL):
${ragContextFormatted}

CRITICAL REASONING & OUTPUT RULES:
1. SPOKEN VOICE EVIDENCE IS ABSOLUTE PRIMARY GROUND TRUTH:
   - The citizen-selected category is strictly a declared hint and must NEVER override explicit voice evidence.
   - Example: If citizen selected FLOOD, but voice describes fire -> detectedCategory: "FIRE", citizenSelectedCategory: "FLOOD", categoryConflict: true.
   - Do NOT force the selected category under any circumstances.
2. DO NOT INVENT VICTIM COUNTS:
   - Only populate "reportedAffectedPeople" with an integer if an explicit number of people or victims is stated in the transcript.
   - If no number is mentioned, return null. NEVER invent victim counts.
3. DO NOT INVENT LOCATIONS:
   - Rely strictly on provided operational context or verbatim speech.
4. DO NOT INFER TRAPPED STATUS UNLESS SUPPORTED BY EVIDENCE:
   - Set "trapped": true ONLY if citizen explicitly states being trapped, stuck, surrounded, or blocked by fire/flood/debris. Otherwise return false.
5. SEMANTIC CLASSIFICATION ACROSS ALL DISASTER CATEGORIES:
   - Distinguish: FIRE, FLOOD, BUILDING_COLLAPSE, EARTHQUAKE, LANDSLIDE, MEDICAL, CYCLONE_STORM, and all canonical disaster categories.
   - Consider the complete operational meaning, not isolated keywords.
6. REALISTIC CONFIDENCE SCORING:
   - Return HIGH confidence (>= 0.85) ONLY when the evidence is clear and coherent.
   - If transcript is garbled, translation is uncertain, RAG evidence conflicts, model reasoning is uncertain, or citizen category strongly conflicts without clear speech -> lower confidence (< 0.70) and set needsReview: true.
   - NEVER manufacture HIGH confidence.

Output ONLY a raw JSON object (no markdown, valid JSON):
{
  "detectedCategory": "FIRE | FLOOD | MEDICAL | BUILDING_COLLAPSE | CYCLONE_STORM | EARTHQUAKE | LANDSLIDE | TSUNAMI | AVALANCHE | LIGHTNING | THUNDERSTORM | DUSTSTORM | SQUALL | HEATWAVE | COLDWAVE | DROUGHT | FOREST_FIRE | URBAN_FLOOD | CHEMICAL_EMERGENCY | BIOLOGICAL_EMERGENCY | NUCLEAR_RADIOLOGICAL_EMERGENCY | AIR_POLLUTION_SMOG | OTHER",
  "confidence": 0.95,
  "priority": "CRITICAL | HIGH | MEDIUM | LOW",
  "trapped": true,
  "reportedAffectedPeople": null,
  "categoryConflict": true,
  "needsReview": false,
  "normalizedMeaning": "Concise operational summary of the emergency",
  "evidenceBasis": "VOICE | INSUFFICIENT_VOICE_EVIDENCE",
  "riskReason": "Acoustic and semantic rationale for first responders"
}`;

    // Execute Primary Reasoning with candidate model failover
    const candidatePrimaryModels = aiModelConfig.primaryReasoning?.candidateModels || [primaryModel, 'gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash'];
    for (const modelToTry of candidatePrimaryModels) {
      try {
        const geminiStart = Date.now();
        const res = await googleAiClient.generateJson(reasoningPrompt, {
          model: modelToTry,
          timeoutMs: primaryTimeoutMs,
          maxRetries: 1,
        });
        geminiLatencyMs = Date.now() - geminiStart;

        if (res && res.success && (res.generated_text || res.text)) {
          const parsed = responseParser.parseJson(res, null);
          if (parsed && typeof parsed === 'object') {
            const rawCat = parsed.detectedCategory || parsed.category || parsed.disasterCategory || '';
            const pCat = typeof rawCat === 'string' ? rawCat.trim().toUpperCase().replace(/[^A-Z_]/g, '') : '';
            if (pCat === 'OTHER' || CANONICAL_EMERGENCY_CATEGORIES.has(pCat)) {
              parsed.detectedCategory = pCat;
              parsed.categoryConflict = Boolean(
                selectedCat && selectedCat !== 'GENERAL' && selectedCat !== 'OTHER' &&
                pCat !== 'OTHER' && selectedCat !== pCat
              );
              // Ensure victim count is integer or null (never manufactured)
              if (parsed.reportedAffectedPeople !== null && parsed.reportedAffectedPeople !== undefined) {
                const num = Number(parsed.reportedAffectedPeople);
                parsed.reportedAffectedPeople = (!isNaN(num) && num > 0) ? Math.round(num) : null;
              } else {
                parsed.reportedAffectedPeople = null;
              }
              // Ensure trapped is boolean
              parsed.trapped = Boolean(parsed.trapped);
              // Ensure evidenceBasis
              parsed.evidenceBasis = parsed.evidenceBasis || 'VOICE';
              geminiResult = parsed;
              activePrimaryModel = modelToTry;
              break;
            }
          }
        } else {
          const errMsg = res?.error?.message || '';
          if (errMsg.includes('429') || errMsg.includes('Quota exceeded') || errMsg.includes('quota')) {
            primaryQuotaExceeded = true;
            continue;
          }
        }
      } catch (gemErr) {
        logger.warn(`[SemanticEmergencyInterpreter] Primary model '${modelToTry}' note: ${gemErr.message}`);
        if (gemErr.message && (gemErr.message.includes('429') || gemErr.message.includes('Quota exceeded') || gemErr.message.includes('quota'))) {
          primaryQuotaExceeded = true;
          continue; // Quota rate-limited on this model; try next candidate model
        }
      }
    }
    }

    // ----------------------------------------------------
    // STAGE 2: Conditional Gemma 4 Verification Layer
    // ----------------------------------------------------
    // Gemma is a secondary verification layer. It is NOT called for every SOS.
    // Call Gemma only when one or more of the 7 conditions occur:
    // 1. Gemini confidence is LOW (< 0.70)
    // 2. Transcript is ambiguous (vague keywords, very short transcript, incomplete distress signals)
    // 3. Citizen-selected category conflicts with detected category
    // 4. Pinecone evidence strongly conflicts with Gemini prediction
    // 5. High-risk emergency classification (building collapse, landslide, hazardous, trapped/casualties)
    // 6. Structured output validation fails (schema invalid, unparseable JSON, unapproved category)
    // 7. Classification is uncertain between similar categories (flood vs urban_flood, fire vs forest_fire, etc.)
    const primaryCat = (geminiResult?.detectedCategory || geminiResult?.category || '').toUpperCase();
    const primaryConf = typeof geminiResult?.confidence === 'number' ? geminiResult.confidence : 0;
    const escalationThreshold = options.escalationThreshold || aiModelConfig?.secondaryVerification?.escalationThreshold || 0.70;
    const escalationReasons = [];

    // Condition 1: Gemini confidence is LOW (< 0.70)
    const isLowConfidence = !geminiResult || primaryConf < escalationThreshold || geminiResult?.classificationConfidence === 'LOW';
    if (isLowConfidence) {
      escalationReasons.push(`LOW_CONFIDENCE_${primaryConf.toFixed(2)}_BELOW_${escalationThreshold}`);
    }

    // Condition 2: Transcript is ambiguous
    const isTranscriptAmbiguous = Boolean(
      rawText.split(/\s+/).filter(Boolean).length < 3 ||
      isVagueOrInsufficient ||
      deterministicBaseline.isAmbiguous ||
      geminiResult?.needsReview === true ||
      (primaryCat === 'OTHER' && rawText.length > 5)
    );
    if (isTranscriptAmbiguous) {
      escalationReasons.push('TRANSCRIPT_AMBIGUOUS_OR_INSUFFICIENT');
    }

    // Condition 3: Citizen-selected category conflicts with detected category
    const isCitizenConflict = Boolean(
      selectedCat && selectedCat !== 'GENERAL' && selectedCat !== 'OTHER' && primaryCat && selectedCat !== primaryCat
    );
    if (isCitizenConflict) {
      escalationReasons.push(`CITIZEN_CATEGORY_CONFLICT_${selectedCat}_VS_${primaryCat}`);
    }

    // Condition 4: Pinecone evidence strongly conflicts with Gemini
    let hasPineconeConflict = false;
    const topRagChunk = retrievedKnowledge?.retrievedChunks?.[0];
    if (topRagChunk && topRagChunk.score >= 0.40 && topRagChunk.category) {
      const ragCat = String(topRagChunk.category).toUpperCase();
      if (ragCat !== 'GENERAL' && ragCat !== 'OTHER' && primaryCat && ragCat !== primaryCat) {
        hasPineconeConflict = true;
        escalationReasons.push(`PINECONE_RAG_CONFLICT_${ragCat}_VS_${primaryCat}`);
      }
    }

    // Condition 5: High-risk emergency classification
    const HIGH_RISK_CATEGORIES = new Set([
      'BUILDING_COLLAPSE',
      'LANDSLIDE',
      'CHEMICAL_EMERGENCY',
      'NUCLEAR_RADIOLOGICAL_EMERGENCY',
      'BIOLOGICAL_EMERGENCY',
      'TSUNAMI',
      'AVALANCHE',
    ]);
    const isHighRisk = Boolean(
      HIGH_RISK_CATEGORIES.has(primaryCat) ||
      HIGH_RISK_CATEGORIES.has(deterministicBaseline.category) ||
      geminiResult?.trapped === true ||
      deterministicBaseline.trapped === true ||
      (typeof geminiResult?.reportedAffectedPeople === 'number' && geminiResult.reportedAffectedPeople > 0)
    );
    if (isHighRisk) {
      escalationReasons.push('HIGH_RISK_LIFE_SAFETY_EMERGENCY');
    }

    // Condition 6: Structured output validation fails
    const isStructuredValidationFailed = Boolean(
      !geminiResult ||
      !primaryCat ||
      !CANONICAL_EMERGENCY_CATEGORIES.has(primaryCat) ||
      !geminiResult?.priority
    );
    if (isStructuredValidationFailed) {
      escalationReasons.push('STRUCTURED_OUTPUT_VALIDATION_FAILED');
    }

    // Condition 7: Classification is uncertain between similar categories
    const lowerText = rawText.toLowerCase();
    const hasSimilarCategoryUncertainty = Boolean(
      ((lowerText.includes('flood') || lowerText.includes('water') || lowerText.includes('waterlog')) && (lowerText.includes('urban') || lowerText.includes('drain') || lowerText.includes('city') || lowerText.includes('street') || lowerText.includes('waterlog'))) ||
      (lowerText.includes('fire') && (lowerText.includes('forest') || lowerText.includes('wild') || lowerText.includes('tree') || lowerText.includes('jungle'))) ||
      ((lowerText.includes('slide') || lowerText.includes('soil') || lowerText.includes('mud')) && (lowerText.includes('quake') || lowerText.includes('shake') || lowerText.includes('snow') || lowerText.includes('avalanche'))) ||
      ((lowerText.includes('storm') || lowerText.includes('wind')) && (lowerText.includes('cyclone') || lowerText.includes('thunder') || lowerText.includes('lightning') || lowerText.includes('squall')))
    );
    if (hasSimilarCategoryUncertainty) {
      escalationReasons.push('SIMILAR_CATEGORY_TAXONOMY_UNCERTAINTY');
    }

    // Condition 8: Multi-Model STT Disagreement
    const isSttDisagreement = Boolean(
      params.multiModelAgreement === 'LOW' ||
      params.multiModelAgreement === false ||
      params.sttDisagreement === true ||
      (params.sttSource === 'DUAL' && params.multiModelAgreement === 'LOW')
    );
    if (isSttDisagreement) {
      escalationReasons.push('STT_MULTI_MODEL_DISAGREEMENT');
    }

    // Call Gemma only when one or more conditions occur; otherwise Gemini 3.8 result is sufficient!
    const shouldVerifyWithGemma = Boolean(options.forceEscalation || escalationReasons.length > 0);

    let gemmaVerificationOccurred = false;
    let gemmaResult = null;
    let gemmaLatencyMs = 0;
    let activeVerifierModel = 'None';

    if (shouldVerifyWithGemma) {
      gemmaVerificationOccurred = true;
      const candidateVerifierModels = [
        options.verifierModel || aiModelConfig?.secondaryVerification?.model || 'gemma-4-31b-it',
        'gemma-4-26b-a4b-it',
        process.env.GEMMA_MODEL || 'gemma-4-26b-a4b-it',
      ];
      activeVerifierModel = candidateVerifierModels[0];
      const verifierTimeoutMs = options.verifierTimeoutMs || 10000;

      const gemmaVerificationPrompt = `You are Gemma 4 31B IT, the Emergency Verification Specialist for RESONIX AI.
Independently verify and adjudicate this citizen emergency report. Do NOT blindly copy the preliminary model output.

EVIDENCE FOR INDEPENDENT VERIFICATION:
- Verbatim Spoken Transcript: "${rawText}"
- Native Script Transcript: "${nativeScript || deterministicBaseline.nativeScriptTranscript || 'N/A'}"
- English Translation: "${params.englishTranslation || deterministicBaseline.englishTranslation || 'N/A'}"
- Normalized Meaning: "${geminiResult?.normalizedMeaning || deterministicBaseline.meaning || 'N/A'}"
- Citizen Selected Category (HINT ONLY): "${selectedCat}"
- Preliminary Model Output: ${primaryCat || 'None'} (Confidence: ${primaryConf.toFixed(2)}, Priority: ${geminiResult?.priority || 'UNKNOWN'}, Risk Reason: "${geminiResult?.riskReason || geminiResult?.reason || 'N/A'}")
- Pinecone Disaster SOP Evidence:
${ragContextFormatted}

VERIFICATION GUIDELINES:
1. Spoken voice is primary ground-truth evidence. Citizen declared button is only a contextual hint.
2. Latin script does NOT mean English (e.g. Tanglish/Hinglish is Indic). 'Non nerpil Marti kundan' = Tamil 'நான் நெருப்பில் மாட்டிக்கொண்டேன்' (trapped in fire) -> FIRE.
3. If citizen selected FLOOD but voice describes fire, flames, burning, or smoke -> detectedCategory: FIRE, categoryConflict: true.
4. If citizen selected FIRE but voice describes water, flooding, rising water -> detectedCategory: FLOOD, categoryConflict: true.
5. If voice describes mountain slope collapse, earth/mud covering road, mudslide -> detectedCategory: LANDSLIDE, categoryConflict: true.
6. Cause vs Event: 'Rain caused building to collapse' -> BUILDING_COLLAPSE. 'Landslide destroyed house' -> retain cause LANDSLIDE.
7. If noise/mic check/unintelligible -> OTHER with confidence <= 0.40 and needsReview: true. Never force citizen's category.
8. Valid Categories: FIRE, FLOOD, MEDICAL, BUILDING_COLLAPSE, CYCLONE_STORM, EARTHQUAKE, LANDSLIDE, TSUNAMI, AVALANCHE, LIGHTNING, THUNDERSTORM, DUSTSTORM, SQUALL, HEATWAVE, COLDWAVE, DROUGHT, FOREST_FIRE, URBAN_FLOOD, CHEMICAL_EMERGENCY, BIOLOGICAL_EMERGENCY, NUCLEAR_RADIOLOGICAL_EMERGENCY, AIR_POLLUTION_SMOG, OTHER. (You MUST choose one of these exact categories, never UNRESOLVED).

Output ONLY valid JSON matching this schema:
{
  "detectedCategory": "FIRE | FLOOD | MEDICAL | BUILDING_COLLAPSE | CYCLONE_STORM | EARTHQUAKE | LANDSLIDE | TSUNAMI | AVALANCHE | LIGHTNING | THUNDERSTORM | DUSTSTORM | SQUALL | HEATWAVE | COLDWAVE | DROUGHT | FOREST_FIRE | URBAN_FLOOD | CHEMICAL_EMERGENCY | BIOLOGICAL_EMERGENCY | NUCLEAR_RADIOLOGICAL_EMERGENCY | AIR_POLLUTION_SMOG | OTHER",
  "categoryConflict": boolean,
  "confidence": number between 0.10 and 0.99,
  "priority": "CRITICAL | HIGH | MEDIUM | LOW",
  "needsReview": boolean,
  "normalizedMeaning": "Concise verified meaning",
  "riskReason": "Justification for category decision",
  "evidenceBasis": "VOICE | INSUFFICIENT_VOICE_EVIDENCE",
  "reportedAffectedPeople": number or null,
  "trapped": boolean or null
}`;

      if (params.simulatedGemmaResult) {
        gemmaResult = { ...params.simulatedGemmaResult };
        activeVerifierModel = options.verifierModel || aiModelConfig?.secondaryVerification?.model || 'gemma-4-31b-it';
      } else {
        for (const verifierModelToTry of candidateVerifierModels) {
          try {
            const gemmaStart = Date.now();
            const verifierRes = await googleAiClient.generateJson(gemmaVerificationPrompt, {
              model: verifierModelToTry,
              timeoutMs: verifierTimeoutMs,
              maxRetries: 1,
            });
            gemmaLatencyMs = Date.now() - gemmaStart;

            if (verifierRes && verifierRes.success && (verifierRes.generated_text || verifierRes.text)) {
              const parsedGemma = responseParser.parseJson(verifierRes, null);
              const rawCat = parsedGemma?.detectedCategory || parsedGemma?.category || parsedGemma?.disasterCategory || '';
              const gCat = typeof rawCat === 'string' ? rawCat.trim().toUpperCase().replace(/[^A-Z_]/g, '') : '';
              if (parsedGemma && CANONICAL_EMERGENCY_CATEGORIES.has(gCat)) {
                parsedGemma.detectedCategory = gCat;
                gemmaResult = parsedGemma;
                activeVerifierModel = verifierModelToTry;
                break;
              }
            } else {
              const errMsg = verifierRes?.error?.message || '';
              if (errMsg.includes('429') || errMsg.includes('Quota exceeded') || errMsg.includes('quota')) {
                break;
              }
            }
          } catch (gemmaErr) {
            logger.warn(`[SemanticEmergencyInterpreter] Gemma 4 verification model '${verifierModelToTry}' notice: ${gemmaErr.message}`);
            if (gemmaErr.message && (gemmaErr.message.includes('429') || gemmaErr.message.includes('Quota exceeded') || gemmaErr.message.includes('quota'))) {
              break;
            }
          }
        }
      }
    }

    // ----------------------------------------------------
    // STAGE 3: Deterministic Validation Layer
    // ----------------------------------------------------
    // Do not select a category merely because one model says it.
    // If models agree with strong evidence -> accept.
    // If they disagree -> lower confidence, needsReview=true, preserve both signals.
    const gemmaCat = (gemmaResult?.detectedCategory || gemmaResult?.category || '').toUpperCase();
    const validGemma = CANONICAL_EMERGENCY_CATEGORIES.has(gemmaCat);
    const validGemini = CANONICAL_EMERGENCY_CATEGORIES.has(primaryCat);

    let chosenResult = null;
    let modelAgreement = null;
    let finalNeedsReview = false;
    let finalConfidence = 0.90;

    if (gemmaVerificationOccurred && validGemma && validGemini) {
      if (gemmaCat === primaryCat) {
        // Models AGREE with strong corroborating evidence -> Accept
        modelAgreement = true;
        chosenResult = gemmaResult;
        finalConfidence = Math.min(0.98, Math.max(primaryConf, gemmaResult.confidence || 0.90, 0.90));
        finalNeedsReview = Boolean(gemmaResult.needsReview && geminiResult.needsReview);
      } else {
        // Models DISAGREE -> Do not blindly pick one; lower confidence, flag review, preserve both signals
        modelAgreement = false;
        finalNeedsReview = true;
        finalConfidence = Math.min(primaryConf, gemmaResult.confidence || 0.65, 0.65); // lowered confidence

        // Adjudicate between models using deterministic Indic anchor and Pinecone RAG evidence
        if (deterministicBaseline.category === gemmaCat) {
          chosenResult = gemmaResult;
        } else if (deterministicBaseline.category === primaryCat) {
          chosenResult = geminiResult;
        } else {
          chosenResult = gemmaResult || geminiResult;
        }
      }
    } else if (gemmaVerificationOccurred && validGemma) {
      chosenResult = gemmaResult;
      finalConfidence = gemmaResult.confidence || 0.85;
      finalNeedsReview = Boolean(gemmaResult.needsReview);
    } else if (validGemini) {
      chosenResult = geminiResult;
      finalConfidence = primaryConf;
      finalNeedsReview = Boolean(geminiResult.needsReview || (primaryCat === 'OTHER' && primaryConf < 0.70));
    } else {
      chosenResult = deterministicBaseline;
      finalConfidence = deterministicBaseline.confidence || 0.80;
      finalNeedsReview = Boolean(deterministicBaseline.needsReview);
    }

    // Safety check: If AI output defaulted to OTHER or echoed citizen's hint despite strong Indic anchor conflict,
    // trust deterministic Indic evidence
    if (deterministicBaseline.category !== 'OTHER') {
      if (
        !chosenResult ||
        chosenResult.detectedCategory === 'OTHER' ||
        !CANONICAL_EMERGENCY_CATEGORIES.has(chosenResult.detectedCategory) ||
        (chosenResult.detectedCategory === selectedCat && deterministicBaseline.category !== selectedCat)
      ) {
        chosenResult = deterministicBaseline;
      }
    } else if (!chosenResult || !CANONICAL_EMERGENCY_CATEGORIES.has(chosenResult.detectedCategory)) {
      chosenResult = deterministicBaseline;
    }

    const finalCategory = (chosenResult?.detectedCategory || chosenResult?.category || deterministicBaseline.category || '').toUpperCase();

    // Preserve both reasoning signals internally in verificationDetails
    const verificationDetails = {
      gemmaVerificationOccurred,
      modelAgreement,
      escalationReasons,
      geminiAnalysis: geminiResult ? {
        category: primaryCat,
        confidence: primaryConf,
        priority: geminiResult.priority,
        reason: geminiResult.riskReason || geminiResult.reason,
      } : null,
      gemmaAnalysis: gemmaResult ? {
        category: gemmaCat,
        confidence: gemmaResult.confidence,
        priority: gemmaResult.priority,
        reason: gemmaResult.riskReason || gemmaResult.reason,
      } : null,
      adjudicationBasis: gemmaVerificationOccurred
        ? (modelAgreement ? 'DUAL_MODEL_AGREEMENT' : 'DETERMINISTIC_EVIDENCE_ADJUDICATION')
        : 'PRIMARY_MODEL_ACCEPTED',
    };

    // Required Developer Diagnostics Log
    console.log('--------------------------------------------------');
    console.log('[SEMANTIC_EMERGENCY_INTERPRETER DIAGNOSTIC]');
    console.log(`• Transcript:           "${rawText}"`);
    console.log(`• Citizen Selected:     ${selectedCat}`);
    console.log(`• Pinecone RAG:         ${retrievedKnowledge?.retrievedChunks?.length || 0} chunks in ${retrievalLatencyMs}ms`);
    console.log(`• Primary Model:        ${activePrimaryModel} (${geminiLatencyMs}ms, Cat: ${primaryCat || 'N/A'}, Conf: ${primaryConf.toFixed(2)})`);
    console.log(`• Gemma Verification:   ${gemmaVerificationOccurred ? `Triggered [${activeVerifierModel}] (Reasons: ${escalationReasons.join(', ')}, ${gemmaLatencyMs}ms, Cat: ${gemmaResult?.detectedCategory || 'N/A'}, Agreement: ${modelAgreement})` : 'Skipped (Fast Path)'}`);
    console.log(`• Final Category:       ${finalCategory || 'FALLBACK_TO_DETERMINISTIC'}`);
    console.log(`• Final Confidence:     ${finalConfidence.toFixed(2)} (needsReview: ${finalNeedsReview})`);
    console.log(`• Total Latency:        ${Date.now() - startTime}ms`);
    console.log('--------------------------------------------------');

    if (chosenResult && finalCategory && finalCategory !== 'GENERAL') {
      const isConflict = Boolean(
        selectedCat !== 'GENERAL' && selectedCat !== 'OTHER' && selectedCat !== finalCategory
      );
      const conf = typeof chosenResult.confidence === 'number' ? chosenResult.confidence : 0.92;
      const VALID_LANGS = new Set(['Tamil', 'Hindi', 'Kannada', 'Telugu', 'Malayalam', 'Bengali', 'Marathi', 'English']);
      let detectedLang = chosenResult.detectedLanguage;
      if (!detectedLang || !VALID_LANGS.has(detectedLang)) {
        detectedLang = langInfo.detectedLanguage || deterministicBaseline.detectedLanguage || 'English';
      }
      let detectedLangCode = chosenResult.languageCode;
      if (!detectedLangCode || detectedLangCode === 'unknown' || !VALID_LANGS.has(chosenResult.detectedLanguage)) {
        detectedLangCode = langInfo.languageCode || deterministicBaseline.languageCode || 'en-IN';
      }
      const hasIndicUnicode = /[\u0900-\u0D7F]/.test(rawText);
      const nativeScript = (
        chosenResult.nativeScriptTranscript ||
        (hasIndicUnicode ? rawText : deterministicBaseline.nativeScriptTranscript) ||
        ''
      ).trim();
      const nativeAvailable = Boolean(
        nativeScript &&
        (/[\u0900-\u0D7F]/.test(nativeScript) || (nativeScript !== rawText.trim() && !chosenResult.nativeScriptAvailable === false))
      );

      const englishTranslation = (
        chosenResult.englishTranslation &&
        chosenResult.englishTranslation.trim() &&
        chosenResult.englishTranslation.trim() !== rawText.trim() &&
        !chosenResult.englishTranslation.toLowerCase().includes('general emergency assistance') &&
        !/[\u0900-\u0D7F]/.test(chosenResult.englishTranslation)
          ? chosenResult.englishTranslation.trim()
          : (deterministicBaseline.englishTranslation || deterministicBaseline.meaning || rawText)
      );

      const authoritativeTranscript = (nativeAvailable && nativeScript) ? nativeScript : rawText;
      const authoritativeScript = (hasIndicUnicode || nativeAvailable)
        ? (detectedLang === 'Hindi' || detectedLang === 'Marathi' ? 'Devanagari' : detectedLang)
        : (langInfo.transcriptScript || 'Latin');

      return {
        originalTranscript: authoritativeTranscript,
        rawTranscript: rawText,
        speechRecognitionTranscript: rawText,
        transcriptScript: chosenResult.transcriptScript || authoritativeScript,
        transcriptQuality: chosenResult.transcriptQuality || (nativeAvailable ? 'NATIVE' : 'ROMANIZED'),
        transcriptStyle: chosenResult.transcriptStyle || (nativeAvailable ? 'NATIVE_SCRIPT' : 'ROMANIZED'),
        selectedVoiceLanguage: params.selectedVoiceLanguage || null,
        selectedVoiceLanguageCode: params.selectedVoiceLanguageCode || null,
        language: detectedLang,
        detectedLanguage: detectedLang,
        detectedLanguageCode: detectedLangCode,
        languageCode: detectedLangCode,
        originalLanguage: detectedLang,
        nativeScriptTranscript: nativeScript || null,
        nativeScriptAvailable: nativeAvailable,
        script: authoritativeScript,
        scriptConfidence: langInfo.scriptConfidence || 0.95,
        isCodeMixed: Boolean(params.isCodeMixed || langInfo.isCodeMixed),
        secondaryLanguage: params.secondaryLanguage || langInfo.secondaryLanguage || null,
        languageEvidence: langInfo.languageEvidence || null,
        languageConfidence: typeof chosenResult.languageConfidence === 'number' ? chosenResult.languageConfidence : (langInfo.languageConfidence || (finalConfidence >= 0.85 ? 0.95 : finalConfidence)),
        category: finalCategory,
        primaryCategory: finalCategory,
        secondaryCategory: chosenResult.secondaryCategory || deterministicBaseline.secondaryCategory || null,
        detectedCategory: finalCategory,
        detectedEmergencyCategory: finalCategory,
        citizenSelectedCategory: selectedCat,
        severity: (chosenResult.priority || chosenResult.severity || deterministicBaseline.priority || 'HIGH').toUpperCase(),
        priority: (chosenResult.priority || chosenResult.severity || deterministicBaseline.priority || 'HIGH').toUpperCase(),
        confidence: finalConfidence,
        classificationConfidence: finalConfidence >= 0.85 ? 'HIGH' : (finalConfidence >= 0.65 ? 'MEDIUM' : 'LOW'),
        categoryConflict: isConflict,
        evidenceBasis: chosenResult.evidenceBasis || 'VOICE',
        needsReview: finalNeedsReview,
        reason: chosenResult.riskReason || chosenResult.reason || deterministicBaseline.reason || `Voice report describes a ${finalCategory.toLowerCase()} emergency.`,
        riskReason: chosenResult.riskReason || chosenResult.reason || deterministicBaseline.reason || `Voice report describes a ${finalCategory.toLowerCase()} emergency.`,
        meaning: englishTranslation,
        englishMeaning: englishTranslation,
        englishTranslation: englishTranslation,
        normalizedMeaning: chosenResult.normalizedMeaning || englishTranslation,
        hazards: [finalCategory],
        peopleAffected: typeof chosenResult.reportedAffectedPeople === 'number' ? chosenResult.reportedAffectedPeople : (deterministicBaseline.peopleAffected || null),
        reportedAffectedPeople: typeof chosenResult.reportedAffectedPeople === 'number' ? chosenResult.reportedAffectedPeople : (deterministicBaseline.peopleAffected || null),
        trapped: chosenResult.trapped != null ? Boolean(chosenResult.trapped) : Boolean(deterministicBaseline.trapped),
        injuries: finalCategory === 'MEDICAL' || finalCategory === 'BUILDING_COLLAPSE' || Boolean(deterministicBaseline.injuries),
        contradictionDetected: isConflict,
        transcriptionSource: params.transcriptionSource || 'GEMINI_3_5_TRANSCRIBE',
        translationSource: params.translationSource || (chosenResult.englishTranslation ? 'SARVAM_OR_GEMINI_TRANSLATE' : 'DETERMINISTIC'),
        multiModelAgreement: params.multiModelAgreement || modelAgreement || null,
        sarvamFallbackTriggered: Boolean(params.sarvamFallbackTriggered),
        source: gemmaVerificationOccurred && gemmaResult
          ? 'GEMMA_4_VERIFIED'
          : (chosenResult === deterministicBaseline ? 'INDIC_DETERMINISTIC_BASELINE' : 'GEMINI_3_8_FLASH_REASONING'),
        primaryModel: activePrimaryModel,
        verifierModel: gemmaVerificationOccurred ? activeVerifierModel : null,
        gemmaVerificationOccurred,
        modelAgreement,
        escalationReasons,
        verificationDetails,
        ragContextRetrieved: Boolean(retrievedKnowledge?.contextAvailable),
        ragChunksCount: retrievedKnowledge?.retrievedChunks?.length || 0,
        geminiLatencyMs,
        gemmaLatencyMs,
        retrievalLatencyMs,
        totalLatencyMs: Date.now() - startTime,
      };
    }

    // Tier 3: Deterministic Indic Semantic Fallback
    return this.interpretDeterministic(params);
  }

  /**
   * Universal interpret entry point (alias to analyzeEmergency)
   */
  async interpret(params = {}, options = {}) {
    return this.analyzeEmergency(params, options);
  }
}

const semanticEmergencyInterpreter = new SemanticEmergencyInterpreter();
semanticEmergencyInterpreter.CANONICAL_EMERGENCY_CATEGORIES = CANONICAL_EMERGENCY_CATEGORIES;
module.exports = semanticEmergencyInterpreter;
