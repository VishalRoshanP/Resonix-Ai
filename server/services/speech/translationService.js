/**
 * Dedicated Multilingual Emergency Translation Service for RESONIX AI
 * 
 * Responsibilities:
 * - Translates native-script emergency transcripts directly to English for emergency responders
 * - STRICTLY SECONDARY & ASYNCHRONOUS: Emergency packet creation NEVER blocks on translation
 * - Direct Native -> English translation (NO Tanglish/transliteration intermediate steps)
 * - Multi-tier resilience: Deterministic Phrase Matrix (Tier 1) -> Google AI Studio (Tier 2)
 */

const logger = require('../../utils/logger');
const googleAiClient = require('../gemma/googleAiClient');
const sarvamClient = require('./sarvamClient');

class TranslationService {
  /**
   * Deterministic high-speed fallback translation dictionary for emergency phrases
   * @private
   */
  _getDeterministicTranslation(originalTranscript, detectedLanguage) {
    const raw = (originalTranscript || '').trim();
    const lower = raw.toLowerCase();

    // If explicitly English and doesn't contain Romanized Indic keywords, return as-is
    if (detectedLanguage === 'English') {
      return raw;
    }

    // Tamil emergency statements (Native script + Romanized Tanglish)
    if (/(enga|namma)?\s*veetl\w*.*thee.*(rendu|2|irandu).*per.*(maati|maatiki|sik)/i.test(lower) || /வீட்டுல.*தீ.*(இரண்டு|2).*பேர்.*(மாட்டி|சிக்கி)/i.test(raw)) {
      return 'There is a fire in my house and two people are trapped.';
    }
    if (/(enga|namma)?\s*veetl\w*.*thee\s*pidi/i.test(lower) || /வீட்டுல.*தீ.*பிடி/i.test(raw)) {
      return 'There is a fire in my house.';
    }
    if (/நான்\s*நெருப்பில்\s*மாட்டிகொண்டேன்|நான்\s*நெருப்பில்\s*மாட்டிகொண்டேன்|நெருப்பில்.*மாட்டி|நெருப்பில்/i.test(raw) || /(non|naan)\s*nerp\w*.*(marti|maati|matik)\w*.*(kundan|konden)|nerpil.*marti/i.test(lower)) {
      return 'I am trapped in a fire.';
    }
    if (/வெள்ளம்.*வீட்டுக்குள்\s*வந்து|வெள்ளம்\s*வந்துவிட்டது|வெள்ளம்/i.test(raw) || /vellam.*veetukull\w*.*vandhud\w*|thanni.*veetukull\w*.*vandhud\w*/i.test(lower)) {
      return 'Flood water has entered my house.';
    }
    if (/கட்டிடம்\s*இடிந்து\s*விழுந்தது|கட்டிடம்.*இடிந்து/i.test(raw) || /kathadangal\s*kide\s*vatilmatti/i.test(lower) || /kattidam\s*idinj/i.test(lower)) {
      return 'The building collapsed and a person is trapped inside.';
    }
    if (/எங்க\s*வீட்டுக்குள்ள\s*water|enga.*veetukulla.*water/i.test(lower)) {
      return 'Water has entered inside our house.';
    }
    if (/வெள்ளம்.*வீட்டுக்குள்.*சிக்கி|வெள்ளம்.*சிக்கி/i.test(raw) || /flood\s*aayid\w*.*thanni/i.test(lower) || /veetukull\w*.*thanni/i.test(lower)) {
      return 'Floodwater has entered the house and water is rising. Please send help.';
    }
    if (/வெள்ளத்தில்\s*மாட்டி|வெள்ளத்தில்.*சிக்கி/i.test(raw) || /thanni\s*romba\s*adhigam\w*.*kapath/i.test(lower) || /thanni.*kapath/i.test(lower)) {
      return 'Water level is very high and rising. I am trapped, please rescue me.';
    }
    if (/கட்டிடத்தில்\s*தீப்பற்றி|நெருப்பு\s*பிடிச்சு|தீ\s*பிடிச்சு/i.test(raw) || /neruppu\s*pidich/i.test(lower) || /thee\s*pidich/i.test(lower)) {
      return 'Fire has broken out in the building with dangerous flames and smoke.';
    }
    if (/நான்\s*கட்டிடத்துக்குள்\s*சிக்கி.*தீ/i.test(raw)) {
      return 'I am trapped inside a building. There is fire around me.';
    }
    if (/(புயல்|புயலி|புயலா|சூறாவளி|பெருங்காற்று|கடும்\s*காற்று|பலத்த\s*காற்று|சூறைக்காற்று)/i.test(raw) || /(puya|puyal|sooravali|kaathu|kaatru).*(maati|sik|veet|maram|idam)/i.test(lower) || /puyal/i.test(lower)) {
      return /(மாட்டி|சிக்கி|marti|maati|sik)/i.test(raw + ' ' + lower) ? 'I am trapped in a severe cyclone storm with strong destructive winds.' : 'Severe cyclone storm with destructive winds and damage reported.';
    }
    if (/(மண்\s*சரி|நில\s*சரி|மலை\s*சரி|பாறை\s*சரி)/i.test(raw) || /(mann\s*sariv|nila\s*sariv|malai\s*sariv|mann\s*moodi)/i.test(lower)) {
      return /(மாட்டி|சிக்கி|மூடி|marti|maati)/i.test(raw + ' ' + lower) ? 'A landslide occurred and people are trapped under earth and debris.' : 'A landslide occurred with mountain mud and rock debris blocking the area.';
    }
    if (/(நிலநடுக்க|பூமி\s*அதிர்|தரை\s*அதிர்|கட்டிடம்\s*நடுங்கு)/i.test(raw) || /(nilanaduk|bhoom\w*\s*athir|tharai\s*athir|nilam\s*athir)/i.test(lower)) {
      return 'An earthquake has occurred and the ground is shaking violently.';
    }
    if (/(நெஞ்சு\s*வலி|மாரடைப்பு|ரத்தம்|இரத்தம்|மயங்கி|காயம்|ஆம்புலன்ஸ்)/i.test(raw) || /(nenju\s*vali|maradaipp|rath\w*|irath\w*|mayangi|kaayam|ambulance)/i.test(lower)) {
      return /(நெஞ்சு|மாரடைப்பு|nenju|maradaipp)/i.test(raw + ' ' + lower) ? 'Severe cardiac chest pain. Urgent emergency medical ambulance needed.' : 'Medical emergency: person is injured, bleeding, or unconscious and needs immediate medical help.';
    }
    if (/மூச்சு\s*விட\s*முடியவில்லை/i.test(raw) || /moochu\s*vida\s*mudiyala/i.test(lower)) {
      return 'I cannot breathe. Need emergency medical help immediately.';
    }

    // Hindi emergency statements (Native script + Romanized Hinglish)
    if (/ghar.*aag.*(do|2).*log.*(fas|phase)/i.test(lower) || /घर.*आग.*(दो|2).*लोग.*फंस/i.test(raw)) {
      return 'There is a fire in my house and two people are trapped.';
    }
    if (/मैं\s*आग\s*में\s*फंस\s*गया|आग.*फंस/i.test(raw) || /main\s*aag\s*mein\s*f[a|u]ns/i.test(lower)) {
      return 'I am trapped in a fire.';
    }
    if (/मेरे\s*घर\s*में\s*fire|mere\s*ghar\s*mein\s*fire/i.test(lower)) {
      return 'Fire has broken out in my house.';
    }
    if (/बाढ़.*पानी.*घर.*फंस|बाढ़.*पानी/i.test(raw) || /paani.*ghar.*ghus/i.test(lower) || /baadh.*paani.*fas/i.test(lower)) {
      return 'Floodwater has entered the house and we are trapped inside.';
    }
    if (/घर.*आग.*धुआं/i.test(raw) || /आग\s*लग/i.test(raw) || /aag\s*lagi/i.test(lower)) {
      return 'House is caught in fire with heavy smoke. Immediate evacuation needed.';
    }
    if (/(तूफान|चक्रवात|आंधी|अंधड़)/i.test(raw) || /(toofan|tufan|aandhi|andhi|chakravat)/i.test(lower)) {
      return /(फंस|दबे|phas|fas|dabe)/i.test(raw + ' ' + lower) ? 'We are trapped in a severe cyclone storm with destructive winds.' : 'Severe cyclone storm and high winds reported.';
    }
    if (/(भूस्खलन|पहाड़\s*(खिसक|गिर|ढह|टूट)|मिट्टी\s*(खिसक|धंस|गिर))/i.test(raw) || /(bhooskhalan|bhuskhalan|pahad\s*khisak|mitti\s*khisak|pahad\s*gir)/i.test(lower)) {
      return /(फंस|दबे|phas|fas|dabe)/i.test(raw + ' ' + lower) ? 'A landslide occurred and people are trapped under mud and debris.' : 'A landslide occurred with mountain debris blocking the area.';
    }
    if (/(भूकंप|झटके|जमीन\s*हिल|धरती\s*हिल|कांप\s*रहा)/i.test(raw) || /(bhookamp|bhukamp|dharti\s*hil|zameen\s*hil)/i.test(lower)) {
      return 'An earthquake has occurred and the ground is shaking violently.';
    }
    if (/(घायल|चोट|बेहोश|रक्त|खून|दिल\s*का\s*दौरा|एम्बुलेंस)/i.test(raw) || /(ghayal|chot|behosh|khoon|dil\s*ka\s*daura|ambulance)/i.test(lower)) {
      return 'Emergency medical assistance needed. Person is injured, bleeding, or unconscious.';
    }
    if (/सांस\s*लेने\s*में\s*तकलीफ|सीने\s*में\s*दर्द/i.test(raw) || /saans\s*lene\s*mein|seene\s*mein\s*dard/i.test(lower)) {
      return 'Severe breathing difficulty and chest pain. Medical assistance needed urgently.';
    }
    if (/इमारत\s*गिर\s*गई|मलबे\s*में\s*दबे/i.test(raw) || /imarat\s*gir\s*gayi|malbe\s*mein/i.test(lower)) {
      return 'Building collapsed and people are trapped under debris.';
    }

    // Kannada emergency statements (Native script + Romanized Kanglish)
    if (/ನಾನು\s*ಬೆಂಕಿಯಲ್ಲಿ\s*ಸಿಕ್ಕಿಕೊಂಡಿದ್ದೇನೆ|ಬೆಂಕಿಯಲ್ಲಿ\s*ಸಿಕ್ಕಿ/i.test(raw) || /benkiyalli\s*sik/i.test(lower)) {
      return 'I am trapped in a fire.';
    }
    if (/ನಮ್ಮ\s*ಮನೆಗೆ\s*flood\s*water\s*ಬಂದಿದೆ|flood\s*water\s*bandide/i.test(lower)) {
      return 'Flood water has entered our house.';
    }
    if (/ನೀರು\s*ಮನೆ\s*ಒಳಗೆ.*ಸಿಕ್ಕಿ|ನೀರು\s*ಮನೆ\s*ಒಳಗೆ/i.test(raw) || /neeru\s*mane\s*olage.*sikk/i.test(lower)) {
      return 'Floodwater has entered the house and we are trapped inside.';
    }
    if (/ಬೆಂಕಿ.*ಹೊಗೆ/i.test(raw) || /maneyalli\s*benki/i.test(lower)) {
      return 'Fire has broken out in the building with heavy smoke.';
    }
    if (/(ಚಂಡಮಾರುತ|ಬಿರುಗಾಳಿ|ತೀವ್ರ\s*ಗಾಳಿ)/i.test(raw) || /(chandamaruta|birugali)/i.test(lower)) {
      return 'Severe cyclone storm with destructive winds reported.';
    }
    if (/(ಭೂಕುಸಿತ|ಮಣ್ಣು\s*ಕುಸಿತ|ಬೆಟ್ಟ\s*ಕುಸಿದು)/i.test(raw) || /(bhookusita|mannu\s*kusita)/i.test(lower)) {
      return 'A landslide has occurred and debris has blocked the area.';
    }
    if (/(ಎದೆ\s*ನೋವು|ಉಸಿರಾಟ|ರಕ್ತ|ಗಾಯ|ಪ್ರಜ್ಞೆ\s*ತಪ್ಪಿ|ಆಂಬ್ಯುಲೆನ್ಸ್)/i.test(raw) || /(ede\s*novu|usirata|rakta|gaya|pragne|ambulance)/i.test(lower)) {
      return 'Emergency medical assistance needed: severe chest pain, breathing distress, or trauma.';
    }
    if (/ಕಟ್ಟಡ\s*ಕುಸಿದು|ಕಟ್ಟಡ\s*ಬಿದ್ದು/i.test(raw) || /kattada\s*biddu/i.test(lower) || /kattada\s*kusid/i.test(lower)) {
      return 'Building has collapsed and people are under the debris.';
    }
    if (/ಭೂಕಂಪ/i.test(raw) || /bhookampa\s*aagide\s*mane\s*shaking/i.test(lower) || /bhookampa.*mane.*shak/i.test(lower)) {
      return 'An earthquake has occurred and the house is shaking violently.';
    }

    // Telugu emergency statements (Native script + Romanized Tenglish)
    if (/గుండె\s*నొప్పి|తీవ్రమైన\s*గుండె|ఊపిரி\s*ఆడ/i.test(raw) || /gunde\s*noppi|oopiri\s*aadatledhu/i.test(lower)) {
      return 'Severe chest pain and acute difficulty breathing. Need emergency ambulance immediately.';
    }
    if (/నేను\s*మంటల్లో\s*చిక్కు|మంటల్లో\s*చిక్కు/i.test(raw) || /mantallo\s*chikkukun/i.test(lower)) {
      return 'I am trapped in a fire.';
    }
    if (/వరద.*నీరు.*ఇంట్లోకి.*చిక్కుకున్నాను|వరద.*నీరు/i.test(raw) || /varada\s*neeru.*chikkukun|varada\s*neeru/i.test(lower)) {
      return 'Floodwater has entered the house and we are trapped inside.';
    }
    if (/భవనం.*మంటలు|నిప్పు/i.test(raw) || /manta\s*mantal/i.test(lower)) {
      return 'Building is on fire with spreading flames. Need immediate rescue.';
    }
    if (/(తుఫాను|తుఫాన్|తీవ్రమైన\s*గాలులు|గాలివాన)/i.test(raw) || /(tufan|tuphan|galivana)/i.test(lower)) {
      return /(చిక్కు|chikk)/i.test(raw + ' ' + lower) ? 'I am trapped in a severe cyclone storm.' : 'Severe cyclone storm and heavy winds reported.';
    }
    if (/(కొండచరియలు|కొండ\s*విరిగి|మట్టి\s*చరియలు)/i.test(raw) || /(konda\s*chariyalu|matti\s*chariyalu)/i.test(lower)) {
      return 'A landslide occurred with rocks and mud blocking the road.';
    }
    if (/(భూకంపం|భూమి\s*కదులు|భూమి\s*వణికి)/i.test(raw) || /(bhookampam|bhoom\w*\s*kadulu)/i.test(lower)) {
      return 'An earthquake has occurred and the ground is shaking.';
    }
    if (/(గాయం|రక్తం|స్పృహతప్పి|అంబులెన్స్)/i.test(raw) || /(gayam|raktam|spruha|ambulance)/i.test(lower)) {
      return 'Emergency medical assistance needed: person injured or unconscious.';
    }
    if (/భవనం.*కూలి/i.test(raw) || /bhavanam\s*koolipoyindi/i.test(lower)) {
      return 'Building has collapsed and people are trapped under debris.';
    }

    // Malayalam emergency statements (Native script + Romanized Manglish)
    if (/ഞാൻ\s*തീയിൽ\s*കുടുങ്ങിയിരിക്കുന്നു|തീയിൽ\s*കുടുങ്ങി/i.test(raw) || /theeyil\s*kudungi|njaan\s*theeyil/i.test(lower)) {
      return 'I am trapped in a fire.';
    }
    if (/വെള്ളപ്പ[\u0D4A\u0BCA]ക്കം|വെള്ളം\s*വീട്ടിൽ|വെള്ളപ്പൊക്കം/i.test(raw) || /vellappokkam|vellam\s*veett/i.test(lower)) {
      return 'Flood water entered the house.';
    }
    if (/(ചുഴലിക്കാറ്റ്|കൊടുങ്കാറ്റ്|ശക്തമായ\s*കാറ്റ്)/i.test(raw) || /(chuzhalikkattu|kodunkattu)/i.test(lower)) {
      return 'Severe cyclone winds and storm damage reported.';
    }
    if (/(ഉരുൾപൊട്ടൽ|മണ്ണിടിച്ചിൽ|മലയിടിച്ചിൽ)/i.test(raw) || /(urul\s*pottal|mannidichil|malayidichil)/i.test(lower)) {
      return 'A severe landslide and mudslide has occurred with trapped persons.';
    }
    if (/(ഭൂകമ്പ|ഭൂമി\s*കുലു)/i.test(raw) || /(bhookampam|bhoomi\s*kulu)/i.test(lower)) {
      return 'An earthquake has occurred and the ground is shaking.';
    }
    if (/(ശ്വാസമെടുക്കാൻ|നെഞ്ചുവേദന|രക്ത|പരുക്ക്|ബോധം\s*കെട്ടു|ആംബുലൻസ്)/i.test(raw) || /(swasam|nenjuvedana|raktham|parukku|bodham|ambulance)/i.test(lower)) {
      return 'Urgent medical assistance required for acute distress or injury.';
    }
    if (/കെട്ടിടം\s*തകർന്നു/i.test(raw) || /kettidam\s*thakarnnu/i.test(lower)) {
      return 'Building collapsed and people are trapped under the rubble.';
    }

    // Marathi emergency statements
    if (/मी\s*आगीत\s*अडकलो\s*आहे|आगीत\s*अडक/i.test(raw) || /aagit\s*adak|mee\s*aagit/i.test(lower)) {
      return 'I am trapped in a fire.';
    }
    if (/इमारत\s*कोसळली|मलब्याखाली/i.test(raw) || /imarat\s*padli|dabli\s*geli/i.test(lower)) {
      return 'Building has collapsed and people are trapped under debris.';
    }
    if (/पूर.*घरात/i.test(raw) || /poor\s*gharat/i.test(lower)) {
      return 'Floodwater has entered the house.';
    }
    if (/(वादळ|चक्रीवादळ|जोरदार\s*वारा)/i.test(raw) || /(vaadal|chakrivaadal|vadaal)/i.test(lower)) {
      return 'Severe cyclone storm and destructive winds reported.';
    }
    if (/(दरड\s*कोसळ|दगडी\s*कोसळ|माती\s*घसर)/i.test(raw) || /(darad\s*kosall|mati\s*ghasar)/i.test(lower)) {
      return 'A landslide has occurred with rocks and mud blocking the area.';
    }
    if (/(भूकंप|जमीन\s*हादरली)/i.test(raw) || /(bhukamp|zameen\s*hadarli)/i.test(lower)) {
      return 'An earthquake has occurred and the ground is shaking.';
    }
    if (/(छातीत\s*दुख|श्वास\s*घेण्यास|रक्तस्त्राव|जखमी|बेशुद्ध|रुग्णवाहिका)/i.test(raw) || /(chhatit\s*dukh|shwas|raktastrav|zakhmi|beshuddh|rugnavahika)/i.test(lower)) {
      return 'Medical emergency: urgent hospital ambulance needed.';
    }

    // Bengali emergency statements
    if (/আমি\s*আগুনে\s*আটকে\s*পড়েছি|আগুনে\s*আটকে/i.test(raw) || /aagune\s*aatke|aami\s*aagun/i.test(lower)) {
      return 'I am trapped in a fire.';
    }
    if (/বন্যার\s*জল\s*ঘরে|বন্যা.*জল/i.test(raw) || /banyah.*jal/i.test(lower)) {
      return 'Flooding has submerged the area and we are trapped.';
    }
    if (/আগুন.*ধোঁয়া/i.test(raw) || /aagun.*dhoa/i.test(lower)) {
      return 'Fire has broken out and smoke is spreading rapidly.';
    }
    if (/ঘূর্ণিঝড়|সাইক্লোন/i.test(raw) || /ghurnijhar/i.test(lower)) {
      return 'Severe cyclone storm with devastating winds and building damage.';
    }
    if (/(ধস\s*নেমে|পাহাড়\s*ধস|মাটি\s*ধস)/i.test(raw) || /(dhas\s*neme|pahar\s*dhas|mati\s*dhas)/i.test(lower)) {
      return 'A landslide has occurred with earth and rocks blocking the road.';
    }
    if (/(ভূমিকম্প|মাটি\s*কাঁপ)/i.test(raw) || /(bhumikampa|mati\s*kap)/i.test(lower)) {
      return 'An earthquake has occurred and the ground is shaking.';
    }
    if (/(বাড়ি\s*ভেঙে\s*পড়েছে|ভবন\s*ধসে|ধ্বংসস্তূপে\s*আটকে)/i.test(raw) || /(bari\s*bhenge|bhaban\s*dhase|atke)/i.test(lower)) {
      return 'The building has collapsed and people are trapped under debris.';
    }
    if (/(শ্বাসকষ্ট|বুকে\s*ব্যথা|রক্তপাত|আহত|অজ্ঞান|অ্যাম্বুলেন্স)/i.test(raw) || /(shwaskashto|buke\s*byatha|roktopat|aahoto|ogyan|ambulance)/i.test(lower)) {
      return 'Medical emergency: urgent ambulance needed for injured or critical patient.';
    }

    return null;
  }

  /**
   * Translates native-script emergency transcript to English
   * @param {string} originalTranscript - Verbatim native language transcript
   * @param {string} detectedLanguage - Detected source language (e.g., 'Tamil', 'Hindi', 'Telugu')
   * @returns {Promise<string>} English translation
   */
  async translateEmergencyTranscript(originalTranscript, detectedLanguage = 'unknown') {
    if (!originalTranscript || typeof originalTranscript !== 'string') return '';
    const cleanText = originalTranscript.trim();
    if (!cleanText) return '';

    // Fast return if English
    if (detectedLanguage === 'English') return cleanText;

    const deterministic = this._getDeterministicTranslation(cleanText, detectedLanguage);
    if (deterministic) {
      return deterministic;
    }

    // Try Primary: Google AI Studio (gemini-3.8-flash with fallback to gemini-3.5-flash)
    const candidateModels = ['gemini-3.8-flash', 'gemini-3.5-flash'];
    for (const targetModel of candidateModels) {
      try {
        const prompt = `You are the official Emergency Dispatch Multilingual Translator for RESONIX AI.
Translate the following emergency report from ${detectedLanguage || 'its original language'} directly into clear, concise, professional English for emergency responders.

Rules:
1. Translate the exact operational meaning preserving critical details (hazard type, location, trapped persons, injuries, urgency).
2. Code-switching and transliterations (Tanglish, Hinglish, Kanglish, etc.) must be translated into clear English meaning.
3. Return ONLY the English translation text. No commentary, no explanations, no JSON.

Emergency Report:
"${cleanText}"

English Translation:`;

        const response = await googleAiClient.generateText(prompt, {
          model: targetModel,
          temperature: 0.1,
          maxTokens: 256,
          timeoutMs: 6000,
          maxRetries: 1,
        });

        if (response && response.success && response.text) {
          let translated = response.text.trim();
          translated = translated.replace(/^["'`]+|["'`]+$/g, '').trim();
          if (translated && translated.length > 3 && !translated.toLowerCase().includes('general emergency assistance')) {
            logger.info(`[TranslationService] Successfully translated (${detectedLanguage} -> English via ${targetModel}): "${translated}"`);
            return translated;
          }
        }
      } catch (err) {
        logger.warn(`[TranslationService] Model ${targetModel} translation note: ${err.message}`);
      }
    }

    // Try Fallback: Sarvam Mayura / Sarvam-Translate API if Gemini failed or timed out
    if (sarvamClient.isConfigured() && !sarvamClient.isCircuitOpen()) {
      try {
        const langCodeMap = {
          Tamil: 'ta-IN',
          Hindi: 'hi-IN',
          Telugu: 'te-IN',
          Kannada: 'kn-IN',
          Malayalam: 'ml-IN',
          Marathi: 'mr-IN',
          Bengali: 'bn-IN',
          Gujarati: 'gu-IN',
          Punjabi: 'pa-IN',
        };
        const srcCode = langCodeMap[detectedLanguage] || 'auto';
        const sRes = await sarvamClient.translateText({
          input: cleanText,
          sourceLanguageCode: srcCode,
          targetLanguageCode: 'en-IN',
        });
        if (sRes && sRes.success && sRes.translatedText) {
          const trans = sRes.translatedText.trim();
          if (trans.length > 2 && !trans.toLowerCase().includes('general emergency')) {
            logger.info(`[TranslationService] Sarvam Translate fallback succeeded: "${trans}"`);
            return trans;
          }
        }
      } catch (sErr) {
        logger.warn(`[TranslationService] Sarvam Translate fallback notice: ${sErr.message}`);
      }
    }

    // Safe fallback
    return cleanText;
  }
}

const translationService = new TranslationService();
module.exports = translationService;
module.exports.TranslationService = TranslationService;
