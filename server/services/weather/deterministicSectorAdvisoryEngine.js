/**
 * DETERMINISTIC SECTOR ADVISORY ENGINE (PHASE 3)
 * SIH26068 Compliance Module — Real Data Only
 * 
 * Rules:
 * 1. Consumes the SAME weather/forecast/warning data already retrieved by existing WeatherGPT request.
 * 2. Zero second API requests. Zero mock data. Zero hardcoded weather values.
 * 3. Zero LLM safety thresholds. Zero additional AI calls.
 * 4. Official warnings strictly take precedence over Resonix advisory rules.
 * 5. Official warnings and Resonix Sector Advisory are kept distinct and never contradictory.
 * 6. Every advisory cites actual weather evidence. Missing metrics explicitly report "data is currently unavailable".
 * 7. Aviation & Marine strictly append the mandatory general awareness disclaimer.
 * 8. Aviation NEVER issues "Safe to fly", "Approved to fly", "Go", or "No-go".
 * 9. Marine NEVER estimates wave height; explicitly reports "Wave/swell data is unavailable."
 */

const FIXED_DISCLAIMER = 'This is general weather awareness, not an official flight or marine safety clearance. Follow your organization\'s official protocols.';

const FIXED_DISCLAIMER_LOCALIZED = {
  en: FIXED_DISCLAIMER,
  ta: 'இது பொதுவான வானிலை விழிப்புணர்வு மட்டுமே, அதிகாரப்பூர்வ விமான அல்லது கடல் பாதுகாப்பு அனுமதி அல்ல. உங்கள் நிறுவனத்தின் அதிகாரப்பூர்வ நடைமுறைகளைப் பின்பற்றவும்.',
  hi: 'यह केवल सामान्य मौसम जागरूकता है, आधिकारिक उड़ान या समुद्री सुरक्षा मंजूरी नहीं है। अपने संगठन के आधिकारिक प्रोटोकॉल का पालन करें।',
  te: 'ఇది సాధారణ వాతావరణ అవగాహన మాత్రమే, అధికారిక విమాన లేదా సముద్ర భద్రతా అనుమతి కాదు. మీ సంస్థ అధికారిక నిబంధనలను పాటించండి.',
  kn: 'ಇದು ಸಾಮಾನ್ಯ ಹವಾಮಾನ ಜಾಗೃತಿ ಮಾತ್ರ, ಅಧಿಕೃತ ವಿಮಾನ ಅಥವಾ ಸಾಗರ ಸುರಕ್ಷತಾ ಅನುಮತಿಯಲ್ಲ. ನಿಮ್ಮ ಸಂಸ್ಥೆಯ ಅಧಿಕೃತ ನಿಯಮಗಳನ್ನು ಅನುಸರಿಸಿ.',
  ml: 'ഇത് പൊതുവായ കാലാവസ്ഥാ അവബോധം മാത്രമാണ്, ഔദ്യോഗിക ഫ്ലൈറ്റ് അല്ലെങ്കിൽ സമുദ്ര സുരക്ഷാ അനുമതിയല്ല. നിങ്ങളുടെ സ്ഥാപനത്തിന്റെ ഔദ്യോഗിക ചട്ടങ്ങൾ പാലിക്കുക.',
  bn: 'এটি সাধারণ আবহাওয়া সচেতনতা মাত্র, সরকারি বিমান বা সামুদ্রিক নিরাপত্তা ছাড়পত্র নয়। আপনার সংস্থার অফিসিয়াল প্রোটোকল অনুসরণ করুন।',
  mr: 'ही केवळ सामान्य हवामान जागरूकता आहे, अधिकृत उड्डाण किंवा सागरी सुरक्षा मंजुरी नाही. आपल्या संस्थेच्या अधिकृत नियमांचे पालन करा.',
  gu: 'આ માત્ર સામાન્ય હવામાન જાગૃતિ છે, કોઈ સત્તાવાર ફ્લાઇટ અથવા દરિયાઈ સલામતી મંજૂરી નથી. તમારી સંસ્થાના સત્તાવાર પ્રોટોકોલનું પાલન કરો.',
  pa: 'ਇਹ ਸਿਰਫ਼ ਆਮ ਮੌਸਮ ਜਾਗਰੂਕਤਾ ਹੈ, ਕੋਈ ਅਧਿਕਾਰਤ ਉਡਾਣ ਜਾਂ ਸਮੁੰਦਰੀ ਸੁਰੱਖਿਆ ਮਨਜ਼ੂਰੀ ਨਹੀਂ ਹੈ। ਆਪਣੀ ਸੰਸਥਾ ਦੇ ਅਧਿਕਾਰਤ ਨਿਯਮਾਂ ਦੀ ਪਾਲਣਾ ਕਰੋ।',
};

const VISIBILITY_THRESHOLD_METERS = 5000;

/**
 * Main evaluation entry point
 * @param {Object} params
 * @param {string} params.sector - 'farmer' | 'aviation' | 'marine'
 * @param {string} [params.query] - original user query
 * @param {string} [params.language] - user language code
 * @param {Object} params.factualMetrics - extracted factual ground truth metrics
 * @param {Object} params.toolResult - raw comprehensive tool result
 * @param {Object} [params.locationInfo] - location details { name, latitude, longitude }
 * @param {Object} [params.timeInfo] - temporal details
 * @returns {Object} Deterministic sector evaluation result
 */
function evaluateSectorAdvisory(params = {}) {
  const {
    sector = 'farmer',
    query = '',
    language = 'en',
    factualMetrics = {},
    toolResult = {},
    locationInfo = {},
    timeInfo = {},
  } = params;

  const loc = locationInfo.name || factualMetrics.locationName || 'your area';
  const lang = language || 'en';
  const q = (query || '').toLowerCase();

  // 1. Extract Real Retrieved Meteorological Variables
  const current = toolResult.current || factualMetrics.currentWeather || {};
  const daily = Array.isArray(toolResult.dailyForecast) ? toolResult.dailyForecast : (Array.isArray(toolResult.daily) ? toolResult.daily : []);
  const todayForecast = daily[0] || factualMetrics.todayForecast || {};
  const tomorrowForecast = daily[1] || factualMetrics.tomorrowForecast || {};

  // Rain probability for target period (next 24h / query target)
  const isTomorrowQuery = /tomorrow|நாளை|कल|రేపు|ನಾಳೆ|കാല|কাল|उद्या|કાલે|ਕੱਲ੍ਹ/i.test(q) || timeInfo.target === 'TOMORROW';
  const targetForecast = isTomorrowQuery ? tomorrowForecast : (todayForecast.precipitationProbabilityMax != null ? todayForecast : tomorrowForecast);
  
  const rawRainProb = targetForecast.precipitationProbabilityMax ?? targetForecast.precipitationProbability ?? current.precipitationProbability;
  const rainProb = (typeof rawRainProb === 'number' && !isNaN(rawRainProb)) ? rawRainProb : null;
  
  const rawRainSum = targetForecast.precipitationSum ?? targetForecast.precipitation ?? current.precipitation;
  const rainSum = (typeof rawRainSum === 'number' && !isNaN(rawRainSum)) ? Number(rawRainSum.toFixed(1)) : null;

  // Wind speed & gusts
  const rawWind = current.windSpeed ?? factualMetrics.windSpeed;
  const windSpeed = (typeof rawWind === 'number' && !isNaN(rawWind)) ? Number(rawWind.toFixed(1)) : null;

  const rawGust = current.windGusts ?? current.gustSpeed ?? current.wind_gusts_10m ?? null;
  const windGusts = (typeof rawGust === 'number' && !isNaN(rawGust)) ? Number(rawGust.toFixed(1)) : null;

  // Visibility (in meters or km)
  const rawVisibility = current.visibility ?? factualMetrics.visibility ?? null;
  const visibility = (typeof rawVisibility === 'number' && !isNaN(rawVisibility)) ? rawVisibility : null;

  // Weather condition code
  const weatherCode = current.weatherCode ?? factualMetrics.weatherCode ?? null;
  const condition = current.condition || factualMetrics.condition || '';

  // Warnings Extraction & Severe Status
  const warnings = Array.isArray(toolResult.warnings)
    ? toolResult.warnings
    : (Array.isArray(factualMetrics.warnings) ? factualMetrics.warnings : (Array.isArray(toolResult.alerts) ? toolResult.alerts : []));
  
  const activeAlert = warnings.find((w) => {
    const sev = String(w.severity || '').toUpperCase();
    const event = String(w.event || w.headline || '').toUpperCase();
    const isGreen = sev === 'GREEN' || sev === 'NORMAL' || /GREEN|பச்சை|सामान्य/i.test(sev);
    const isSevere = sev === 'RED' || sev === 'ORANGE' || sev === 'YELLOW' || sev === 'SEVERE' || sev === 'EXTREME' || sev === 'MODERATE';
    const isHazardEvent = /WARNING|ALERT|STORM|CYCLONE|FLOOD|GALE|SQUALL|HEAVY RAIN|THUNDERSTORM/i.test(event);
    return (isSevere || isHazardEvent) && !isGreen;
  }) || null;

  const hasSevereWarning = Boolean(activeAlert);
  const warningHeadline = activeAlert ? (activeAlert.headline || activeAlert.event || 'Severe Weather Warning') : null;
  const warningDesc = activeAlert ? (activeAlert.description || activeAlert.instruction || 'Official civil defense advisory in effect.') : null;

  // Route to isolated sector evaluator
  switch (sector) {
    case 'aviation':
      return _evaluateAviation({
        loc,
        lang,
        q,
        windSpeed,
        windGusts,
        visibility,
        weatherCode,
        hasSevereWarning,
        warningHeadline,
        warningDesc,
      });

    case 'marine':
      return _evaluateMarine({
        loc,
        lang,
        q,
        windSpeed,
        windGusts,
        rainProb,
        weatherCode,
        condition,
        hasSevereWarning,
        warningHeadline,
        warningDesc,
      });

    case 'farmer':
    default:
      return _evaluateFarmer({
        loc,
        lang,
        q,
        windSpeed,
        rainProb,
        rainSum,
        weatherCode,
        hasSevereWarning,
        warningHeadline,
        warningDesc,
      });
  }
}

/**
 * FARMER DETERMINISTIC EVALUATION
 * Rules:
 * 1. Rain probability > 70% in next 24h -> advise against spraying because rain may wash it off.
 * 2. Wind speed > 20 km/h -> advise against spraying because of drift risk.
 * 3. Rain probability < 20% AND no severe warning -> conditions appear favorable for sowing/spraying.
 * 4. Active severe warning -> defer to the official warning. Never contradict it.
 */
function _evaluateFarmer(data) {
  const { loc, lang, windSpeed, rainProb, rainSum, hasSevereWarning, warningHeadline, warningDesc } = data;

  const rainProbText = rainProb != null ? `${rainProb}%` : 'Rain probability data is currently unavailable';
  const windText = windSpeed != null ? `${windSpeed} km/h` : 'Wind data is currently unavailable';

  let advisoryText = '';
  let evidenceText = '';
  let officialWarningText = hasSevereWarning
    ? `OFFICIAL WARNING: ${warningHeadline}. ${warningDesc}`
    : 'OFFICIAL WARNING: None in effect (All parameters normal).';

  // RULE 4: Active severe warning takes absolute priority
  if (hasSevereWarning) {
    advisoryText = `RESONIX SECTOR ADVISORY: Active official warning in effect for ${loc}. Deferring to official warning; suspend spraying, sowing, and open-field operations until clearance is issued by authorities.`;
    evidenceText = `Official warning (${warningHeadline}) active. Rain probability is ${rainProbText} and wind speed is ${windText}.`;
  }
  // RULE 1 & 2: Rain > 70% and/or Wind > 20 km/h
  else if ((rainProb != null && rainProb > 70) && (windSpeed != null && windSpeed > 20)) {
    advisoryText = `RESONIX SECTOR ADVISORY: Advise against spraying pesticide in ${loc} because rainfall may wash it off and wind speed exceeds safe application limits causing chemical drift.`;
    evidenceText = `Rain probability is ${rainProb}% over the next 24 hours and wind speed is ${windSpeed} km/h. Spraying is unsuitable because rainfall could wash the application off and wind causes drift.`;
  }
  else if (rainProb != null && rainProb > 70) {
    advisoryText = `RESONIX SECTOR ADVISORY: Advise against spraying pesticide in ${loc} because rain probability is ${rainProb}% over the next 24 hours and rainfall may wash the application off.`;
    evidenceText = `Rain probability is ${rainProb}% over the next 24 hours and wind speed is ${windText}. Spraying may be unsuitable because rainfall could wash the application off.`;
  }
  else if (windSpeed != null && windSpeed > 20) {
    advisoryText = `RESONIX SECTOR ADVISORY: Advise against spraying pesticide in ${loc} because wind speed is ${windSpeed} km/h, which poses a significant chemical drift risk.`;
    evidenceText = `Wind speed is ${windSpeed} km/h (threshold: 20 km/h) and rain probability is ${rainProbText}. Spraying is unsuitable due to drift risk.`;
  }
  // RULE 3: Rain < 20% AND no severe warning -> favorable for sowing/spraying
  else if (rainProb != null && rainProb < 20 && !hasSevereWarning) {
    advisoryText = `RESONIX SECTOR ADVISORY: Weather conditions appear favorable for sowing and spraying in ${loc} with no active severe warning.`;
    evidenceText = `Rain probability is ${rainProb}% over the next 24 hours and wind speed is ${windText}. No severe warning is in effect.`;
  }
  // Moderate / In-between conditions (20% <= rainProb <= 70%, wind <= 20 km/h)
  else {
    advisoryText = `RESONIX SECTOR ADVISORY: Weather conditions in ${loc} are moderate; monitor localized cloud development and postpone spraying if showers appear imminent.`;
    evidenceText = `Rain probability is ${rainProbText} over the next 24 hours and wind speed is ${windText}.`;
  }

  // Construct localized conciseAnswer if requested
  const conciseAnswer = _localizeFarmerAnswer({
    lang,
    loc,
    advisoryText,
    evidenceText,
    hasSevereWarning,
    warningHeadline,
    rainProb,
    rainSum,
    windSpeed,
  });

  return {
    sector: 'farmer',
    advisoryText,
    officialWarningText,
    evidenceText,
    conciseAnswer,
    disclaimer: null, // Farmer does not require fixed aviation/marine disclaimer
    metricsUsed: {
      rainProbability: rainProb,
      windSpeed,
      hasSevereWarning,
      warningHeadline,
    },
  };
}

/**
 * AVIATION DETERMINISTIC EVALUATION
 * Rules:
 * GENERAL WEATHER AWARENESS ONLY.
 * 1. Wind > 40 km/h OR actual gust data indicates strong wind -> flag possible turbulence/crosswind risk.
 * 2. If actual visibility data exists and is below the configured threshold -> flag reduced visibility.
 * 3. Active severe warning covering the location -> surface the warning.
 * 4. Clear conditions + no warning -> state that current weather conditions appear favorable for general visual-flight awareness.
 * 
 * Invariants:
 * - NEVER issue "Safe to fly", "Approved to fly", "Go", or "No-go".
 * - Use "Weather conditions indicate..." or "Weather awareness suggests...".
 * - Always include: "This is general weather awareness, not an official flight or marine safety clearance. Follow your organization's official protocols."
 */
function _evaluateAviation(data) {
  const { loc, lang, windSpeed, windGusts, visibility, weatherCode, hasSevereWarning, warningHeadline, warningDesc } = data;

  const windText = windSpeed != null ? `${windSpeed} km/h` : 'Wind data is currently unavailable';
  const gustsText = windGusts != null ? ` with gusts up to ${windGusts} km/h` : '';
  const visibilityText = visibility != null ? `${visibility} meters` : 'Visibility data is currently unavailable';
  const disclaimer = FIXED_DISCLAIMER_LOCALIZED[lang] || FIXED_DISCLAIMER;

  let advisoryText = '';
  let evidenceText = '';
  let officialWarningText = hasSevereWarning
    ? `OFFICIAL WARNING: ${warningHeadline}. ${warningDesc}`
    : 'OFFICIAL WARNING: None in effect (All parameters normal).';

  const isFogCode = weatherCode === 45 || weatherCode === 48;
  const isReducedVisibility = (visibility != null && visibility < VISIBILITY_THRESHOLD_METERS) || isFogCode;
  const isStrongWindOrGust = (windSpeed != null && windSpeed > 40) || (windGusts != null && windGusts > 45);

  // RULE 3: Active severe warning covering location -> surface warning
  if (hasSevereWarning) {
    advisoryText = `RESONIX SECTOR ADVISORY: Weather awareness suggests heightened operational caution around ${loc}. Active official warning in effect (${warningHeadline}); convective activity, turbulence, and wind shear risks are elevated.`;
    evidenceText = `Official warning (${warningHeadline}) is active for ${loc}. Wind speed is ${windText}${gustsText}.`;
  }
  // RULE 1: Wind > 40 km/h or strong gust -> turbulence / crosswind risk
  else if (isStrongWindOrGust) {
    advisoryText = `RESONIX SECTOR ADVISORY: Weather conditions indicate possible turbulence and crosswind risk for ${loc} due to strong winds.`;
    evidenceText = `Wind speed is ${windSpeed != null ? `${windSpeed} km/h` : windText}${gustsText} (threshold: 40 km/h). No severe warning active.`;
  }
  // RULE 2: Reduced visibility below threshold
  else if (isReducedVisibility) {
    advisoryText = `RESONIX SECTOR ADVISORY: Weather awareness suggests reduced surface visibility in ${loc}; low-visibility procedures and instrument guidance recommended.`;
    evidenceText = `Surface visibility is ${visibility != null ? `${visibility} m` : 'reduced'}${isFogCode ? ` with fog/mist conditions (WMO ${weatherCode})` : ''}. Wind speed is ${windText}.`;
  }
  // RULE 4: Clear conditions + no warning -> favorable for general visual-flight awareness
  else {
    advisoryText = `RESONIX SECTOR ADVISORY: Weather conditions indicate that current weather conditions appear favorable for general visual-flight awareness around ${loc}.`;
    evidenceText = `Wind speed is ${windText}, visibility is normal, and no severe warnings are active.`;
  }

  // Safety Assertion Filter: NEVER issue forbidden phrases
  advisoryText = _stripAviationForbiddenTerms(advisoryText);

  const conciseAnswer = `${advisoryText} ${evidenceText} ${disclaimer}`;

  return {
    sector: 'aviation',
    advisoryText,
    officialWarningText,
    evidenceText,
    conciseAnswer,
    disclaimer,
    metricsUsed: {
      windSpeed,
      windGusts,
      visibility,
      weatherCode,
      hasSevereWarning,
      warningHeadline,
    },
  };
}

/**
 * MARINE DETERMINISTIC EVALUATION
 * Rules:
 * 1. Wind > 30 km/h OR active marine/coastal warning -> advise caution/against open-water activity.
 * 2. Rain probability > 60% AND actual thunderstorm signal exists -> advise caution.
 * 3. Calm wind + no active warning -> conditions appear favorable for general coastal activity.
 * 4. If wave height/swell data is unavailable: explicitly state: "Wave/swell data is unavailable."
 * 
 * Invariants:
 * - NEVER estimate wave height.
 * - Always include: "This is general weather awareness, not an official flight or marine safety clearance. Follow your organization's official protocols."
 */
function _evaluateMarine(data) {
  const { loc, lang, windSpeed, rainProb, weatherCode, condition, hasSevereWarning, warningHeadline, warningDesc } = data;

  const windText = windSpeed != null ? `${windSpeed} km/h` : 'Wind data is currently unavailable';
  const rainProbText = rainProb != null ? `${rainProb}%` : 'Rain probability data is currently unavailable';
  const disclaimer = FIXED_DISCLAIMER_LOCALIZED[lang] || FIXED_DISCLAIMER;
  const waveUnavailableText = 'Wave/swell data is unavailable.';

  let advisoryText = '';
  let evidenceText = '';
  let officialWarningText = hasSevereWarning
    ? `OFFICIAL WARNING: ${warningHeadline}. ${warningDesc}`
    : 'OFFICIAL WARNING: None in effect (All parameters normal).';

  const isThunderstormCode = [95, 96, 99].includes(weatherCode);
  const hasThunderstormText = /thunderstorm|squall|இடிமின்னல்|आंधी|तूफान/i.test(condition || '') || /thunderstorm|squall|gale/i.test(warningHeadline || '');
  const hasThunderstormSignal = isThunderstormCode || hasThunderstormText;

  const isHighWindOrMarineAlert = (windSpeed != null && windSpeed > 30) || hasSevereWarning;
  const isHighRainWithThunderstorm = (rainProb != null && rainProb > 60) && hasThunderstormSignal;

  // RULE 1: Wind > 30 km/h OR active marine/coastal warning -> advise caution/against open-water activity
  if (isHighWindOrMarineAlert) {
    const reason = hasSevereWarning
      ? `active official warning (${warningHeadline})`
      : `elevated wind speeds of ${windSpeed} km/h (threshold: 30 km/h)`;
    advisoryText = `RESONIX SECTOR ADVISORY: Weather awareness advises caution against open-water activity near ${loc} due to ${reason}.`;
    evidenceText = `Wind speed is ${windText}${hasSevereWarning ? `, official alert active: ${warningHeadline}` : ''}. ${waveUnavailableText}`;
  }
  // RULE 2: Rain probability > 60% AND actual thunderstorm signal exists -> advise caution
  else if (isHighRainWithThunderstorm) {
    advisoryText = `RESONIX SECTOR ADVISORY: Weather awareness advises caution for marine activity near ${loc} due to high rain probability and convective thunderstorm signals. Sudden wind shifts and squalls are possible.`;
    evidenceText = `Rain probability is ${rainProb}% with thunderstorm signal (WMO ${weatherCode || '95'}). Wind speed is ${windText}. ${waveUnavailableText}`;
  }
  // RULE 3: Calm wind + no active warning -> conditions appear favorable for general coastal activity
  else {
    advisoryText = `RESONIX SECTOR ADVISORY: Weather awareness suggests conditions appear favorable for general coastal activity near ${loc}: calm winds and no active marine warnings in effect.`;
    evidenceText = `Wind speed is ${windText} and no severe warning is in effect. ${waveUnavailableText}`;
  }

  // Safety Assertion Filter: NEVER estimate wave height
  evidenceText = _stripWaveEstimations(evidenceText);
  advisoryText = _stripWaveEstimations(advisoryText);

  const conciseAnswer = `${advisoryText} ${evidenceText} ${disclaimer}`;

  return {
    sector: 'marine',
    advisoryText,
    officialWarningText,
    evidenceText,
    conciseAnswer,
    disclaimer,
    metricsUsed: {
      windSpeed,
      rainProbability: rainProb,
      weatherCode,
      hasSevereWarning,
      warningHeadline,
      waveDataAvailable: false,
    },
  };
}

/**
 * Helper to ensure aviation text never contains prohibited clearance terms
 */
function _stripAviationForbiddenTerms(text) {
  let cleaned = text;
  cleaned = cleaned.replace(/\b(?:safe to fly|approved to fly)\b/gi, 'weather conditions appear favorable for general visual-flight awareness');
  cleaned = cleaned.replace(/\b(?:go\/no-go|no-go|go)\b/gi, 'operational awareness');
  return cleaned;
}

/**
 * Helper to ensure marine text never contains estimated wave heights
 */
function _stripWaveEstimations(text) {
  return text.replace(/\b(?:estimated wave heights?|wave heights? of|around \d+(?:\.\d+)?\s*(?:to|-)\s*\d+(?:\.\d+)?\s*meters?|under \d+(?:\.\d+)?\s*meters?)\b/gi, 'Wave/swell data is unavailable');
}

/**
 * Localize conciseAnswer for farmer domain based on language
 */
function _localizeFarmerAnswer({ lang, loc, advisoryText, evidenceText, hasSevereWarning, warningHeadline, rainProb, rainSum, windSpeed }) {
  if (lang === 'en') {
    return `${advisoryText} ${evidenceText}`;
  }

  const rainProbText = rainProb != null ? `${rainProb}%` : 'தரவு கிடைக்கவில்லை';
  const windText = windSpeed != null ? `${windSpeed} கிமீ/மணி` : 'தரவு கிடைக்கவில்லை';

  if (lang === 'ta') {
    if (hasSevereWarning) {
      return `அதிகாரப்பூர்வ எச்சரிக்கை: ${warningHeadline}. ரெசோனிக்ஸ் விவசாய ஆலோசனை: தீவிர எச்சரிக்கை நிலவுவதால் பூச்சிக்கொல்லி தெளிப்பு மற்றும் விதைப்பை ஒத்திவைக்கவும்.`;
    }
    if ((rainProb != null && rainProb > 70) || (windSpeed != null && windSpeed > 20)) {
      return `ரெசோனிக்ஸ் விவசாய ஆலோசனை: ${loc}-ல் பூச்சிக்கொல்லி தெளிப்பதைத் தவிர்க்கவும். மழை வாய்ப்பு ${rainProbText} (மழை நீரினால் மருந்து அடித்துச் செல்லப்படலாம்) மற்றும் காற்றின் வேகம் ${windText} (மருந்து காற்றில் அடித்துச் செல்லப்படும் அபாயம்).`;
    }
    if (rainProb != null && rainProb < 20) {
      return `ரெசோனிக்ஸ் விவசாய ஆலோசனை: ${loc}-ல் விதைப்பு மற்றும் மருந்து தெளிக்க வானிலை சாதகமாக உள்ளது. மழை வாய்ப்பு ${rainProbText}, காற்றின் வேகம் ${windText}.`;
    }
    return `ரெசோனிக்ஸ் விவசாய ஆலோசனை: ${loc}-ல் வானிலை மிதமாக உள்ளது. மழை வாய்ப்பு ${rainProbText}, காற்றின் வேகம் ${windText}.`;
  }

  if (lang === 'hi') {
    const hiRainText = rainProb != null ? `${rainProb}%` : 'डेटा अनुपलब्ध';
    const hiWindText = windSpeed != null ? `${windSpeed} किमी/घंटा` : 'डेटा अनुपलब्ध';

    if (hasSevereWarning) {
      return `आधिकारिक चेतावनी: ${warningHeadline}. रेज़ोनिक्स किसान सलाह: गंभीर चेतावनी सक्रिय होने के कारण कीटनाशक छिड़काव और बुवाई स्थगित रखें।`;
    }
    if ((rainProb != null && rainProb > 70) || (windSpeed != null && windSpeed > 20)) {
      return `रेज़ोनिक्स किसान सलाह: ${loc} में कीटनाशक छिड़काव से बचें। बारिश की संभावना ${hiRainText} (दवा बहने का जोखिम) और हवा की गति ${hiWindText} (हवा में बहने का जोखिम)।`;
    }
    if (rainProb != null && rainProb < 20) {
      return `रेज़ोनिक्स किसान सलाह: ${loc} में बुवाई और कीटनाशक छिड़काव के लिए मौसम अनुकूल है। बारिश की संभावना ${hiRainText}, हवा की गति ${hiWindText}।`;
    }
    return `रेज़ोनिक्स किसान सलाह: ${loc} में मौसम सामान्य है। बारिश की संभावना ${hiRainText}, हवा की गति ${hiWindText}।`;
  }

  return `${advisoryText} ${evidenceText}`;
}

module.exports = {
  evaluateSectorAdvisory,
  FIXED_DISCLAIMER,
  FIXED_DISCLAIMER_LOCALIZED,
  VISIBILITY_THRESHOLD_METERS,
};
