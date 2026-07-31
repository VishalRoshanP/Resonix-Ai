import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { resolveApiUrl } from '../utils/env';

export const SUPPORTED_LANGUAGES = [
  {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    script: 'Latin',
    greeting: 'Welcome to RESONIX AI',
    flag: '🌐',
  },
  {
    code: 'ta',
    name: 'Tamil',
    nativeName: 'தமிழ்',
    script: 'Tamil',
    greeting: 'RESONIX AI-க்கு வரவேற்கிறோம்',
    flag: '🇮🇳',
  },
  {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    script: 'Devanagari',
    greeting: 'RESONIX AI में आपका स्वागत है',
    flag: '🇮🇳',
  },
  {
    code: 'te',
    name: 'Telugu',
    nativeName: 'తెలుగు',
    script: 'Telugu',
    greeting: 'RESONIX AI కి స్వాగతం',
    flag: '🇮🇳',
  },
  {
    code: 'kn',
    name: 'Kannada',
    nativeName: 'ಕನ್ನಡ',
    script: 'Kannada',
    greeting: 'RESONIX AI ಗೆ స్వాగత',
    flag: '🇮🇳',
  },
  {
    code: 'ml',
    name: 'Malayalam',
    nativeName: 'മലയാളം',
    script: 'Malayalam',
    greeting: 'RESONIX AI ലേക്ക് സ്വാഗതം',
    flag: '🇮🇳',
  },
  {
    code: 'bn',
    name: 'Bengali',
    nativeName: 'বাংলা',
    script: 'Bengali',
    greeting: 'RESONIX AI-এ স্বাগতম',
    flag: '🇮🇳',
  },
];

const STORAGE_KEY = 'resonix_selected_language';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const { user } = useAuth() || {};

  const [currentLanguage, setCurrentLanguage] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) || 'en';
  });

  const [hasSelectedLanguage, setHasSelectedLanguage] = useState(() => {
    return Boolean(localStorage.getItem(STORAGE_KEY));
  });

  // Sync with MongoDB backend when user is logged in
  const syncLanguageToBackend = useCallback(async (langCode, userId) => {
    if (!userId) return;
    try {
      await fetch(resolveApiUrl(`/api/users/${userId}/language`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: langCode }),
      });
    } catch (err) {
      console.warn('[LanguageContext] Backend sync fallback active:', err.message);
    }
  }, []);

  // Update language choice
  const selectLanguage = useCallback(
    async (code) => {
      const found = SUPPORTED_LANGUAGES.find((l) => l.code === code);
      if (!found) return;

      setCurrentLanguage(code);
      setHasSelectedLanguage(true);
      localStorage.setItem(STORAGE_KEY, code);

      if (user?.id) {
        await syncLanguageToBackend(code, user.id);
      }
    },
    [user, syncLanguageToBackend]
  );

  // Sync local storage language to logged-in user profile on initial load or user change
  useEffect(() => {
    if (user?.language && user?.language !== currentLanguage) {
      setCurrentLanguage(user.language);
      setHasSelectedLanguage(true);
      localStorage.setItem(STORAGE_KEY, user.language);
    } else if (user?.id && hasSelectedLanguage) {
      syncLanguageToBackend(currentLanguage, user.id);
    }
  }, [user, currentLanguage, hasSelectedLanguage, syncLanguageToBackend]);

  const activeLanguageObj = SUPPORTED_LANGUAGES.find((l) => l.code === currentLanguage) || SUPPORTED_LANGUAGES[0];

  return (
    <LanguageContext.Provider
      value={{
        currentLanguage,
        activeLanguageObj,
        supportedLanguages: SUPPORTED_LANGUAGES,
        selectLanguage,
        hasSelectedLanguage,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
