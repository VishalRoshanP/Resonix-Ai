import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { useSettings } from '../../contexts/SettingsContext';
import { useLanguage, SUPPORTED_LANGUAGES } from '../../contexts/LanguageContext';
import { useAuth } from '../../contexts/AuthContext';
import { feedbackApi } from '../../services/api';

/**
 * Citizen Settings Page for RESONIX AI
 * 
 * Design Principles:
 * - Simple, authoritative government emergency application interface.
 * - Mobile-first with large touch targets and high-contrast typography.
 * - 8 clean, functional sections with real persistence and zero fake/mock data.
 * - Free of developer telemetry, build badges, and AI model names.
 */
export default function CitizenSettingsPage() {
  const navigate = useNavigate();
  const { citizenUser, isCitizenGuest } = useAuth();
  const { settings, updateSetting, updateSettings } = useSettings();
  const { currentLanguage, selectLanguage } = useLanguage();

  // Toast / Feedback message
  const [toast, setToast] = useState({ message: '', type: 'success' });

  // Browser Permission States ('Allowed' | 'Blocked' | 'Not requested' | 'Not available')
  const [permissions, setPermissions] = useState({
    location: 'Checking...',
    microphone: 'Checking...',
    camera: 'Checking...',
    notifications: 'Checking...',
  });

  // Offline Storage Estimate
  const [storageInfo, setStorageInfo] = useState('Checking offline storage...');
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isClearingCache, setIsClearingCache] = useState(false);

  // Emergency Guide Modal
  const [activeGuide, setActiveGuide] = useState(null);

  // Feedback Form State
  const [feedbackText, setFeedbackText] = useState('');
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);

  // Helper Toast
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast({ message: '', type: 'success' }), 3500);
  };

  // Supported Voice Languages (Genuine speech transcription pipeline)
  const VOICE_LANGUAGES = [
    { code: 'AUTO', label: 'Auto Detect' },
    { code: 'en-US', label: 'English (en-US)' },
    { code: 'ta-IN', label: 'Tamil (தமிழ்)' },
    { code: 'hi-IN', label: 'Hindi (हिन्दी)' },
    { code: 'te-IN', label: 'Telugu (తెలుగు)' },
    { code: 'kn-IN', label: 'Kannada (ಕನ್ನಡ)' },
    { code: 'ml-IN', label: 'Malayalam (മലയാളം)' },
  ];

  // Emergency Guides Content (From project emergency documentation)
  const EMERGENCY_GUIDES = {
    FLOOD: {
      title: 'Flood Safety Guide',
      icon: 'water_damage',
      steps: [
        'Move to higher ground immediately.',
        'Do not walk, swim, or drive through moving water.',
        'If trapped in a building, signal for help from the highest safe point.',
        'Avoid direct contact with flood water and electrical wiring.',
        'Use the emergency broadcast in the app if cellular communications are down.',
      ],
    },
    FIRE: {
      title: 'Fire Safety Guide',
      icon: 'local_fire_department',
      steps: [
        'Evacuate the structure immediately.',
        'Stay low to the floor to minimize smoke and toxic gas inhalation.',
        'Use designated emergency evacuation stairwells — do not use elevators.',
        'Check doors for heat with the back of your hand before opening.',
        'Report your active location through the emergency broadcast once safe.',
      ],
    },
  };

  // ===========================================================================
  // 1. QUERY REAL BROWSER PERMISSIONS STATE
  // ===========================================================================
  const checkBrowserPermissions = useCallback(async () => {
    const nextPerms = { ...permissions };

    // Geolocation
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const geo = await navigator.permissions.query({ name: 'geolocation' });
        nextPerms.location = geo.state === 'granted' ? 'Allowed' : geo.state === 'denied' ? 'Blocked' : 'Not requested';
      } catch (_) {
        nextPerms.location = 'navigator.geolocation' in navigator ? 'Not requested' : 'Not available';
      }
    } else {
      nextPerms.location = 'navigator.geolocation' in navigator ? 'Not requested' : 'Not available';
    }

    // Microphone
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const mic = await navigator.permissions.query({ name: 'microphone' });
        nextPerms.microphone = mic.state === 'granted' ? 'Allowed' : mic.state === 'denied' ? 'Blocked' : 'Not requested';
      } catch (_) {
        nextPerms.microphone = navigator.mediaDevices?.getUserMedia ? 'Not requested' : 'Not available';
      }
    } else {
      nextPerms.microphone = navigator.mediaDevices?.getUserMedia ? 'Not requested' : 'Not available';
    }

    // Camera
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const cam = await navigator.permissions.query({ name: 'camera' });
        nextPerms.camera = cam.state === 'granted' ? 'Allowed' : cam.state === 'denied' ? 'Blocked' : 'Not requested';
      } catch (_) {
        nextPerms.camera = navigator.mediaDevices?.getUserMedia ? 'Not requested' : 'Not available';
      }
    } else {
      nextPerms.camera = navigator.mediaDevices?.getUserMedia ? 'Not requested' : 'Not available';
    }

    // Notifications
    if ('Notification' in window) {
      nextPerms.notifications =
        Notification.permission === 'granted'
          ? 'Allowed'
          : Notification.permission === 'denied'
          ? 'Blocked'
          : 'Not requested';
    } else {
      nextPerms.notifications = 'Not available';
    }

    setPermissions(nextPerms);
  }, []);

  useEffect(() => {
    checkBrowserPermissions();
  }, [checkBrowserPermissions]);

  // Request Individual Permission upon User Click
  const handleRequestPermission = async (type) => {
    try {
      if (type === 'location') {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            () => {
              showToast('Location permission granted.');
              checkBrowserPermissions();
            },
            () => {
              showToast('Location permission denied.', 'error');
              checkBrowserPermissions();
            },
            { timeout: 10000 }
          );
        }
      } else if (type === 'microphone') {
        if (navigator.mediaDevices?.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((track) => track.stop());
          showToast('Microphone access granted.');
          checkBrowserPermissions();
        }
      } else if (type === 'camera') {
        if (navigator.mediaDevices?.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          stream.getTracks().forEach((track) => track.stop());
          showToast('Camera access granted.');
          checkBrowserPermissions();
        }
      } else if (type === 'notifications') {
        if ('Notification' in window) {
          const res = await Notification.requestPermission();
          if (res === 'granted') {
            showToast('Notification permission granted.');
          } else {
            showToast('Notification permission denied.', 'error');
          }
          checkBrowserPermissions();
        }
      }
    } catch (err) {
      showToast('Could not request permission.', 'error');
      checkBrowserPermissions();
    }
  };

  // ===========================================================================
  // 2. QUERY REAL OFFLINE STORAGE USAGE
  // ===========================================================================
  const updateStorageEstimate = useCallback(async () => {
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        if (estimate && typeof estimate.usage === 'number') {
          const mb = (estimate.usage / (1024 * 1024)).toFixed(1);
          setStorageInfo(`Offline data stored: ${mb} MB`);
          return;
        }
      } catch (_) {}
    }
    setStorageInfo('Offline emergency data is stored on this device.');
  }, []);

  useEffect(() => {
    updateStorageEstimate();
  }, [updateStorageEstimate]);

  // Safe Cache Clearance (Preserves active emergency data)
  const handleClearSafeCache = async () => {
    try {
      setIsClearingCache(true);

      // 1. Clear temporary browser caches
      if ('caches' in window) {
        const cacheKeys = await caches.keys();
        await Promise.all(
          cacheKeys
            .filter((k) => !k.includes('active_emergency') && !k.includes('unsent_sos'))
            .map((k) => caches.delete(k))
        );
      }

      // 2. Clean temporary sessionStorage
      try {
        sessionStorage.clear();
      } catch (_) {}

      await updateStorageEstimate();
      setShowClearConfirm(false);
      showToast('Offline cache cleared safely. Emergency records preserved.');
    } catch (err) {
      showToast('Failed to clear cache.', 'error');
    } finally {
      setIsClearingCache(false);
    }
  };

  // ===========================================================================
  // 3. SUBMIT REAL CITIZEN FEEDBACK
  // ===========================================================================
  const handleSendFeedback = async (e) => {
    e.preventDefault();
    if (!feedbackText.trim()) {
      showToast('Please enter your feedback before submitting.', 'error');
      return;
    }

    try {
      setIsSubmittingFeedback(true);
      await feedbackApi.submitFeedback({
        message: feedbackText.trim(),
        rating: feedbackRating,
        citizenId: citizenUser?.id || (isCitizenGuest ? 'guest_citizen' : 'anonymous_citizen'),
        citizenName: citizenUser?.name || (isCitizenGuest ? 'Guest Citizen' : 'Citizen'),
        category: 'CITIZEN_SETTINGS_FEEDBACK',
      });

      setFeedbackText('');
      showToast('Feedback sent successfully.');
    } catch (err) {
      showToast(err.data?.message || err.message || 'Failed to submit feedback.', 'error');
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  // Permission Badge Styling
  const getBadgeStyle = (status) => {
    if (status === 'Allowed') {
      return 'bg-emerald-600/15 text-emerald-600 border border-emerald-500/40 font-bold';
    }
    if (status === 'Blocked') {
      return 'bg-red-600/15 text-red-600 border border-red-500/40 font-bold';
    }
    return 'bg-slate-500/15 text-slate-400 border border-slate-500/30';
  };

  return (
    <div className="w-full space-y-4 text-left animate-fade-in pb-8">
      {/* Top Header */}
      <div className="border-b border-outline-variant/60 pb-3">
        <h1 className="text-xl font-extrabold text-primary tracking-tight">Citizen Settings</h1>
        <p className="text-xs text-on-surface-variant mt-0.5">Emergency Preferences & Device Configuration</p>
      </div>

      {/* Dynamic Toast Feedback */}
      {toast.message && (
        <div
          className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 shadow-sm animate-fade-in ${
            toast.type === 'error'
              ? 'bg-error/15 border-error/40 text-error'
              : 'bg-success/15 border-success/40 text-success'
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base">
              {toast.type === 'error' ? 'error' : 'check_circle'}
            </span>
            <span>{toast.message}</span>
          </div>
          <button
            onClick={() => setToast({ message: '', type: 'success' })}
            className="text-xs opacity-70 hover:opacity-100 cursor-pointer font-mono"
          >
            ✕
          </button>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 1. SOS SETTINGS */}
      {/* ==================================================================== */}
      <Card className="p-4 border border-outline-variant/60 shadow-sm space-y-3">
        <h2 className="text-xs font-extrabold text-secondary uppercase tracking-wider flex items-center gap-1.5 border-b border-outline-variant/60 pb-2">
          <span className="material-symbols-outlined text-base">emergency</span>
          <span>SOS Settings</span>
        </h2>

        {/* SOS Send Timer */}
        <div className="space-y-2.5">
          <div>
            <label className="font-extrabold text-xs text-primary block uppercase tracking-wider">
              SOS SEND TIMER
            </label>
            <p className="text-[11px] text-on-surface-variant mt-0.5">
              Choose how long to wait before automatic SOS submission.
            </p>
          </div>

          <div className="space-y-1.5 pt-0.5" role="radiogroup" aria-label="SOS SEND TIMER">
            {[
              { id: 'none', label: 'None', desc: 'No countdown — immediate details form with manual send' },
              { id: '3s', label: '3 seconds', desc: '3-second countdown before automatic emergency broadcast' },
              { id: '5s', label: '5 seconds', desc: '5-second countdown before automatic emergency broadcast' },
              { id: '10s', label: '10 seconds', desc: '10-second countdown before automatic emergency broadcast' },
            ].map((opt) => {
              const currentVal = settings.sosSendTimer || settings.sosDelay || 'none';
              const isSelected = currentVal === opt.id || (currentVal === '0s' && opt.id === 'none');

              return (
                <label
                  key={opt.id}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-secondary/10 border-secondary shadow-xs'
                      : 'bg-surface-container hover:bg-surface-container-high border-outline-variant/60'
                  }`}
                >
                  <input
                    type="radio"
                    name="sosSendTimer"
                    value={opt.id}
                    checked={isSelected}
                    onChange={() => {
                      if (updateSettings) {
                        updateSettings({ sosSendTimer: opt.id, sosDelay: opt.id });
                      } else {
                        updateSetting('sosSendTimer', opt.id);
                        updateSetting('sosDelay', opt.id);
                      }
                      showToast(`SOS send timer updated to ${opt.label}.`);
                    }}
                    className="w-4 h-4 text-secondary focus:ring-secondary cursor-pointer shrink-0 accent-secondary"
                  />
                  <div className="min-w-0 flex-1">
                    <span className={`text-xs block ${isSelected ? 'font-black text-secondary' : 'font-bold text-primary'}`}>
                      {opt.label}
                    </span>
                    <span className="text-[10.5px] text-on-surface-variant block mt-0.5 leading-tight">
                      {opt.desc}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>

          <p className="text-[10.5px] text-on-surface-variant font-medium pt-0.5">
            Current:{' '}
            <span className="font-bold text-secondary">
              {(settings.sosSendTimer || settings.sosDelay) === '3s'
                ? '3 seconds'
                : (settings.sosSendTimer || settings.sosDelay) === '5s'
                ? '5 seconds'
                : (settings.sosSendTimer || settings.sosDelay) === '10s'
                ? '10 seconds'
                : 'None'}
            </span>
          </p>
        </div>

        {/* Automatic Emergency Call */}
        <label className="flex items-center justify-between p-3 rounded-xl bg-surface-container border border-outline-variant cursor-pointer hover:bg-surface-container-high transition-colors">
          <div className="pr-3">
            <span className="font-bold text-xs text-primary block">Automatic Emergency Call</span>
            <span className="text-[11px] text-on-surface-variant leading-tight block mt-0.5">
              Follow emergency-call workflow after confirmed SOS broadcast
            </span>
          </div>
          <input
            type="checkbox"
            checked={settings.autoDial112}
            onChange={(e) => {
              updateSetting('autoDial112', e.target.checked);
              showToast(e.target.checked ? 'Emergency call enabled.' : 'Emergency call disabled.');
            }}
            className="w-5 h-5 rounded text-secondary focus:ring-secondary accent-secondary cursor-pointer shrink-0"
          />
        </label>
      </Card>

      {/* ==================================================================== */}
      {/* 2. LANGUAGE */}
      {/* ==================================================================== */}
      <Card className="p-4 border border-outline-variant/60 shadow-sm space-y-2">
        <h2 className="text-xs font-extrabold text-secondary uppercase tracking-wider flex items-center gap-1.5 border-b border-outline-variant/60 pb-2">
          <span className="material-symbols-outlined text-base">translate</span>
          <span>Language</span>
        </h2>

        <div className="space-y-1">
          <label className="font-bold text-xs text-primary block">Application Language</label>
          <select
            value={currentLanguage}
            onChange={(e) => {
              selectLanguage(e.target.value);
              updateSetting('language', e.target.value);
              showToast('Application language updated.');
            }}
            className="w-full px-3 py-2.5 rounded-xl bg-surface-container border border-outline-variant text-xs font-bold text-primary focus:outline-none focus:border-secondary cursor-pointer min-h-[44px]"
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.flag} {lang.nativeName} ({lang.name})
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* ==================================================================== */}
      {/* 3. VOICE LANGUAGE */}
      {/* ==================================================================== */}
      <Card className="p-4 border border-outline-variant/60 shadow-sm space-y-2">
        <h2 className="text-xs font-extrabold text-secondary uppercase tracking-wider flex items-center gap-1.5 border-b border-outline-variant/60 pb-2">
          <span className="material-symbols-outlined text-base">mic</span>
          <span>Voice Recognition Language</span>
        </h2>

        <div className="space-y-1">
          <label className="font-bold text-xs text-primary block">Spoken Language for Emergency Audio</label>
          <select
            value={settings.voiceLanguage}
            onChange={(e) => {
              updateSetting('voiceLanguage', e.target.value);
              showToast('Voice language updated.');
            }}
            className="w-full px-3 py-2.5 rounded-xl bg-surface-container border border-outline-variant text-xs font-bold text-primary focus:outline-none focus:border-secondary cursor-pointer min-h-[44px]"
          >
            {VOICE_LANGUAGES.map((vLang) => (
              <option key={vLang.code} value={vLang.code}>
                {vLang.label}
              </option>
            ))}
          </select>
          {settings.voiceLanguage === 'AUTO' && (
            <p className="text-[10px] text-on-surface-variant italic pt-0.5">
              Uses automatic spoken-language detection during live voice recording.
            </p>
          )}
        </div>
      </Card>

      {/* ==================================================================== */}
      {/* 4. PERMISSIONS */}
      {/* ==================================================================== */}
      <Card className="p-4 border border-outline-variant/60 shadow-sm space-y-3">
        <div className="flex items-center justify-between border-b border-outline-variant/60 pb-2">
          <h2 className="text-xs font-extrabold text-secondary uppercase tracking-wider flex items-center gap-1.5">
            <span className="material-symbols-outlined text-base">security</span>
            <span>Permissions</span>
          </h2>
          <button
            onClick={checkBrowserPermissions}
            className="text-[10px] text-secondary font-bold hover:underline cursor-pointer"
          >
            Refresh Status
          </button>
        </div>

        <div className="space-y-2">
          {/* Location */}
          <div className="p-3 rounded-xl bg-surface-container border border-outline-variant flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 font-bold text-xs text-primary">
                <span className="material-symbols-outlined text-base text-secondary">location_on</span>
                <span>Location</span>
              </div>
              <span className="text-[10px] text-on-surface-variant block mt-0.5">
                Required for emergency GPS coordinate tagging
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono ${getBadgeStyle(permissions.location)}`}>
                {permissions.location}
              </span>
              {permissions.location !== 'Allowed' && (
                <Button variant="secondary" size="sm" onClick={() => handleRequestPermission('location')} className="text-[10px] py-1 px-2.5">
                  Request
                </Button>
              )}
            </div>
          </div>

          {/* Microphone */}
          <div className="p-3 rounded-xl bg-surface-container border border-outline-variant flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 font-bold text-xs text-primary">
                <span className="material-symbols-outlined text-base text-secondary">mic</span>
                <span>Microphone</span>
              </div>
              <span className="text-[10px] text-on-surface-variant block mt-0.5">
                Required for hands-free emergency audio recording
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono ${getBadgeStyle(permissions.microphone)}`}>
                {permissions.microphone}
              </span>
              {permissions.microphone !== 'Allowed' && (
                <Button variant="secondary" size="sm" onClick={() => handleRequestPermission('microphone')} className="text-[10px] py-1 px-2.5">
                  Request
                </Button>
              )}
            </div>
          </div>

          {/* Camera */}
          <div className="p-3 rounded-xl bg-surface-container border border-outline-variant flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 font-bold text-xs text-primary">
                <span className="material-symbols-outlined text-base text-secondary">photo_camera</span>
                <span>Camera</span>
              </div>
              <span className="text-[10px] text-on-surface-variant block mt-0.5">
                Required for disaster site photo evidence upload
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono ${getBadgeStyle(permissions.camera)}`}>
                {permissions.camera}
              </span>
              {permissions.camera !== 'Allowed' && (
                <Button variant="secondary" size="sm" onClick={() => handleRequestPermission('camera')} className="text-[10px] py-1 px-2.5">
                  Request
                </Button>
              )}
            </div>
          </div>

          {/* Notifications */}
          <div className="p-3 rounded-xl bg-surface-container border border-outline-variant flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5 font-bold text-xs text-primary">
                <span className="material-symbols-outlined text-base text-secondary">notifications</span>
                <span>Notifications</span>
              </div>
              <span className="text-[10px] text-on-surface-variant block mt-0.5">
                Required for real-time responder dispatch updates
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-mono ${getBadgeStyle(permissions.notifications)}`}>
                {permissions.notifications}
              </span>
              {permissions.notifications !== 'Allowed' && (
                <Button variant="secondary" size="sm" onClick={() => handleRequestPermission('notifications')} className="text-[10px] py-1 px-2.5">
                  Request
                </Button>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* ==================================================================== */}
      {/* 5. NOTIFICATIONS */}
      {/* ==================================================================== */}
      <Card className="p-4 border border-outline-variant/60 shadow-sm space-y-3">
        <h2 className="text-xs font-extrabold text-secondary uppercase tracking-wider flex items-center gap-1.5 border-b border-outline-variant/60 pb-2">
          <span className="material-symbols-outlined text-base">notifications_active</span>
          <span>Notifications</span>
        </h2>

        {/* Emergency Response Updates */}
        <label className="flex items-center justify-between p-3 rounded-xl bg-surface-container border border-outline-variant cursor-pointer hover:bg-surface-container-high transition-colors">
          <div className="pr-3">
            <span className="font-bold text-xs text-primary block">Emergency Response Updates</span>
            <span className="text-[11px] text-on-surface-variant leading-tight block mt-0.5">
              Receive updates about your emergency request.
            </span>
          </div>
          <input
            type="checkbox"
            checked={settings.emergencyUpdates}
            onChange={(e) => {
              updateSetting('emergencyUpdates', e.target.checked);
              showToast(e.target.checked ? 'Response updates enabled.' : 'Response updates disabled.');
            }}
            className="w-5 h-5 rounded text-secondary focus:ring-secondary accent-secondary cursor-pointer shrink-0"
          />
        </label>

        {/* Emergency Alert Sound */}
        <label className="flex items-center justify-between p-3 rounded-xl bg-surface-container border border-outline-variant cursor-pointer hover:bg-surface-container-high transition-colors">
          <div className="pr-3">
            <span className="font-bold text-xs text-primary block">Emergency Alert Sound</span>
            <span className="text-[11px] text-on-surface-variant leading-tight block mt-0.5">
              Play an alert when an important emergency update arrives.
            </span>
          </div>
          <input
            type="checkbox"
            checked={settings.emergencySound}
            onChange={(e) => {
              updateSetting('emergencySound', e.target.checked);
              showToast(e.target.checked ? 'Alert sound enabled.' : 'Alert sound disabled.');
            }}
            className="w-5 h-5 rounded text-secondary focus:ring-secondary accent-secondary cursor-pointer shrink-0"
          />
        </label>
      </Card>

      {/* ==================================================================== */}
      {/* 6. APPEARANCE */}
      {/* ==================================================================== */}
      <Card className="p-4 border border-outline-variant/60 shadow-sm space-y-3">
        <h2 className="text-xs font-extrabold text-secondary uppercase tracking-wider flex items-center gap-1.5 border-b border-outline-variant/60 pb-2">
          <span className="material-symbols-outlined text-base">palette</span>
          <span>Appearance</span>
        </h2>

        {/* Theme Options */}
        <div className="space-y-1.5">
          <label className="font-bold text-xs text-primary block">Theme</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'light', label: 'Light', icon: 'light_mode' },
              { id: 'dark', label: 'Dark', icon: 'dark_mode' },
              { id: 'auto', label: 'Auto', icon: 'settings_brightness' },
            ].map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  updateSetting('theme', t.id);
                  showToast(`Theme changed to ${t.label}.`);
                }}
                className={`py-2.5 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-[44px] ${
                  settings.theme === t.id
                    ? 'bg-secondary text-white border-secondary shadow-xs'
                    : 'bg-surface-container border-outline-variant text-primary hover:bg-surface-container-high'
                }`}
              >
                <span className="material-symbols-outlined text-base">{t.icon}</span>
                <span>{t.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Text Size */}
        <div className="space-y-1.5">
          <label className="font-bold text-xs text-primary block">Text Size</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'normal', label: 'Normal' },
              { id: 'large', label: 'Large' },
              { id: 'xlarge', label: 'Extra Large' },
            ].map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  updateSetting('fontSize', s.id);
                  showToast(`Text size set to ${s.label}.`);
                }}
                className={`py-2.5 px-2 rounded-xl border text-xs font-bold flex items-center justify-center transition-all cursor-pointer min-h-[44px] ${
                  settings.fontSize === s.id
                    ? 'bg-secondary text-white border-secondary shadow-xs'
                    : 'bg-surface-container border-outline-variant text-primary hover:bg-surface-container-high'
                }`}
              >
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        </div>
      </Card>

      {/* ==================================================================== */}
      {/* 7. OFFLINE DATA */}
      {/* ==================================================================== */}
      <Card className="p-4 border border-outline-variant/60 shadow-sm space-y-3">
        <h2 className="text-xs font-extrabold text-secondary uppercase tracking-wider flex items-center gap-1.5 border-b border-outline-variant/60 pb-2">
          <span className="material-symbols-outlined text-base">download_for_offline</span>
          <span>Offline Data</span>
        </h2>

        <div className="p-3 rounded-xl bg-surface-container border border-outline-variant flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="font-bold text-xs text-primary block">Offline Emergency Data</span>
            <span className="text-[11px] text-on-surface-variant block mt-0.5">{storageInfo}</span>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowClearConfirm(true)}
            className="text-xs font-bold py-1.5 px-3"
          >
            Clear Offline Data
          </Button>
        </div>
      </Card>

      {/* ==================================================================== */}
      {/* 8. EMERGENCY HELP */}
      {/* ==================================================================== */}
      <Card className="p-4 border border-outline-variant/60 shadow-sm space-y-3">
        <h2 className="text-xs font-extrabold text-secondary uppercase tracking-wider flex items-center gap-1.5 border-b border-outline-variant/60 pb-2">
          <span className="material-symbols-outlined text-base">help_outline</span>
          <span>Emergency Help</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <button
            onClick={() => setActiveGuide(EMERGENCY_GUIDES.FLOOD)}
            className="p-3 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant text-primary text-left font-bold cursor-pointer flex items-center gap-2.5 transition-colors min-h-[48px]"
          >
            <span className="material-symbols-outlined text-xl text-blue-500">water_damage</span>
            <div>
              <span className="block text-xs font-bold leading-tight">Flood Safety</span>
              <span className="text-[10px] text-on-surface-variant font-normal">Survival steps & protocols</span>
            </div>
          </button>

          <button
            onClick={() => setActiveGuide(EMERGENCY_GUIDES.FIRE)}
            className="p-3 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant text-primary text-left font-bold cursor-pointer flex items-center gap-2.5 transition-colors min-h-[48px]"
          >
            <span className="material-symbols-outlined text-xl text-orange-500">local_fire_department</span>
            <div>
              <span className="block text-xs font-bold leading-tight">Fire Safety</span>
              <span className="text-[10px] text-on-surface-variant font-normal">Evacuation procedures</span>
            </div>
          </button>
        </div>

        <button
          onClick={() => navigate('/emergency-guide')}
          className="text-xs text-secondary font-bold hover:underline block pt-1 cursor-pointer"
        >
          View all emergency procedures ➔
        </button>
      </Card>

      {/* ==================================================================== */}
      {/* 9. FEEDBACK */}
      {/* ==================================================================== */}
      <Card className="p-4 border border-outline-variant/60 shadow-sm space-y-3">
        <h2 className="text-xs font-extrabold text-secondary uppercase tracking-wider flex items-center gap-1.5 border-b border-outline-variant/60 pb-2">
          <span className="material-symbols-outlined text-base">rate_review</span>
          <span>Feedback</span>
        </h2>

        <form onSubmit={handleSendFeedback} className="space-y-3">
          <div>
            <label className="font-bold text-xs text-primary block mb-1">Rating</label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setFeedbackRating(star)}
                  className={`p-1 text-lg transition-transform hover:scale-110 cursor-pointer ${
                    feedbackRating >= star ? 'text-amber-500' : 'text-slate-400'
                  }`}
                  aria-label={`Rate ${star} star`}
                >
                  ★
                </button>
              ))}
              <span className="text-xs text-on-surface-variant font-bold ml-1">{feedbackRating} / 5</span>
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-bold text-xs text-primary block">Your Message</label>
            <textarea
              rows={3}
              placeholder="Provide feedback on your emergency application experience..."
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              className="w-full p-3 rounded-xl bg-surface-container border border-outline-variant text-xs text-primary placeholder:text-on-surface-variant/60 focus:outline-none focus:border-secondary resize-none"
            />
          </div>

          <Button
            variant="primary"
            size="full"
            type="submit"
            loading={isSubmittingFeedback}
            className="min-h-[44px] font-bold text-xs"
          >
            Send Feedback
          </Button>
        </form>
      </Card>

      {/* ==================================================================== */}
      {/* CLEAR OFFLINE DATA CONFIRMATION MODAL */}
      {/* ==================================================================== */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <Card className="bg-surface border border-outline-variant max-w-sm w-full p-5 space-y-4 shadow-2xl text-left animate-fade-in">
            <div className="flex items-center gap-2.5 text-secondary border-b border-outline-variant/60 pb-2">
              <span className="material-symbols-outlined text-2xl">delete_sweep</span>
              <h3 className="text-base font-extrabold text-primary">Clear Offline Data</h3>
            </div>

            <div className="space-y-2 text-xs text-on-surface-variant">
              <p className="text-primary font-bold">
                Are you sure you want to remove cached offline data from this device?
              </p>
              <p>
                ✓ Active unsent emergency SOS packets will be <strong>preserved</strong>.
              </p>
              <p>
                ✓ Emergency records and user account credentials will be <strong>preserved</strong>.
              </p>
              <p className="text-[11px] text-on-surface-variant italic">
                Only safe temporary network bundles and cached tiles will be cleared.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowClearConfirm(false)}
                disabled={isClearingCache}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleClearSafeCache}
                loading={isClearingCache}
                className="text-xs font-bold"
              >
                Clear Data
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* ==================================================================== */}
      {/* EMERGENCY GUIDE MODAL */}
      {/* ==================================================================== */}
      {activeGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
          <Card className="bg-surface border border-outline-variant max-w-md w-full p-5 space-y-4 shadow-2xl text-left animate-fade-in max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-outline-variant/60 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-2xl text-secondary">{activeGuide.icon}</span>
                <h3 className="text-base font-extrabold text-primary">{activeGuide.title}</h3>
              </div>
              <button
                onClick={() => setActiveGuide(null)}
                className="w-8 h-8 rounded-lg bg-surface-container flex items-center justify-center text-on-surface-variant hover:text-primary cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-bold text-secondary uppercase tracking-wider">
                Emergency Action Steps:
              </p>
              <ol className="space-y-2">
                {activeGuide.steps.map((step, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-xs text-primary leading-relaxed">
                    <span className="w-5 h-5 rounded-full bg-secondary/15 text-secondary font-bold flex items-center justify-center shrink-0 text-[11px]">
                      {idx + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="pt-2 flex justify-between items-center border-t border-outline-variant/60">
              <button
                onClick={() => {
                  setActiveGuide(null);
                  navigate('/emergency-guide');
                }}
                className="text-xs text-secondary font-bold hover:underline cursor-pointer"
              >
                Open Full Guide Page ➔
              </button>
              <Button variant="secondary" size="sm" onClick={() => setActiveGuide(null)} className="text-xs">
                Close
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
