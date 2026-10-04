import { useState, useEffect } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useSettings, DEFAULT_RESPONDER_SETTINGS } from '../contexts/SettingsContext';
import { useLanguage } from '../contexts/LanguageContext';

export default function SettingsPage() {
  const {
    settings,
    saveSettings,
    resetSettings,
    isSaving,
    isOnline,
    playEmergencyAlertSound,
  } = useSettings();

  const { currentLanguage, supportedLanguages, selectLanguage, t } = useLanguage();

  // Local draft state for settings form
  const [localSettings, setLocalSettings] = useState({ ...settings });
  const [toastMsg, setToastMsg] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  // Keep local draft in sync if external settings update
  useEffect(() => {
    setLocalSettings({ ...settings });
  }, [settings]);

  const handleToggle = (key) => {
    const nextVal = !localSettings[key];
    setLocalSettings((prev) => ({ ...prev, [key]: nextVal }));
    saveSettings({ [key]: nextVal });
  };

  const handleSelect = (key, value) => {
    setLocalSettings((prev) => ({ ...prev, [key]: value }));
    saveSettings({ [key]: value });
  };

  const handleSave = async () => {
    await saveSettings(localSettings);
    showToast('Settings saved.');
  };

  const handleConfirmReset = async () => {
    await resetSettings();
    setLocalSettings(DEFAULT_RESPONDER_SETTINGS);
    setShowResetModal(false);
    showToast('Settings reset to default values.');
  };

  const getOptionButtonClass = (isSelected) => {
    return `p-2.5 rounded-xl border flex items-center justify-center gap-1.5 font-bold transition-all cursor-pointer select-none ${
      isSelected
        ? 'btn-setting-selected bg-secondary text-white !text-white border-secondary shadow-xs hover:bg-secondary hover:text-white hover:!text-white focus-visible:text-white focus-visible:!text-white'
        : 'btn-setting-unselected bg-surface-container text-primary border-outline-variant hover:bg-surface-container-high hover:text-primary'
    }`;
  };

  return (
    <div className="space-y-6 text-left animate-fade-in max-w-4xl mx-auto pb-12">
      {/* Header Bar */}
      <div className="border-b border-outline-variant/60 pb-4">
        <h1 className="text-2xl font-black text-primary tracking-tight">RESPONDER SETTINGS</h1>
        <p className="text-xs text-on-surface-variant mt-1">
          Preferences for emergency alerts and display
        </p>
      </div>

      {/* Success Toast */}
      {toastMsg && (
        <div className="p-3 rounded-xl bg-success/15 border border-success/30 text-success font-bold text-xs flex items-center gap-2 animate-fade-in shadow-xs">
          <span className="material-symbols-outlined text-base">check_circle</span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* 1. EMERGENCY ALERTS */}
      <Card className="p-5 border border-outline-variant/60 space-y-4 shadow-sm">
        <div className="flex items-center gap-2 border-b border-outline-variant/60 pb-3">
          <div className="w-8 h-8 rounded-lg bg-secondary/15 border border-secondary/30 flex items-center justify-center text-secondary">
            <span className="material-symbols-outlined text-lg">crisis_alert</span>
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-primary uppercase tracking-wider leading-none">
              Emergency Alerts
            </h2>
            <p className="text-[11px] text-on-surface-variant mt-0.5">Audible dispatch and immediate alert preferences</p>
          </div>
        </div>

        <div className="space-y-2.5 text-xs">
          {/* Emergency Alert Sound */}
          <label className="flex items-center justify-between p-3 rounded-xl bg-surface-container border border-outline-variant cursor-pointer transition-colors hover:bg-surface-container-high">
            <div className="space-y-0.5">
              <span className="font-bold text-primary block">Emergency Alert Sound</span>
              <span className="text-[11px] text-on-surface-variant block">
                Play a sound when a new emergency is received.
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  playEmergencyAlertSound();
                }}
                title="Test Alert Sound"
                className="px-2 py-1 rounded bg-surface border border-outline-variant hover:bg-surface-container-lowest text-[10px] font-bold text-secondary flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-xs">volume_up</span>
                <span>Test</span>
              </button>
              <input
                type="checkbox"
                checked={localSettings.audioAlerts}
                onChange={() => handleToggle('audioAlerts')}
                className="w-4 h-4 rounded text-secondary focus:ring-secondary accent-secondary cursor-pointer"
              />
            </div>
          </label>

          {/* Critical Alert Notifications */}
          <label className="flex items-center justify-between p-3 rounded-xl bg-surface-container border border-outline-variant cursor-pointer transition-colors hover:bg-surface-container-high">
            <div className="space-y-0.5">
              <span className="font-bold text-primary block">Critical Alert Notifications</span>
              <span className="text-[11px] text-on-surface-variant block">
                Highlight critical emergencies immediately.
              </span>
            </div>
            <input
              type="checkbox"
              checked={localSettings.criticalAlerts}
              onChange={() => handleToggle('criticalAlerts')}
              className="w-4 h-4 rounded text-secondary focus:ring-secondary accent-secondary cursor-pointer shrink-0"
            />
          </label>

          {/* Vibration Alerts */}
          <label className="flex items-center justify-between p-3 rounded-xl bg-surface-container border border-outline-variant cursor-pointer transition-colors hover:bg-surface-container-high">
            <div className="space-y-0.5">
              <span className="font-bold text-primary block">Vibration Alerts</span>
              <span className="text-[11px] text-on-surface-variant block">
                Vibrate when an important emergency update arrives.
              </span>
            </div>
            <input
              type="checkbox"
              checked={localSettings.vibrationAlerts}
              onChange={() => handleToggle('vibrationAlerts')}
              className="w-4 h-4 rounded text-secondary focus:ring-secondary accent-secondary cursor-pointer shrink-0"
            />
          </label>
        </div>
      </Card>

      {/* 2. CONNECTION & OFFLINE SUPPORT */}
      <Card className="p-5 border border-outline-variant/60 space-y-4 shadow-sm">
        <div className="flex items-center gap-2 border-b border-outline-variant/60 pb-3">
          <div className="w-8 h-8 rounded-lg bg-secondary/15 border border-secondary/30 flex items-center justify-center text-secondary">
            <span className="material-symbols-outlined text-lg">wifi</span>
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-primary uppercase tracking-wider leading-none">
              Connection & Offline Support
            </h2>
            <p className="text-[11px] text-on-surface-variant mt-0.5">Network connectivity and background synchronization</p>
          </div>
        </div>

        <div className="space-y-2.5 text-xs">
          {/* Real Connection Status Indicator */}
          <div className="p-3 rounded-xl bg-surface-container border border-outline-variant flex items-center justify-between">
            <div>
              <span className="font-bold text-primary block">Connection</span>
              <span className="text-[11px] text-on-surface-variant block">
                Real-time operational network state
              </span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface border border-outline-variant font-mono text-xs font-bold">
              <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span className={isOnline ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}>
                {isOnline ? 'Connected' : 'Offline'}
              </span>
            </div>
          </div>

          {/* Offline Emergency Relay */}
          <label className="flex items-center justify-between p-3 rounded-xl bg-surface-container border border-outline-variant cursor-pointer transition-colors hover:bg-surface-container-high">
            <div className="space-y-0.5 pr-3">
              <span className="font-bold text-primary block">Offline Emergency Relay</span>
              <span className="text-[11px] text-on-surface-variant block">
                Store emergency data when connection is unavailable and sync when connection returns.
              </span>
            </div>
            <input
              type="checkbox"
              checked={localSettings.offlineRelay}
              onChange={() => handleToggle('offlineRelay')}
              className="w-4 h-4 rounded text-secondary focus:ring-secondary accent-secondary cursor-pointer shrink-0"
            />
          </label>
        </div>
      </Card>

      {/* 3. DISPLAY */}
      <Card className="p-5 border border-outline-variant/60 space-y-4 shadow-sm">
        <div className="flex items-center gap-2 border-b border-outline-variant/60 pb-3">
          <div className="w-8 h-8 rounded-lg bg-secondary/15 border border-secondary/30 flex items-center justify-center text-secondary">
            <span className="material-symbols-outlined text-lg">palette</span>
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-primary uppercase tracking-wider leading-none">
              Display
            </h2>
            <p className="text-[11px] text-on-surface-variant mt-0.5">Interface theme, font size, and contrast mode</p>
          </div>
        </div>

        <div className="space-y-3.5 text-xs">
          {/* Interface Theme */}
          <div className="space-y-1.5">
            <label className="font-bold text-primary block">Interface Theme</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'light', label: 'Light', icon: 'light_mode' },
                { id: 'dark', label: 'Dark', icon: 'dark_mode' },
                { id: 'system', label: 'System', icon: 'desktop_windows' },
              ].map((th) => {
                const isSelected = localSettings.theme === th.id;
                return (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => handleSelect('theme', th.id)}
                    className={getOptionButtonClass(isSelected)}
                  >
                    <span className={`material-symbols-outlined text-sm ${isSelected ? 'text-white !text-white' : 'text-on-surface-variant'}`}>
                      {th.icon}
                    </span>
                    <span className={isSelected ? 'text-white !text-white font-black' : 'text-primary'}>
                      {th.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Text Size */}
          <div className="space-y-1.5">
            <label className="font-bold text-primary block">Text Size</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'normal', label: 'Normal' },
                { id: 'large', label: 'Large' },
              ].map((fs) => {
                const isSelected = localSettings.fontSize === fs.id;
                return (
                  <button
                    key={fs.id}
                    type="button"
                    onClick={() => handleSelect('fontSize', fs.id)}
                    className={getOptionButtonClass(isSelected)}
                  >
                    <span className={isSelected ? 'text-white !text-white font-black' : 'text-primary'}>
                      {fs.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* High Contrast */}
          <div className="space-y-1.5">
            <label className="font-bold text-primary block">High Contrast</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { val: false, label: 'OFF' },
                { val: true, label: 'ON' },
              ].map((hc) => {
                const isSelected = localSettings.highContrast === hc.val;
                return (
                  <button
                    key={String(hc.val)}
                    type="button"
                    onClick={() => handleSelect('highContrast', hc.val)}
                    className={getOptionButtonClass(isSelected)}
                  >
                    <span className={isSelected ? 'text-white !text-white font-black' : 'text-primary'}>
                      {hc.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      {/* 4. LANGUAGE PREFERENCES */}
      <Card className="p-5 border border-outline-variant/60 space-y-4 shadow-sm">
        <div className="flex items-center gap-2 border-b border-outline-variant/60 pb-3">
          <div className="w-8 h-8 rounded-lg bg-secondary/15 border border-secondary/30 flex items-center justify-center text-secondary">
            <span className="material-symbols-outlined text-lg">language</span>
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-primary uppercase tracking-wider leading-none">
              Language Preferences
            </h2>
            <p className="text-[11px] text-on-surface-variant mt-0.5">
              Select interface language with authentic regional translations
            </p>
          </div>
        </div>

        <div className="space-y-4 text-xs">
          {/* Prioritized Regional Languages */}
          <div>
            <span className="text-[11px] font-bold text-secondary uppercase tracking-wider block mb-2">
              Primary Regional Languages
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {supportedLanguages
                .filter((l) => l.isPriority)
                .map((lang) => {
                  const isSelected = currentLanguage === lang.code;
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => {
                        selectLanguage(lang.code);
                        showToast(`Language set to ${lang.name} (${lang.nativeName})`);
                      }}
                      className={getOptionButtonClass(isSelected)}
                    >
                      <span className="text-base">{lang.flag}</span>
                      <span className="font-extrabold text-sm">{lang.nativeName}</span>
                      <span className="text-[10px] opacity-80">({lang.name})</span>
                    </button>
                  );
                })}
            </div>
          </div>

          {/* Other Supported Indian Regional Languages */}
          <div className="pt-2 border-t border-outline-variant/40">
            <span className="text-[11px] font-bold text-on-surface-variant uppercase tracking-wider block mb-2">
              Other Supported Languages
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
              {supportedLanguages
                .filter((l) => !l.isPriority)
                .map((lang) => {
                  const isSelected = currentLanguage === lang.code;
                  return (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => {
                        selectLanguage(lang.code);
                        showToast(`Language set to ${lang.name} (${lang.nativeName})`);
                      }}
                      className={getOptionButtonClass(isSelected)}
                    >
                      <span className="font-extrabold">{lang.nativeName}</span>
                      <span className="text-[10px] opacity-80">({lang.name})</span>
                    </button>
                  );
                })}
            </div>
          </div>
        </div>
      </Card>

      {/* 5. NOTIFICATIONS */}
      <Card className="p-5 border border-outline-variant/60 space-y-4 shadow-sm">
        <div className="flex items-center gap-2 border-b border-outline-variant/60 pb-3">
          <div className="w-8 h-8 rounded-lg bg-secondary/15 border border-secondary/30 flex items-center justify-center text-secondary">
            <span className="material-symbols-outlined text-lg">notifications</span>
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-primary uppercase tracking-wider leading-none">
              Notifications
            </h2>
            <p className="text-[11px] text-on-surface-variant mt-0.5">Control which event notifications appear on the dashboard</p>
          </div>
        </div>

        <div className="space-y-2.5 text-xs">
          {/* New Emergency Alerts */}
          <label className="flex items-center justify-between p-3 rounded-xl bg-surface-container border border-outline-variant cursor-pointer transition-colors hover:bg-surface-container-high">
            <span className="font-bold text-primary">New Emergency Alerts</span>
            <input
              type="checkbox"
              checked={localSettings.newEmergencyAlerts}
              onChange={() => handleToggle('newEmergencyAlerts')}
              className="w-4 h-4 rounded text-secondary focus:ring-secondary accent-secondary cursor-pointer shrink-0"
            />
          </label>

          {/* Emergency Status Updates */}
          <label className="flex items-center justify-between p-3 rounded-xl bg-surface-container border border-outline-variant cursor-pointer transition-colors hover:bg-surface-container-high">
            <span className="font-bold text-primary">Emergency Status Updates</span>
            <input
              type="checkbox"
              checked={localSettings.statusUpdates}
              onChange={() => handleToggle('statusUpdates')}
              className="w-4 h-4 rounded text-secondary focus:ring-secondary accent-secondary cursor-pointer shrink-0"
            />
          </label>

          {/* Rescue Completion Alerts */}
          <label className="flex items-center justify-between p-3 rounded-xl bg-surface-container border border-outline-variant cursor-pointer transition-colors hover:bg-surface-container-high">
            <span className="font-bold text-primary">Rescue Completion Alerts</span>
            <input
              type="checkbox"
              checked={localSettings.rescueCompletionAlerts}
              onChange={() => handleToggle('rescueCompletionAlerts')}
              className="w-4 h-4 rounded text-secondary focus:ring-secondary accent-secondary cursor-pointer shrink-0"
            />
          </label>
        </div>
      </Card>

      {/* Actions: Save Settings & Reset to Default */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <Button
          variant="primary"
          size="md"
          icon="save"
          onClick={handleSave}
          loading={isSaving}
          className="font-extrabold px-6 shadow-md"
        >
          {t('btn_save_changes', 'Save Settings')}
        </Button>

        <button
          type="button"
          onClick={() => setShowResetModal(true)}
          className="text-xs font-bold text-on-surface-variant hover:text-error transition-colors cursor-pointer flex items-center gap-1 px-3 py-2 rounded-lg hover:bg-surface-container"
        >
          <span className="material-symbols-outlined text-sm">restart_alt</span>
          <span>Reset to Default</span>
        </button>
      </div>

      {/* Confirmation Dialog Modal for Reset */}
      {showResetModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in text-left">
          <Card className="bg-surface border border-outline-variant max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 border-b border-outline-variant/60 pb-3">
              <div className="w-10 h-10 rounded-xl bg-error/15 border border-error/30 flex items-center justify-center text-error shrink-0">
                <span className="material-symbols-outlined text-2xl">restart_alt</span>
              </div>
              <div>
                <h3 className="text-base font-extrabold text-primary leading-tight">Reset Settings?</h3>
                <p className="text-[11px] text-on-surface-variant">Restore application defaults</p>
              </div>
            </div>

            <p className="text-xs text-primary font-medium leading-relaxed">
              Reset all responder settings to their default values?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowResetModal(false)}
                className="text-xs"
              >
                Cancel
              </Button>

              <Button
                variant="urgent"
                size="sm"
                onClick={handleConfirmReset}
                className="text-xs font-bold px-4"
              >
                Reset
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
