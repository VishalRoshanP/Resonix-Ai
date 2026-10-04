import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'resonix_citizen_settings';

export const DEFAULT_SETTINGS = {
  sosSendTimer: 'none', // 'none' | '3s' | '5s' | '10s'
  sosDelay: 'none', // 'none' | '3s' | '5s' | '10s'
  autoDial112: true, // boolean
  language: 'en', // 'en' | 'ta' | 'hi' | 'te' | 'kn' | 'ml' | 'bn'
  voiceLanguage: 'AUTO', // 'AUTO' | 'en-US' | 'ta-IN' | 'hi-IN' | 'te-IN' | 'kn-IN' | 'ml-IN'
  theme: 'dark', // 'dark' | 'light' | 'auto'
  fontSize: 'normal', // 'normal' | 'large' | 'xlarge'
  emergencyUpdates: true, // boolean
  emergencySound: true, // boolean
};

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Default to 'none' if user never explicitly configured sosSendTimer or has old '3s' default
        if (!parsed.sosSendTimer) {
          parsed.sosSendTimer = parsed.sosDelay && parsed.sosDelay !== '3s' ? parsed.sosDelay : 'none';
          parsed.sosDelay = parsed.sosSendTimer;
        }
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
    } catch (_) {}
    return DEFAULT_SETTINGS;
  });

  // Apply Theme to DOM
  const applyTheme = useCallback((themeMode) => {
    const root = document.documentElement;
    if (themeMode === 'dark') {
      root.classList.add('dark');
    } else if (themeMode === 'light') {
      root.classList.remove('dark');
    } else if (themeMode === 'auto') {
      const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  }, []);

  // Apply Font Scaling to DOM
  const applyFontSize = useCallback((size) => {
    const root = document.documentElement;
    root.setAttribute('data-font-size', size || 'normal');
    if (size === 'large') {
      root.style.fontSize = '18px';
    } else if (size === 'xlarge') {
      root.style.fontSize = '20px';
    } else {
      root.style.fontSize = '16px';
    }
  }, []);

  // Update DOM when theme or font size changes
  useEffect(() => {
    applyTheme(settings.theme);
    applyFontSize(settings.fontSize);

    // Media query listener for auto theme mode
    if (settings.theme === 'auto' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleChange = (e) => {
        if (e.matches) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      };
      mediaQuery.addEventListener('change', handleChange);
      return () => mediaQuery.removeEventListener('change', handleChange);
    }
  }, [settings.theme, settings.fontSize, applyTheme, applyFontSize]);

  // Update a single setting
  const updateSetting = useCallback((key, value) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  }, []);

  // Bulk update settings
  const updateSettings = useCallback((newObj) => {
    setSettings((prev) => {
      const next = { ...prev, ...newObj };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (_) {}
      return next;
    });
  }, []);

  // Reset to defaults
  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
    } catch (_) {}
  }, []);

  // Helper numeric countdown: none -> 0, 3s -> 3, 5s -> 5, 10s -> 10
  const sosCountdownSeconds = (() => {
    const timerVal = settings.sosSendTimer || settings.sosDelay || 'none';
    if (timerVal === '3s' || timerVal === '3' || timerVal === 3) return 3;
    if (timerVal === '5s' || timerVal === '5' || timerVal === 5) return 5;
    if (timerVal === '10s' || timerVal === '10' || timerVal === 10) return 10;
    return 0; // 'none', '0s', 0
  })();

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSetting,
        updateSettings,
        resetSettings,
        sosCountdownSeconds,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
