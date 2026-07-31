import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';

export default function CitizenSettingsPage() {
  const navigate = useNavigate();

  // Settings State
  const [settings, setSettings] = useState({
    sosDelay: '3s', // '0s' | '3s' | '5s'
    autoDial112: true,
    language: 'en-US',
    voiceLanguage: 'AUTO', // 'AUTO' | 'en-IN' | 'ta-IN' | 'hi-IN' | 'te-IN' | 'kn-IN' | 'ml-IN'
    theme: 'dark', // 'dark' | 'light' | 'auto'
    highContrast: false,
    fontSize: 'normal', // 'normal' | 'large' | 'xlarge'
    screenReaderPrompts: false,
    pushNotifications: true,
    alarmSound: true,
    weatherWarnings: true,
    anonymousTelemetry: true,
    offlineMapCached: true,
    feedbackRating: 5,
    feedbackComment: '',
  });

  const [toastMessage, setToastMessage] = useState('');

  const LANGUAGES = [
    { code: 'en-US', label: 'English' },
    { code: 'hi-IN', label: 'Hindi (हिंदी)' },
    { code: 'bn-IN', label: 'Bengali (বাংলা)' },
    { code: 'ta-IN', label: 'Tamil (தமிழ்)' },
    { code: 'te-IN', label: 'Telugu (తెలుగు)' },
    { code: 'mr-IN', label: 'Marathi (मराठी)' },
    { code: 'gu-IN', label: 'Gujarati (ગુજરાતી)' },
    { code: 'kn-IN', label: 'Kannada (ಕನ್ನಡ)' },
    { code: 'ml-IN', label: 'Malayalam (മലയാളം)' },
    { code: 'pa-IN', label: 'Punjabi (ਪੰਜਾਬੀ)' },
  ];

  const VOICE_LANGUAGES = [
    { code: 'AUTO', label: '🌐 Auto Detect (Browser Language)' },
    { code: 'en-IN', label: '🇮🇳 English (India) - en-IN' },
    { code: 'ta-IN', label: '🇮🇳 Tamil (தமிழ்) - ta-IN' },
    { code: 'hi-IN', label: '🇮🇳 Hindi (हिंदी) - hi-IN' },
    { code: 'te-IN', label: '🇮🇳 Telugu (తెలుగు) - te-IN' },
    { code: 'kn-IN', label: '🇮🇳 Kannada (ಕನ್ನಡ) - kn-IN' },
    { code: 'ml-IN', label: '🇮🇳 Malayalam (മലയാളം) - ml-IN' },
  ];

  const handleToggle = (key) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
    showToast('Setting updated.');
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings((prev) => ({ ...prev, [name]: value }));
    showToast('Setting updated.');
  };

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2500);
  };

  const handleClearCache = () => {
    if (window.confirm('Clear offline packets and cached maps?')) {
      showToast('✅ Local cache cleared successfully.');
    }
  };

  const handleFeedbackSubmit = (e) => {
    e.preventDefault();
    showToast('🙏 Thank you for your feedback!');
    setSettings((prev) => ({ ...prev, feedbackComment: '' }));
  };

  return (
    <div className="w-full py-4 sm:py-6 space-y-4 text-left animate-fade-in pb-4 text-xs">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-outline-variant/60 pb-3">
        <div>
          <h1 className="text-xl font-extrabold text-primary leading-none">Citizen Settings</h1>
          <p className="text-[10px] text-on-surface-variant mt-1">Application Preferences & Controls</p>
        </div>
        <span className="text-[10px] font-mono font-bold text-secondary bg-secondary/10 px-2.5 py-1 rounded-full border border-secondary/30">
          v2.4.0-Resonix
        </span>
      </div>

      {toastMessage && (
        <div className="p-3 rounded-xl bg-secondary/15 border border-secondary/30 text-primary font-bold flex items-center gap-2 animate-fade-in shadow-sm">
          <span className="material-symbols-outlined text-secondary text-base">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. Emergency Preferences */}
      <Card className="p-4 border border-outline-variant/60 shadow-sm space-y-3">
        <h2 className="text-xs font-extrabold text-secondary uppercase tracking-wider flex items-center gap-1.5 border-b border-outline-variant/60 pb-2">
          <span className="material-symbols-outlined text-base">emergency</span>
          <span>Emergency Preferences</span>
        </h2>

        <div className="space-y-1">
          <label className="font-bold text-primary block">SOS Trigger Countdown Delay</label>
          <select
            name="sosDelay"
            value={settings.sosDelay}
            onChange={handleChange}
            className="w-full px-3 py-2 rounded-xl bg-surface-container border border-outline-variant text-xs font-medium text-primary focus:outline-none focus:border-secondary cursor-pointer min-h-[40px]"
          >
            <option value="0s">Instant Broadcast (0s - Emergency Priority)</option>
            <option value="3s">3 Seconds Countdown (Safety Buffer)</option>
            <option value="5s">5 Seconds Countdown</option>
          </select>
        </div>

        <label className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container border border-outline-variant cursor-pointer">
          <div>
            <span className="font-bold text-primary block">Auto-Dial Helpline 112 on SOS</span>
            <span className="text-[10px] text-on-surface-variant">Automatically trigger dialer during SOS broadcast</span>
          </div>
          <input
            type="checkbox"
            checked={settings.autoDial112}
            onChange={() => handleToggle('autoDial112')}
            className="w-4 h-4 rounded text-secondary focus:ring-secondary accent-secondary cursor-pointer"
          />
        </label>
      </Card>

      {/* 2. Language Options */}
      <Card className="p-4 border border-outline-variant/60 shadow-sm space-y-2">
        <h2 className="text-xs font-extrabold text-secondary uppercase tracking-wider flex items-center gap-1.5 border-b border-outline-variant/60 pb-2">
          <span className="material-symbols-outlined text-base">translate</span>
          <span>Application Language</span>
        </h2>

        <select
          name="language"
          value={settings.language}
          onChange={handleChange}
          className="w-full px-3 py-2.5 rounded-xl bg-surface-container border border-outline-variant text-xs font-medium text-primary focus:outline-none focus:border-secondary cursor-pointer min-h-[44px]"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.label}
            </option>
          ))}
        </select>
      </Card>

      {/* 3. Voice Recognition Language */}
      <Card className="p-4 border border-outline-variant/60 shadow-sm space-y-2">
        <h2 className="text-xs font-extrabold text-secondary uppercase tracking-wider flex items-center gap-1.5 border-b border-outline-variant/60 pb-2">
          <span className="material-symbols-outlined text-base">mic</span>
          <span>Voice Recognition Language</span>
        </h2>

        <select
          name="voiceLanguage"
          value={settings.voiceLanguage}
          onChange={handleChange}
          className="w-full px-3 py-2.5 rounded-xl bg-surface-container border border-outline-variant text-xs font-medium text-primary focus:outline-none focus:border-secondary cursor-pointer min-h-[44px]"
        >
          {VOICE_LANGUAGES.map((vLang) => (
            <option key={vLang.code} value={vLang.code}>
              {vLang.label}
            </option>
          ))}
        </select>
      </Card>

      {/* 4. Theme & Accessibility */}
      <Card className="p-4 border border-outline-variant/60 shadow-sm space-y-3">
        <h2 className="text-xs font-extrabold text-secondary uppercase tracking-wider flex items-center gap-1.5 border-b border-outline-variant/60 pb-2">
          <span className="material-symbols-outlined text-base">contrast</span>
          <span>Theme & Accessibility</span>
        </h2>

        <div className="space-y-1">
          <label className="font-bold text-primary block">Interface Theme Mode</label>
          <div className="grid grid-cols-3 gap-1.5 text-center font-bold">
            {['dark', 'light', 'auto'].map((mode) => (
              <button
                key={mode}
                onClick={() => setSettings((p) => ({ ...p, theme: mode }))}
                className={`py-2 rounded-xl border capitalize transition-all cursor-pointer ${
                  settings.theme === mode
                    ? 'bg-secondary text-white border-secondary shadow-xs font-extrabold'
                    : 'bg-surface-container border-outline-variant text-primary hover:bg-surface-container-high'
                }`}
              >
                {mode === 'dark' ? '🌙 Dark' : mode === 'light' ? '☀️ Light' : '⚙️ Auto'}
              </button>
            ))}
          </div>
        </div>

        <label className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container border border-outline-variant cursor-pointer">
          <div>
            <span className="font-bold text-primary block">High Contrast Mode</span>
            <span className="text-[10px] text-on-surface-variant">Enhanced visibility for extreme disaster conditions</span>
          </div>
          <input
            type="checkbox"
            checked={settings.highContrast}
            onChange={() => handleToggle('highContrast')}
            className="w-4 h-4 rounded text-secondary focus:ring-secondary accent-secondary cursor-pointer"
          />
        </label>

        <div className="space-y-1">
          <label className="font-bold text-primary block">Text Size Scaling</label>
          <select
            name="fontSize"
            value={settings.fontSize}
            onChange={handleChange}
            className="w-full px-3 py-2 rounded-xl bg-surface-container border border-outline-variant text-xs font-medium text-primary focus:outline-none focus:border-secondary cursor-pointer min-h-[40px]"
          >
            <option value="normal">Normal (Default)</option>
            <option value="large">Large Text (Accessible)</option>
            <option value="xlarge">Extra Large Text</option>
          </select>
        </div>
      </Card>

      {/* 4. Hardware Permissions Manager */}
      <Card className="p-4 border border-outline-variant/60 shadow-sm space-y-2.5">
        <h2 className="text-xs font-extrabold text-secondary uppercase tracking-wider flex items-center gap-1.5 border-b border-outline-variant/60 pb-2">
          <span className="material-symbols-outlined text-base">security</span>
          <span>Hardware & Location Permissions</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="p-2.5 rounded-xl bg-surface-container border border-outline-variant flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-bold text-primary">
              <span className="material-symbols-outlined text-base text-secondary">my_location</span>
              <span>GPS Location</span>
            </span>
            <span className="text-[10px] font-bold text-success">ALLOWED</span>
          </div>

          <div className="p-2.5 rounded-xl bg-surface-container border border-outline-variant flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-bold text-primary">
              <span className="material-symbols-outlined text-base text-secondary">mic</span>
              <span>Microphone</span>
            </span>
            <span className="text-[10px] font-bold text-success">ALLOWED</span>
          </div>

          <div className="p-2.5 rounded-xl bg-surface-container border border-outline-variant flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-bold text-primary">
              <span className="material-symbols-outlined text-base text-secondary">photo_camera</span>
              <span>Camera</span>
            </span>
            <span className="text-[10px] font-bold text-success">ALLOWED</span>
          </div>

          <div className="p-2.5 rounded-xl bg-surface-container border border-outline-variant flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-bold text-primary">
              <span className="material-symbols-outlined text-base text-secondary">notifications</span>
              <span>Notifications</span>
            </span>
            <span className="text-[10px] font-bold text-success">ALLOWED</span>
          </div>
        </div>
      </Card>

      {/* 5. Notifications & Alerts */}
      <Card className="p-4 border border-outline-variant/60 shadow-sm space-y-2.5">
        <h2 className="text-xs font-extrabold text-secondary uppercase tracking-wider flex items-center gap-1.5 border-b border-outline-variant/60 pb-2">
          <span className="material-symbols-outlined text-base">notifications_active</span>
          <span>Notifications & Warnings</span>
        </h2>

        <label className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container border border-outline-variant cursor-pointer">
          <div>
            <span className="font-bold text-primary block">Push Notification Dispatch Alerts</span>
            <span className="text-[10px] text-on-surface-variant">Receive rescue team updates in real-time</span>
          </div>
          <input
            type="checkbox"
            checked={settings.pushNotifications}
            onChange={() => handleToggle('pushNotifications')}
            className="w-4 h-4 rounded text-secondary focus:ring-secondary accent-secondary cursor-pointer"
          />
        </label>

        <label className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container border border-outline-variant cursor-pointer">
          <div>
            <span className="font-bold text-primary block">Loud Dispatch Alarm & Vibration</span>
            <span className="text-[10px] text-on-surface-variant">Sound loud alarm tone when first responders arrive</span>
          </div>
          <input
            type="checkbox"
            checked={settings.alarmSound}
            onChange={() => handleToggle('alarmSound')}
            className="w-4 h-4 rounded text-secondary focus:ring-secondary accent-secondary cursor-pointer"
          />
        </label>
      </Card>

      {/* 6. Privacy & Offline Downloads */}
      <Card className="p-4 border border-outline-variant/60 shadow-sm space-y-3">
        <h2 className="text-xs font-extrabold text-secondary uppercase tracking-wider flex items-center gap-1.5 border-b border-outline-variant/60 pb-2">
          <span className="material-symbols-outlined text-base">download_for_offline</span>
          <span>Offline Downloads & Privacy</span>
        </h2>

        <div className="p-3 rounded-xl bg-surface-container border border-outline-variant flex items-center justify-between">
          <div>
            <span className="font-bold text-primary block">Offline Survival Maps & Mesh Bundle</span>
            <span className="text-[10px] text-on-surface-variant">Cached Status: 14.2 MB Storage Used</span>
          </div>
          <Button variant="secondary" size="sm" onClick={handleClearCache}>
            Clear Cache
          </Button>
        </div>

        <label className="flex items-center justify-between p-2.5 rounded-xl bg-surface-container border border-outline-variant cursor-pointer">
          <div>
            <span className="font-bold text-primary block">Anonymous Telemetry Collection</span>
            <span className="text-[10px] text-on-surface-variant">Share anonymized disaster data for NDRF research</span>
          </div>
          <input
            type="checkbox"
            checked={settings.anonymousTelemetry}
            onChange={() => handleToggle('anonymousTelemetry')}
            className="w-4 h-4 rounded text-secondary focus:ring-secondary accent-secondary cursor-pointer"
          />
        </label>
      </Card>

      {/* 7. Help & Disaster Guides */}
      <Card className="p-4 border border-outline-variant/60 shadow-sm space-y-2.5">
        <h2 className="text-xs font-extrabold text-secondary uppercase tracking-wider flex items-center gap-1.5 border-b border-outline-variant/60 pb-2">
          <span className="material-symbols-outlined text-base">help</span>
          <span>Emergency Guides & Assistance</span>
        </h2>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => showToast('Opening Flood Survival Protocol Guide...')}
            className="p-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant text-primary text-left font-bold cursor-pointer flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-base text-secondary">water_damage</span>
            <span>Flood Guide</span>
          </button>

          <button
            onClick={() => showToast('Opening Fire Safety Protocol Guide...')}
            className="p-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant text-primary text-left font-bold cursor-pointer flex items-center gap-2"
          >
            <span className="material-symbols-outlined text-base text-secondary">local_fire_department</span>
            <span>Fire Safety</span>
          </button>
        </div>
      </Card>

      {/* 8. Feedback & Rating */}
      <Card className="p-4 border border-outline-variant/60 shadow-sm space-y-2.5">
        <h2 className="text-xs font-extrabold text-secondary uppercase tracking-wider flex items-center gap-1.5 border-b border-outline-variant/60 pb-2">
          <span className="material-symbols-outlined text-base">rate_review</span>
          <span>Submit Feedback</span>
        </h2>

        <form onSubmit={handleFeedbackSubmit} className="space-y-2">
          <textarea
            rows={2}
            placeholder="Help us improve RESONIX AI citizen emergency response..."
            value={settings.feedbackComment}
            onChange={(e) => setSettings((p) => ({ ...p, feedbackComment: e.target.value }))}
            className="w-full p-2.5 rounded-xl bg-surface-container border border-outline-variant text-xs text-primary placeholder:text-stone-600 focus:outline-none focus:border-secondary resize-none"
          />
          <Button variant="secondary" size="full" type="submit" className="min-h-[38px] font-bold">
            Send Feedback
          </Button>
        </form>
      </Card>

      {/* 9. About Application */}
      <Card className="p-4 border border-outline-variant/60 shadow-sm space-y-2 text-center text-on-surface-variant">
        <p className="font-extrabold text-primary text-xs">RESONIX AI Citizen Emergency Network</p>
        <p className="text-[10px]">Framework Version: 2.4.0 • Build ID: 2026.07.29-prod</p>
        <p className="text-[10px] opacity-75">Developed in collaboration with NDMA & NDRF Emergency Guidelines</p>
      </Card>
    </div>
  );
}
