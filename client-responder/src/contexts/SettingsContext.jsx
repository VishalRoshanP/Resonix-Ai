import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { settingsApi } from '../services/api';

const STORAGE_KEY = 'resonix_responder_settings';

export const DEFAULT_RESPONDER_SETTINGS = {
  audioAlerts: true,
  criticalAlerts: true,
  vibrationAlerts: true,
  offlineRelay: true,
  theme: 'dark',
  fontSize: 'normal',
  highContrast: false,
  newEmergencyAlerts: true,
  statusUpdates: true,
  rescueCompletionAlerts: true,
};

// Module-level AudioContext singleton — lazily created on first user gesture to avoid autoplay policy warnings.
// Kept outside React component lifecycle so HMR and re-renders don't interfere.
let _sharedAudioCtx = null;
let _audioCtxUnlocked = false;

function _getOrCreateAudioCtx() {
  if (_sharedAudioCtx) return _sharedAudioCtx;
  // Only create after user gesture flag is set
  if (!_audioCtxUnlocked) return null;
  try {
    const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
    if (AudioCtxClass) _sharedAudioCtx = new AudioCtxClass();
  } catch (_) {}
  return _sharedAudioCtx;
}

// One-time unlock: register listeners that set the flag on first user gesture
if (typeof window !== 'undefined') {
  const _unlockAudio = () => {
    _audioCtxUnlocked = true;
    // If context already exists but is suspended, resume it
    if (_sharedAudioCtx && _sharedAudioCtx.state === 'suspended') {
      _sharedAudioCtx.resume().catch(() => {});
    }
    window.removeEventListener('pointerdown', _unlockAudio);
    window.removeEventListener('keydown', _unlockAudio);
  };
  window.addEventListener('pointerdown', _unlockAudio, { once: true });
  window.addEventListener('keydown', _unlockAudio, { once: true });
}

const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_RESPONDER_SETTINGS, ...JSON.parse(saved) };
      }
    } catch (_) {}
    return DEFAULT_RESPONDER_SETTINGS;
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isOnline, setIsOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));

  // Network connection listener (Read-only real state)
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Apply Theme, High Contrast, and Font Size to document root
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;

    const applyTheme = () => {
      let effectiveTheme = settings.theme || 'dark';
      if (effectiveTheme === 'system') {
        const prefersDark = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        effectiveTheme = prefersDark ? 'dark' : 'light';
      }

      if (effectiveTheme === 'dark') {
        root.classList.add('dark');
        root.classList.remove('light');
        if (document.body) {
          document.body.classList.add('dark');
          document.body.classList.remove('light');
        }
      } else {
        root.classList.remove('dark');
        root.classList.add('light');
        if (document.body) {
          document.body.classList.remove('dark');
          document.body.classList.add('light');
        }
      }

      // 2. High Contrast
      if (settings.highContrast) {
        root.classList.add('high-contrast');
      } else {
        root.classList.remove('high-contrast');
      }

      // 3. Font Size Scaling
      root.setAttribute('data-font-size', settings.fontSize || 'normal');
    };

    applyTheme();

    if (settings.theme === 'system' && typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const listener = () => applyTheme();
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', listener);
        return () => mediaQuery.removeEventListener('change', listener);
      }
    }
  }, [settings.theme, settings.highContrast, settings.fontSize]);

  // Web Audio Synthesizer for Emergency Alert Sound
  const playEmergencyAlertSound = useCallback(() => {
    if (!settings.audioAlerts) return;
    try {
      const ctx = _getOrCreateAudioCtx();
      if (!ctx || ctx.state !== 'running') return; // No context yet or still suspended — silently skip

      // Two-tone rising emergency chime (880Hz -> 1174Hz)
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.15);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1174.66, now + 0.18);
      gain2.gain.setValueAtTime(0.15, now + 0.18);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.18);
      osc2.stop(now + 0.35);
    } catch (_) {}
  }, [settings.audioAlerts]);

  // Haptic / Vibration Alert
  const triggerVibration = useCallback(() => {
    if (!settings.vibrationAlerts) return;
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate([200, 100, 200]);
      }
    } catch (_) {}
  }, [settings.vibrationAlerts]);

  // Save Settings Function (LocalStorage + Backend Sync)
  const saveSettings = useCallback(async (newSettings) => {
    setIsSaving(true);
    const merged = { ...settings, ...newSettings };
    setSettings(merged);

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    } catch (_) {}

    try {
      await settingsApi.updateSettings(merged);
    } catch (_) {
      // Offline / network fallback preserved in localStorage
    } finally {
      setIsSaving(false);
    }
    return merged;
  }, [settings]);

  // Reset to Application Defaults
  const resetSettings = useCallback(async () => {
    setIsSaving(true);
    setSettings(DEFAULT_RESPONDER_SETTINGS);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_RESPONDER_SETTINGS));
    } catch (_) {}

    try {
      await settingsApi.updateSettings(DEFAULT_RESPONDER_SETTINGS);
    } catch (_) {}
    finally {
      setIsSaving(false);
    }
    return DEFAULT_RESPONDER_SETTINGS;
  }, []);

  return (
    <SettingsContext.Provider
      value={{
        settings,
        setSettings,
        saveSettings,
        resetSettings,
        isSaving,
        isOnline,
        playEmergencyAlertSound,
        triggerVibration,
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

export default SettingsContext;
