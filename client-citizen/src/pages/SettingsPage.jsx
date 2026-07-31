import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import StatusChip from '../components/ui/StatusChip';
import BrandHeader from '../components/ui/BrandHeader';
import { useLanguage } from '../contexts/LanguageContext';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { activeLanguageObj, supportedLanguages, selectLanguage } = useLanguage();
  const [offlineMesh, setOfflineMesh] = useState(true);
  const [voiceActivation, setVoiceActivation] = useState(true);
  const [lowPowerMode, setLowPowerMode] = useState(false);

  return (
    <div className="space-y-6 max-w-4xl mx-auto animate-fade-in">
      {/* Prominent Header */}
      <BrandHeader description="System Preferences & Station Configuration" />

      {/* AI Engine Status */}
      <Card variant="ai" className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-headline-md font-bold text-primary">Gemma 4 Engine Settings</h3>
            <p className="text-sm text-on-surface-variant">Local AI inference and offline reasoning model options.</p>
          </div>
          <StatusChip label="Gemma 4 v4.0.2" variant="active" dot />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-t border-outline-variant/60 pt-4">
          <div>
            <span className="text-label-sm uppercase text-on-surface-variant">Model Version</span>
            <p className="text-mono-data font-bold text-primary">Gemma 4 9B (Quantized)</p>
          </div>
          <div>
            <span className="text-label-sm uppercase text-on-surface-variant">Inference Mode</span>
            <p className="text-mono-data font-bold text-primary">Local NPU / CPU</p>
          </div>
          <div>
            <span className="text-label-sm uppercase text-on-surface-variant">Explanation Access</span>
            <p className="text-mono-data font-bold text-secondary">Responders Only</p>
          </div>
        </div>
      </Card>

      {/* Configuration Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="p-6 space-y-4">
          <h3 className="text-body-lg font-bold text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">tune</span>
            Station Preferences
          </h3>
          
          {/* Language Preference Selector */}
          <div>
            <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
              Operational Language
            </label>
            <div className="flex items-center gap-3">
              <select
                value={activeLanguageObj.code}
                onChange={(e) => selectLanguage(e.target.value)}
                className="w-full bg-surface-container border border-outline-variant rounded-lg p-2.5 text-sm font-semibold text-primary focus:outline-none focus:border-secondary cursor-pointer"
              >
                {supportedLanguages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.nativeName} ({lang.name})
                  </option>
                ))}
              </select>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/language-selection?force=true')}
                className="shrink-0"
              >
                Onboarding Screen
              </Button>
            </div>
          </div>

          <Input label="Station Call Sign" defaultValue="COMMAND-CENTER-ALPHA" icon="badge" />
          <Input label="Primary Sector" defaultValue="Sector 7" icon="location_on" />
          <Input label="Telemetry Sync Interval (sec)" defaultValue="5" type="number" icon="timer" />
        </Card>

        <Card className="p-6 space-y-4">
          <h3 className="text-body-lg font-bold text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary">cell_tower</span>
            Network & Voice Controls
          </h3>

          <div className="flex items-center justify-between py-2 border-b border-outline-variant/50">
            <div>
              <p className="text-sm font-semibold text-primary">Offline Mesh Network</p>
              <p className="text-xs text-on-surface-variant">Peer-to-peer node communications</p>
            </div>
            <button
              onClick={() => setOfflineMesh(!offlineMesh)}
              className={`w-12 h-6 rounded-full transition-colors p-1 cursor-pointer ${
                offlineMesh ? 'bg-secondary' : 'bg-outline-variant'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  offlineMesh ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between py-2 border-b border-outline-variant/50">
            <div>
              <p className="text-sm font-semibold text-primary">Voice-First Activation</p>
              <p className="text-xs text-on-surface-variant">Always-on voice command relay</p>
            </div>
            <button
              onClick={() => setVoiceActivation(!voiceActivation)}
              className={`w-12 h-6 rounded-full transition-colors p-1 cursor-pointer ${
                voiceActivation ? 'bg-secondary' : 'bg-outline-variant'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  voiceActivation ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-semibold text-primary">Low-Power Emergency Mode</p>
              <p className="text-xs text-on-surface-variant">Optimize battery for high-glare field shifts</p>
            </div>
            <button
              onClick={() => setLowPowerMode(!lowPowerMode)}
              className={`w-12 h-6 rounded-full transition-colors p-1 cursor-pointer ${
                lowPowerMode ? 'bg-secondary' : 'bg-outline-variant'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-transform ${
                  lowPowerMode ? 'translate-x-6' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </Card>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <Button variant="secondary">Reset Defaults</Button>
        <Button variant="primary">Save Configuration</Button>
      </div>
    </div>
  );
}
