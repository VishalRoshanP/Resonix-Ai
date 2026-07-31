import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import LocationDetectorWidget from '../components/location/LocationDetectorWidget';
import NetworkStatusWidget from '../components/network/NetworkStatusWidget';
import EmergencyReportModal from '../components/emergency/EmergencyReportModal';

export default function CitizenHomePage() {
  const navigate = useNavigate();
  const { activeLanguageObj } = useLanguage();
  const [showReportModal, setShowReportModal] = useState(false);

  return (
    <div className="max-w-md mx-auto min-h-[calc(100vh-5rem)] flex flex-col justify-between p-3 sm:p-4 text-center animate-fade-in space-y-4">
      {/* 1. Top Bar: Language, Status & Settings */}
      <div className="flex items-center justify-between gap-2 p-2.5 bg-surface-container-low/90 border border-outline-variant/60 rounded-xl shadow-xs">
        {/* Language Selector Button */}
        <button
          onClick={() => navigate('/language-selection?force=true')}
          className="flex items-center gap-1.5 font-bold text-xs text-primary hover:text-secondary transition-colors cursor-pointer px-2.5 py-2 rounded-lg bg-surface-container-lowest border border-outline-variant/60 shadow-xs min-h-[40px]"
          title="Change Language"
          aria-label="Change Language"
        >
          <span className="text-base">{activeLanguageObj?.flag || '🌐'}</span>
          <span>{activeLanguageObj?.nativeName || 'English'}</span>
        </button>

        {/* Status Badges */}
        <div className="flex items-center gap-1.5">
          <NetworkStatusWidget compact />
          <LocationDetectorWidget compact />
        </div>

        {/* System Settings Button */}
        <button
          onClick={() => navigate('/settings')}
          className="p-2 rounded-lg bg-surface-container-lowest border border-outline-variant/60 text-on-surface-variant hover:text-primary transition-colors cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center"
          title="System Settings"
          aria-label="Settings"
        >
          <span className="material-symbols-outlined text-lg">settings</span>
        </button>
      </div>

      {/* 2. Brand Header (Clean & Accessible) */}
      <div className="space-y-1 py-1">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-primary tracking-tight">
          RESONIX AI
        </h1>
        <p className="text-xs font-semibold text-secondary flex items-center justify-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
          Offline Emergency Assistant
        </p>
      </div>

      {/* 3. Primary Single Action: Emergency SOS Button */}
      <div className="space-y-4 my-auto">
        <button
          onClick={() => setShowReportModal(true)}
          className="w-full bg-error text-on-error font-black py-5 px-6 rounded-2xl shadow-xl hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-3 text-2xl sm:text-3xl border-b-4 border-error-container cursor-pointer min-h-[64px]"
          aria-label="Activate Emergency SOS Broadcast"
        >
          <span className="text-3xl animate-bounce">🚨</span>
          <span className="tracking-wide">EMERGENCY SOS</span>
        </button>

        <p className="text-xs font-bold text-on-surface-variant">
          Press SOS to Open Complete Emergency Report
        </p>
      </div>

      {/* 4. Live Status Badges (Location & Network) */}
      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-outline-variant/40">
        <NetworkStatusWidget />
        <LocationDetectorWidget />
      </div>

      {/* Complete Emergency Report Modal */}
      <EmergencyReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
      />
    </div>
  );
}
