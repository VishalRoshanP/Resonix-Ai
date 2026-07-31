import { useState } from 'react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    stationCallsign: 'COMMAND-CENTER-ALPHA',
    primarySector: 'Sector 4',
    syncIntervalSec: '5',
    audioAlerts: true,
    hapticFeedback: true,
    highContrastMode: false,
    offlineMeshEnabled: true,
    gemmaModel: 'google/gemma-4-e4b-it',
    autoTriage: true,
    language: 'English',
  });

  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 2500);
  };

  const handleToggle = (key) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
    showToast('Preference updated.');
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings((prev) => ({ ...prev, [name]: value }));
    showToast('Preference updated.');
  };

  return (
    <div className="space-y-6 text-left animate-fade-in max-w-5xl mx-auto pb-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/60 pb-4">
        <div>
          <h1 className="text-2xl font-black text-primary tracking-tight">Command Center Settings</h1>
          <p className="text-xs text-on-surface-variant mt-0.5">
            Operational preferences, Gemma 4 AI reasoning parameters & network telemetry
          </p>
        </div>
        <span className="text-xs font-mono font-bold text-secondary bg-secondary/10 px-3 py-1 rounded-full border border-secondary/30">
          Responder v2.4.0
        </span>
      </div>

      {toastMsg && (
        <div className="p-3 rounded-xl bg-success/15 border border-success/30 text-success font-bold text-xs flex items-center gap-2 animate-fade-in shadow-xs">
          <span className="material-symbols-outlined text-base">check_circle</span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Grid of Settings Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 1. Gemma 4 AI Intelligence Settings */}
        <Card className="p-5 border border-outline-variant/60 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 border-b border-outline-variant/60 pb-3">
            <div className="w-8 h-8 rounded-lg bg-secondary/15 border border-secondary/30 flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-lg">psychology</span>
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-primary uppercase tracking-wider leading-none">
                Gemma 4 AI Engine Configuration
              </h2>
              <span className="text-[10px] text-on-surface-variant font-mono">Model: gemma4:e4b (Local Ollama)</span>
            </div>
          </div>

          <div className="space-y-1.5 text-xs">
            <label className="font-bold text-primary block">Primary AI Model Target</label>
            <select
              name="gemmaModel"
              value={settings.gemmaModel}
              onChange={handleChange}
              className="w-full px-3 py-2 rounded-xl bg-surface-container border border-outline-variant text-xs font-medium text-primary focus:outline-none focus:border-secondary cursor-pointer"
            >
              <option value="google/gemma-4-e4b-it">Gemma 4 E4B (Quantized - Fast Field Inference)</option>
              <option value="google/gemma-4-9b-it">Gemma 4 9B (High Detail Reasoning)</option>
            </select>
          </div>

          <label className="flex items-center justify-between p-3 rounded-xl bg-surface-container border border-outline-variant cursor-pointer text-xs">
            <div>
              <span className="font-bold text-primary block">Automatic AI Triage & Priority</span>
              <span className="text-[10px] text-on-surface-variant">Classify emergency reports immediately upon STT completion</span>
            </div>
            <input
              type="checkbox"
              checked={settings.autoTriage}
              onChange={() => handleToggle('autoTriage')}
              className="w-4 h-4 rounded text-secondary focus:ring-secondary accent-secondary cursor-pointer"
            />
          </label>
        </Card>

        {/* 2. Station Operational Parameters */}
        <Card className="p-5 border border-outline-variant/60 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 border-b border-outline-variant/60 pb-3">
            <div className="w-8 h-8 rounded-lg bg-secondary/15 border border-secondary/30 flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-lg">tune</span>
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-primary uppercase tracking-wider leading-none">
                Station Parameters
              </h2>
              <span className="text-[10px] text-on-surface-variant font-mono">Field Station Call Sign & Sector</span>
            </div>
          </div>

          <div className="space-y-3 text-xs">
            <div className="space-y-1">
              <label className="font-bold text-primary block">Station Call Sign</label>
              <input
                type="text"
                name="stationCallsign"
                value={settings.stationCallsign}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-xl bg-surface-container border border-outline-variant font-mono font-bold text-primary focus:outline-none focus:border-secondary"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-primary block">Primary Sector Jurisdiction</label>
              <input
                type="text"
                name="primarySector"
                value={settings.primarySector}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-xl bg-surface-container border border-outline-variant font-bold text-primary focus:outline-none focus:border-secondary"
              />
            </div>
          </div>
        </Card>

        {/* 3. Audio & Emergency Alerts */}
        <Card className="p-5 border border-outline-variant/60 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 border-b border-outline-variant/60 pb-3">
            <div className="w-8 h-8 rounded-lg bg-secondary/15 border border-secondary/30 flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-lg">volume_up</span>
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-primary uppercase tracking-wider leading-none">
                Alert Tones & Dispatch Audio
              </h2>
              <span className="text-[10px] text-on-surface-variant font-mono">Real-time alert notifications</span>
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            <label className="flex items-center justify-between p-3 rounded-xl bg-surface-container border border-outline-variant cursor-pointer">
              <div>
                <span className="font-bold text-primary block">Critical Dispatch Alarm Tones</span>
                <span className="text-[10px] text-on-surface-variant">Audible alert on HIGH / CRITICAL SOS packet receipt</span>
              </div>
              <input
                type="checkbox"
                checked={settings.audioAlerts}
                onChange={() => handleToggle('audioAlerts')}
                className="w-4 h-4 rounded text-secondary focus:ring-secondary accent-secondary cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-3 rounded-xl bg-surface-container border border-outline-variant cursor-pointer">
              <div>
                <span className="font-bold text-primary block">Haptic Dispatch Pulses</span>
                <span className="text-[10px] text-on-surface-variant">Vibrate mobile & field tablet on status update</span>
              </div>
              <input
                type="checkbox"
                checked={settings.hapticFeedback}
                onChange={() => handleToggle('hapticFeedback')}
                className="w-4 h-4 rounded text-secondary focus:ring-secondary accent-secondary cursor-pointer"
              />
            </label>
          </div>
        </Card>

        {/* 4. Network Telemetry & Offline Mesh */}
        <Card className="p-5 border border-outline-variant/60 space-y-4 shadow-xs">
          <div className="flex items-center gap-2 border-b border-outline-variant/60 pb-3">
            <div className="w-8 h-8 rounded-lg bg-secondary/15 border border-secondary/30 flex items-center justify-center text-secondary">
              <span className="material-symbols-outlined text-lg">hub</span>
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-primary uppercase tracking-wider leading-none">
                Network & Offline Mesh Sync
              </h2>
              <span className="text-[10px] text-on-surface-variant font-mono">BLE / Wi-Fi Direct Peer Relay</span>
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            <label className="flex items-center justify-between p-3 rounded-xl bg-surface-container border border-outline-variant cursor-pointer">
              <div>
                <span className="font-bold text-primary block">Offline Mesh Node Relay</span>
                <span className="text-[10px] text-on-surface-variant">Accept & relay multi-hop packet telemetry from citizen nodes</span>
              </div>
              <input
                type="checkbox"
                checked={settings.offlineMeshEnabled}
                onChange={() => handleToggle('offlineMeshEnabled')}
                className="w-4 h-4 rounded text-secondary focus:ring-secondary accent-secondary cursor-pointer"
              />
            </label>

            <div className="space-y-1">
              <label className="font-bold text-primary block">Telemetry Sync Interval (seconds)</label>
              <select
                name="syncIntervalSec"
                value={settings.syncIntervalSec}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-xl bg-surface-container border border-outline-variant font-mono font-bold text-primary focus:outline-none focus:border-secondary cursor-pointer"
              >
                <option value="3">3 Seconds (High Frequency Field Radar)</option>
                <option value="5">5 Seconds (Standard Command Center)</option>
                <option value="10">10 Seconds (Low Power Mesh Mode)</option>
              </select>
            </div>
          </div>
        </Card>
      </div>

      {/* Footer System Meta */}
      <Card className="p-4 border border-outline-variant/60 text-center text-xs text-on-surface-variant space-y-1">
        <p className="font-bold text-primary">RESONIX AI Responder Command Center</p>
        <p className="text-[10px] font-mono">Port 5174 • Node ID: cmd_alpha_01 • Build: 2026.07.31-prod</p>
      </Card>
    </div>
  );
}
