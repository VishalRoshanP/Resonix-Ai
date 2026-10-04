import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';

export const SUPPORTED_LANGUAGES = [
  // Prioritized Languages
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    short: 'EN',
    flag: '🌐',
    isPriority: true,
  },
  {
    code: 'ta',
    name: 'Tamil',
    nativeName: 'தமிழ்',
    short: 'தமிழ்',
    flag: '🇮🇳',
    isPriority: true,
  },
  {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    short: 'हिन्दी',
    flag: '🇮🇳',
    isPriority: true,
  },
  // Other Supported Indian Regional Languages Already Implemented
  {
    code: 'te',
    name: 'Telugu',
    nativeName: 'తెలుగు',
    short: 'తెలుగు',
    flag: '🇮🇳',
    isPriority: false,
  },
  {
    code: 'kn',
    name: 'Kannada',
    nativeName: 'ಕನ್ನಡ',
    short: 'ಕನ್ನಡ',
    flag: '🇮🇳',
    isPriority: false,
  },
  {
    code: 'ml',
    name: 'Malayalam',
    nativeName: 'മലയാളം',
    short: 'മലയാളം',
    flag: '🇮🇳',
    isPriority: false,
  },
  {
    code: 'bn',
    name: 'Bengali',
    nativeName: 'বাংলা',
    short: 'বাংলা',
    flag: '🇮🇳',
    isPriority: false,
  },
  {
    code: 'mr',
    name: 'Marathi',
    nativeName: 'मराठी',
    short: 'मराठी',
    flag: '🇮🇳',
    isPriority: false,
  },
  {
    code: 'gu',
    name: 'Gujarati',
    nativeName: 'ગુજરાતી',
    short: 'ગુજરાતી',
    flag: '🇮🇳',
    isPriority: false,
  },
  {
    code: 'pa',
    name: 'Punjabi',
    nativeName: 'ਪੰਜਾਬੀ',
    short: 'ਪੰਜਾਬੀ',
    flag: '🇮🇳',
    isPriority: false,
  },
];

const STORAGE_KEY = 'resonix_responder_language';

// Genuine dictionary for system labels, buttons, warnings, and emergency navigation
export const TRANSLATIONS = {
  en: {
    nav_dashboard: 'Dashboard',
    nav_incidents: 'Incidents',
    nav_resources: 'Resources',
    nav_analytics: 'Analytics',
    nav_settings: 'Settings',
    btn_acknowledge: 'Acknowledge',
    btn_dispatch_response: 'Dispatch Response',
    btn_mark_rescue_complete: 'Mark Rescue Complete',
    btn_view: 'View',
    btn_view_details: 'View Details',
    btn_save_changes: 'Save Changes',
    btn_close: 'Close',
    btn_sign_out: 'Sign Out',
    active_weather_warnings: 'ACTIVE WEATHER WARNINGS',
    official_warning: 'OFFICIAL WARNING',
    weather_forecast: 'Weather Forecast',
    numerical_weather_prediction: 'Numerical Weather Prediction',
    weather_ground_risk: 'Weather & Ground Risk',
    priority_incidents: 'Priority Incidents',
    citizen_ground_reports: 'CITIZEN GROUND REPORTS',
    original_citizen_report: 'ORIGINAL CITIZEN REPORT',
    original_report: 'Original Report',
    translated_summary: 'Translated Summary',
    ai_assisted_decision_support: 'AI-assisted decision support',
    status_active: 'ACTIVE',
    status_resolved: 'RESOLVED',
    severity_critical: 'CRITICAL',
    severity_high: 'HIGH',
    severity_moderate: 'MODERATE',
    severity_low: 'LOW',
  },
  ta: {
    nav_dashboard: 'டாஷ்போர்டு',
    nav_incidents: 'சம்பவங்கள்',
    nav_resources: 'வளங்கள்',
    nav_analytics: 'பகுப்பாய்வு',
    nav_settings: 'அமைப்புகள்',
    btn_acknowledge: 'ஏற்றுக்கொள்',
    btn_dispatch_response: 'படையை அனுப்புக',
    btn_mark_rescue_complete: 'மீட்பு முடிந்தது என குறிக்கவும்',
    btn_view: 'பார்',
    btn_view_details: 'விவரங்களைப் பார்',
    btn_save_changes: 'மாற்றங்களைச் சேமி',
    btn_close: 'மூடு',
    btn_sign_out: 'வெளியேறு',
    active_weather_warnings: 'செயலில் உள்ள வானிலை எச்சரிக்கைகள்',
    official_warning: 'அதிகாரப்பூர்வ எச்சரிக்கை',
    weather_forecast: 'வானிலை முன்னறிவிப்பு',
    numerical_weather_prediction: 'எண் வானிலை கணிப்பு',
    weather_ground_risk: 'வானிலை மற்றும் தரை அபாயம்',
    priority_incidents: 'முன்னுரிமை சம்பவங்கள்',
    citizen_ground_reports: 'குடிமக்கள் கள அறிக்கைகள்',
    original_citizen_report: 'அசல் குடிமக்கள் அறிக்கை',
    original_report: 'Original Report',
    translated_summary: 'Translated Summary',
    ai_assisted_decision_support: 'AI-assisted decision support',
    status_active: 'செயலில் உள்ளது',
    status_resolved: 'தீர்க்கப்பட்டது',
    severity_critical: 'அவசரம்',
    severity_high: 'தீவிரம்',
    severity_moderate: 'மிதமான',
    severity_low: 'குறைந்த',
  },
  hi: {
    nav_dashboard: 'डैशबोर्ड',
    nav_incidents: 'घटनाएं',
    nav_resources: 'संसाधन',
    nav_analytics: 'विश्लेषण',
    nav_settings: 'सेटिंग्स',
    btn_acknowledge: 'स्वीकार करें',
    btn_dispatch_response: 'प्रतिक्रिया भेजें',
    btn_mark_rescue_complete: 'बचाव पूर्ण चिह्नित करें',
    btn_view: 'देखें',
    btn_view_details: 'विवरण देखें',
    btn_save_changes: 'परिवर्तन सहेजें',
    btn_close: 'बंद करें',
    btn_sign_out: 'साइन आउट',
    active_weather_warnings: 'सक्रिय मौसम चेतावनियां',
    official_warning: 'आधिकारिक चेतावनी',
    weather_forecast: 'मौसम पूर्वानुमान',
    numerical_weather_prediction: 'संख्यात्मक मौसम भविष्यवाणी',
    weather_ground_risk: 'मौसम एवं धरातलीय जोखिम',
    priority_incidents: 'प्राथमिकता घटनाएं',
    citizen_ground_reports: 'नागरिक धरातल रिपोर्ट',
    original_citizen_report: 'मूल नागरिक रिपोर्ट',
    original_report: 'Original Report',
    translated_summary: 'Translated Summary',
    ai_assisted_decision_support: 'AI-assisted decision support',
    status_active: 'सक्रिय',
    status_resolved: 'समाधान हुआ',
    severity_critical: 'अति गंभीर',
    severity_high: 'गंभीर',
    severity_moderate: 'मध्यम',
    severity_low: 'निम्न',
  },
  te: {
    nav_dashboard: 'డాష్‌బోర్డ్',
    nav_incidents: 'సంఘటనలు',
    nav_resources: 'వనరులు',
    nav_analytics: 'విశ్లేషణలు',
    nav_settings: 'సెట్టింగ్‌లు',
    btn_acknowledge: 'అంగీకరించు',
    btn_dispatch_response: 'స్పందన పంపండి',
    btn_mark_rescue_complete: 'రెస్క్యూ పూర్తయినట్లు గుర్తించండి',
    btn_view: 'చూడండి',
    btn_view_details: 'వివరాలు చూడండి',
    btn_save_changes: 'మార్పులను సేవ్ చేయండి',
    btn_close: 'మూసివేయి',
    btn_sign_out: 'సైన్ అవుట్',
    active_weather_warnings: 'సక్రియ వాతావరణ హెచ్చరికలు',
    official_warning: 'అధికారిక హెచ్చరిక',
    weather_forecast: 'వాతావరణ అంచనా',
    numerical_weather_prediction: 'సంఖ్యాత్మక వాతావరణ అంచనా',
    weather_ground_risk: 'వాతావరణం మరియు భూ ప్రమాదం',
    priority_incidents: 'ప్రాధాన్యతా సంఘటనలు',
    citizen_ground_reports: 'పౌర క్షేత్ర నివేదికలు',
    original_citizen_report: 'అసలు పౌర నివేదిక',
    original_report: 'Original Report',
    translated_summary: 'Translated Summary',
    ai_assisted_decision_support: 'AI-assisted decision support',
  },
  kn: {
    nav_dashboard: 'ಡ್ಯಾಶ್‌ಬೋರ್ಡ್',
    nav_incidents: 'ಘಟನೆಗಳು',
    nav_resources: 'ಸಂಪನ್ಮೂಲಗಳು',
    nav_analytics: 'ವಿಶ್ಲೇಷಣೆ',
    nav_settings: 'ಸೆಟ್ಟಿಂಗ್‌ಗಳು',
    btn_acknowledge: 'ಸ್ವೀಕರಿಸಿ',
    btn_dispatch_response: 'ಪ್ರತಿಕ್ರಿಯೆ ರವಾನಿಸಿ',
    btn_mark_rescue_complete: 'ರಕ್ಷಣಾ ಕಾರ್ಯಾಚರಣೆ ಪೂರ್ಣಗೊಂಡಿದೆ ಎಂದು ಗುರುತಿಸಿ',
    btn_view: 'ವೀಕ್ಷಿಸಿ',
    btn_view_details: 'ವಿವರಗಳನ್ನು ನೋಡಿ',
    btn_save_changes: 'ಬದಲಾವಣೆಗಳನ್ನು ಉಳಿಸಿ',
    btn_close: 'ಮುಚ್ಚಿ',
    btn_sign_out: 'ಸೈನ್ ಔಟ್',
    active_weather_warnings: 'ಸಕ್ರಿಯ ಹವಾಮಾನ ಎಚ್ಚರಿಕೆಗಳು',
    official_warning: 'ಅಧಿಕೃತ ಎಚ್ಚರಿಕೆ',
    weather_forecast: 'ಹವಾಮಾನ ಮುನ್ಸೂಚನೆ',
    numerical_weather_prediction: 'ಸಾಂಖ್ಯಿಕ ಹವಾಮಾನ ಮುನ್ಸೂಚನೆ',
    weather_ground_risk: 'ಹವಾಮಾನ ಮತ್ತು ಭೂ ಅಪಾಯ',
    priority_incidents: 'ಆದ್ಯತೆಯ ಘಟನೆಗಳು',
    citizen_ground_reports: 'ನಾಗರಿಕ ಕ್ಷೇತ್ರ ವರದಿಗಳು',
    original_citizen_report: 'ಮೂಲ ನಾಗರಿಕ ವರದಿ',
    original_report: 'Original Report',
    translated_summary: 'Translated Summary',
    ai_assisted_decision_support: 'AI-assisted decision support',
  },
  ml: {
    nav_dashboard: 'ഡാഷ്‌ബോർഡ്',
    nav_incidents: 'സംഭവങ്ങൾ',
    nav_resources: 'വിഭവങ്ങൾ',
    nav_analytics: 'വിശകലനം',
    nav_settings: 'ക്രമീകരണങ്ങൾ',
    btn_acknowledge: 'അംഗീകരിക്കുക',
    btn_dispatch_response: 'പ്രതികരണം അയക്കുക',
    btn_mark_rescue_complete: 'രക്ഷാപ്രവർത്തനം പൂർത്തിയായതായി അടയാളപ്പെടുത്തുക',
    btn_view: 'കാണുക',
    btn_view_details: 'വിശദാംശങ്ങൾ കാണുക',
    btn_save_changes: 'മാറ്റങ്ങൾ സംരക്ഷിക്കുക',
    btn_close: 'അടയ്ക്കുക',
    btn_sign_out: 'സൈൻ ഔട്ട്',
    active_weather_warnings: 'സജീവ കാലാവസ്ഥാ മുന്നറിയിപ്പുകൾ',
    official_warning: 'ഔദ്യോഗിക മുന്നറിയിപ്പ്',
    weather_forecast: 'കാലാവസ്ഥാ പ്രവചനം',
    numerical_weather_prediction: 'സംഖ്യാ കാലാവസ്ഥാ പ്രവചനം',
    weather_ground_risk: 'കാലാവസ്ഥയും ഭൗമ അപകടസാധ്യതയും',
    priority_incidents: 'മുൻഗണനാ സംഭവങ്ങൾ',
    citizen_ground_reports: 'പൗരന്മാരുടെ ഗ്രൗണ്ട് റിപ്പോർട്ടുകൾ',
    original_citizen_report: 'യഥാർത്ഥ പൗര റിപ്പോർട്ട്',
    original_report: 'Original Report',
    translated_summary: 'Translated Summary',
    ai_assisted_decision_support: 'AI-assisted decision support',
  },
  bn: {
    nav_dashboard: 'ড্যাশবোর্ড',
    nav_incidents: 'ঘটনাবলী',
    nav_resources: 'সম্পদ',
    nav_analytics: 'বিশ্লেষণ',
    nav_settings: 'সেটিংস',
    btn_acknowledge: 'স্বীকার করুন',
    btn_dispatch_response: 'প্রতিক্রিয়া পাঠান',
    btn_mark_rescue_complete: 'উদ্ধার সম্পন্ন চিহ্নিত করুন',
    btn_view: 'দেখুন',
    btn_view_details: 'বিস্তারিত দেখুন',
    btn_save_changes: 'পরিবর্তনগুলি সংরক্ষণ করুন',
    btn_close: 'বন্ধ করুন',
    btn_sign_out: 'সাইন আউট',
    active_weather_warnings: 'সক্রিয় আবহাওয়া সতর্কতা',
    official_warning: 'সরকারি সতর্কতা',
    weather_forecast: 'আবহাওয়ার পূর্বাভাস',
    numerical_weather_prediction: 'সংখ্যাসূচক আবহাওয়া পূর্বাভাস',
    weather_ground_risk: 'আবহাওয়া এবং ভূ-পৃষ্ঠের ঝুঁকি',
    priority_incidents: 'অগ্রাধিকারমূলক ঘটনা',
    citizen_ground_reports: 'নাগরিক ফিল্ড রিপোর্ট',
    original_citizen_report: 'মূল নাগরিক রিপোর্ট',
    original_report: 'Original Report',
    translated_summary: 'Translated Summary',
    ai_assisted_decision_support: 'AI-assisted decision support',
  },
  mr: {
    nav_dashboard: 'डॅशबोर्ड',
    nav_incidents: 'घटना',
    nav_resources: 'संसाधने',
    nav_analytics: 'विश्लेषण',
    nav_settings: 'सेटिंग्ज',
    btn_acknowledge: 'स्वीकार करा',
    btn_dispatch_response: 'प्रतिसाद पाठवा',
    btn_mark_rescue_complete: 'बचाव कार्य पूर्ण चिन्हांकित करा',
    btn_view: 'पहा',
    btn_view_details: 'तपशील पहा',
    btn_save_changes: 'बदल जतन करा',
    btn_close: 'बंद करा',
    btn_sign_out: 'साइन आउट',
    active_weather_warnings: 'सक्रिय हवामान इशारे',
    official_warning: 'अधिकृत इशारा',
    weather_forecast: 'हवामान अंदाज',
    numerical_weather_prediction: 'संख्यात्मक हवामान अंदाज',
    weather_ground_risk: 'हवामान आणि जमिनीचा धोका',
    priority_incidents: 'प्राधान्य घटना',
    citizen_ground_reports: 'नागरिक ग्राउंड अहवाल',
    original_citizen_report: 'मूळ नागरिक अहवाल',
    original_report: 'Original Report',
    translated_summary: 'Translated Summary',
    ai_assisted_decision_support: 'AI-assisted decision support',
  },
  gu: {
    nav_dashboard: 'ડેશબોર્ડ',
    nav_incidents: 'ઘટનાઓ',
    nav_resources: 'સંસાધનો',
    nav_analytics: 'વિશ્લેષણ',
    nav_settings: 'સેટિંગ્સ',
    btn_acknowledge: 'સ્વીકારો',
    btn_dispatch_response: 'પ્રતિભાવ મોકલો',
    btn_mark_rescue_complete: 'બચાવ પૂર્ણ ચિહ્નિત કરો',
    btn_view: 'જુઓ',
    btn_view_details: 'વિગતો જુઓ',
    btn_save_changes: 'ફેરફારો સાચવો',
    btn_close: 'બંધ કરો',
    btn_sign_out: 'સાઇન આઉટ',
    active_weather_warnings: 'સક્રિય હવામાન ચેતવણીઓ',
    official_warning: 'સત્તાવાર ચેતવણી',
    weather_forecast: 'હવામાન આગાહી',
    numerical_weather_prediction: 'સંખ્યાત્મક હવામાન આગાહી',
    weather_ground_risk: 'હવામાન અને જમીન જોખમ',
    priority_incidents: 'પ્રાથમિકતા ઘટનાઓ',
    citizen_ground_reports: 'નાગરિક ગ્રાઉન્ડ અહેવાલો',
    original_citizen_report: 'મૂળ નાગરિક અહેવાલ',
    original_report: 'Original Report',
    translated_summary: 'Translated Summary',
    ai_assisted_decision_support: 'AI-assisted decision support',
  },
  pa: {
    nav_dashboard: 'ਡੈਸ਼ਬੋਰਡ',
    nav_incidents: 'ਘਟਨਾਵਾਂ',
    nav_resources: 'ਸਰੋਤ',
    nav_analytics: 'ਵਿਸ਼ਲੇਸ਼ਣ',
    nav_settings: 'ਸੈਟਿੰਗਾਂ',
    btn_acknowledge: 'ਸਵੀਕਾਰ ਕਰੋ',
    btn_dispatch_response: 'ਜਵਾਬ ਭੇਜੋ',
    btn_mark_rescue_complete: 'ਬਚਾਅ ਕਾਰਜ ਪੂਰਾ ਚਿੰਨ੍ਹਿਤ ਕਰੋ',
    btn_view: 'ਵੇਖੋ',
    btn_view_details: 'ਵੇਰਵੇ ਵੇਖੋ',
    btn_save_changes: 'ਤਬਦੀਲੀਆਂ ਸੰਭਾਲੋ',
    btn_close: 'ਬੰਦ ਕਰੋ',
    btn_sign_out: 'ਸਾਈਨ ਆਉਟ',
    active_weather_warnings: 'ਸਰਗਰਮ ਮੌਸਮ ਚੇਤਾਵਨੀਆਂ',
    official_warning: 'ਅਧਿਕਾਰਤ ਚੇਤਾਵਨੀ',
    weather_forecast: 'ਮੌਸਮ ਪੇਸ਼ੀਨਗੋਈ',
    numerical_weather_prediction: 'ਸੰਖਿਆਤਮਕ ਮੌਸਮ ਪੇਸ਼ੀਨਗੋਈ',
    weather_ground_risk: 'ਮੌਸਮ ਅਤੇ ਜ਼ਮੀਨੀ ਜੋਖਮ',
    priority_incidents: 'ਤਰਜੀਹੀ ਘਟਨਾਵਾਂ',
    citizen_ground_reports: 'ਨਾਗਰਿਕ ਜ਼ਮੀਨੀ ਰਿਪੋਰਟਾਂ',
    original_citizen_report: 'ਮੂਲ ਨਾਗਰਿਕ ਰਿਪੋਰਟ',
    original_report: 'Original Report',
    translated_summary: 'Translated Summary',
    ai_assisted_decision_support: 'AI-assisted decision support',
  },
};

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [currentLanguage, setCurrentLanguage] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'en';
    } catch (_) {
      return 'en';
    }
  });

  const selectLanguage = useCallback((code) => {
    const found = SUPPORTED_LANGUAGES.find((l) => l.code === code);
    if (!found) return;

    setCurrentLanguage(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch (_) {}
  }, []);

  const activeLanguageObj = useMemo(() => {
    return SUPPORTED_LANGUAGES.find((l) => l.code === currentLanguage) || SUPPORTED_LANGUAGES[0];
  }, [currentLanguage]);

  // Graceful fallback translator: Never returns undefined, missing key, or raw key name
  const t = useCallback(
    (key, defaultEnglish = '') => {
      if (!key) return defaultEnglish;

      // 1. Try selected language
      const langDict = TRANSLATIONS[currentLanguage];
      if (langDict && typeof langDict[key] === 'string' && langDict[key].trim().length > 0) {
        return langDict[key];
      }

      // 2. Fallback to English dictionary
      const enDict = TRANSLATIONS.en;
      if (enDict && typeof enDict[key] === 'string' && enDict[key].trim().length > 0) {
        return enDict[key];
      }

      // 3. Fallback to passed default English string
      if (defaultEnglish && typeof defaultEnglish === 'string') {
        return defaultEnglish;
      }

      // 4. Safe humanized fallback
      return String(key).replace(/_/g, ' ');
    },
    [currentLanguage]
  );

  return (
    <LanguageContext.Provider
      value={{
        currentLanguage,
        activeLanguageObj,
        supportedLanguages: SUPPORTED_LANGUAGES,
        selectLanguage,
        t,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    // Graceful fallback object if used outside provider (prevents crashes during isolated tests)
    return {
      currentLanguage: 'en',
      activeLanguageObj: SUPPORTED_LANGUAGES[0],
      supportedLanguages: SUPPORTED_LANGUAGES,
      selectLanguage: () => {},
      t: (key, fallback) => fallback || key || '',
    };
  }
  return context;
}
