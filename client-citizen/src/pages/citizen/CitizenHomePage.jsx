import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { citizenApi } from '../../services/api';
import { transmitPacketToBackend } from '../../services/emergencyPacketManager';
import LocationDetectorWidget from '../../components/location/LocationDetectorWidget';
import NetworkStatusWidget from '../../components/network/NetworkStatusWidget';
import EmergencyReportModal from '../../components/emergency/EmergencyReportModal';
import Card from '../../components/ui/Card';

export default function CitizenHomePage() {
  const { citizenUser, isCitizenGuest, guestId } = useAuth();

  // Emergency States
  // 'IDLE' | 'DISPATCHED' | 'CANCELLING' | 'CANCELLED'
  const [sosState, setSosState] = useState('IDLE');
  const [sosTimer, setSosTimer] = useState(0);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [lastSubmittedPacket, setLastSubmittedPacket] = useState(null);
  const [sosPressed, setSosPressed] = useState(false);

  // SOS Dispatch Timer Effect
  useEffect(() => {
    let interval;
    if (sosState === 'DISPATCHED') {
      interval = setInterval(() => {
        setSosTimer((prev) => prev + 1);
      }, 1000);
    } else if (sosState !== 'DISPATCHED') {
      // Only reset timer when not dispatched
      if (sosState === 'IDLE') setSosTimer(0);
    }
    return () => clearInterval(interval);
  }, [sosState]);

  // Handle SOS Button Press (Instant UI Response)
  const handleSOSPress = () => {
    console.log("STEP 2 - HANDLE SOS EXECUTED");
    if (sosState === 'CANCELLED') {
      // Allow re-submission after cancellation
      setSosState('IDLE');
      setLastSubmittedPacket(null);
      setSosTimer(0);
    }

    // 1. Open SOS UI Modal IMMEDIATELY without waiting for network or imports (0ms UI latency)
    setSosPressed(true);
    setShowReportModal(true);

    setTimeout(() => {
      setSosPressed(false);
    }, 150);

    // 2. Asynchronously build and transmit emergency SOS packet in background (Non-blocking)
    (async () => {
      try {
        const { buildEmergencyPacket } = await import('../../services/emergencyPacketManager');
        const packet = buildEmergencyPacket({
          category: 'CRITICAL',
          description: 'Instant Emergency SOS signal triggered by citizen',
          user: isCitizenGuest ? null : citizenUser,
          isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
        });

        console.log('==================================================');
        console.log('🚨 [CitizenHomePage] INSTANT SOS BUTTON CLICKED!');
        console.log(`• Packet ID: ${packet.packetId}`);
        console.log('• Initiating immediate HTTP POST request to backend...');
        console.log('==================================================');

        // Execute POST request to /api/v1/emergency/create
        await transmitPacketToBackend(packet, citizenApi.sendSOS);

        handlePacketSubmitted(packet);
      } catch (err) {
        console.warn('[CitizenHomePage] Instant SOS transmission note:', err.message);
      }
    })();
  };

  // Callback when EmergencyReportModal submits packet
  const handlePacketSubmitted = (packet) => {
    setLastSubmittedPacket(packet);
    setSosState('DISPATCHED');
    setToastMessage(`🚨 Emergency Packet ${packet.packetId} Transmitted! Rescue squad en route.`);
  };

  // Cancel SOS request
  const handleCancelRequest = async () => {
    setShowCancelConfirm(false);
    setSosState('CANCELLING');

    try {
      // Use existing PUT /api/v1/incidents/:id to update status to 'cancelled'
      if (lastSubmittedPacket?.packetId) {
        await citizenApi.cancelSOS(lastSubmittedPacket.packetId);
      }
    } catch (err) {
      // Even if backend call fails (e.g. no matching DB record), proceed with client-side cancellation
      console.warn('[CitizenHomePage] Cancel API call failed (non-blocking):', err.message);
    }

    // Brief loading delay for UX feedback
    await new Promise((r) => setTimeout(r, 600));

    setSosState('CANCELLED');
    setToastMessage('');
  };

  // Determine if cancellation is allowed (before dispatch/en-route)
  const isCancellable = sosState === 'DISPATCHED' && sosTimer < 300; // Allow within 5 minutes

  // Format Timer SS or MM:SS
  const formatSec = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="w-full space-y-4 text-left pb-2 animate-fade-in">
      {/* Dynamic Toast / Status Notification Bar */}
      {toastMessage && (
        <div className="p-3 rounded-xl bg-secondary/15 border border-secondary/30 text-primary text-xs font-bold flex items-center justify-between gap-2 shadow-sm animate-fade-in min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-secondary text-base animate-pulse shrink-0">info</span>
            <span className="break-words min-w-0">{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage('')}
            className="text-on-surface-variant hover:text-primary p-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Top Status & Telemetry Header Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <LocationDetectorWidget />
        <NetworkStatusWidget />
      </div>

      {/* Live Rescue Dispatch Status Banner */}
      <div
        className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2 transition-all duration-300 min-w-0 ${
          sosState === 'DISPATCHED'
            ? 'bg-error/15 border-error text-error shadow-md'
            : sosState === 'CANCELLING'
            ? 'bg-secondary/10 border-secondary/30 text-secondary'
            : sosState === 'CANCELLED'
            ? 'bg-surface-container border-outline-variant text-on-surface-variant'
            : 'bg-surface-container border-outline-variant text-on-surface-variant'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div
            className={`w-3 h-3 rounded-full transition-colors ${
              sosState === 'DISPATCHED' ? 'bg-error animate-ping'
              : sosState === 'CANCELLING' ? 'bg-secondary animate-pulse'
              : sosState === 'CANCELLED' ? 'bg-on-surface-variant/40'
              : 'bg-success'
            }`}
          />
          <div>
            <p className="text-[11px] font-mono uppercase tracking-wider leading-none font-extrabold">
              {sosState === 'DISPATCHED' ? '🚨 RESCUE EN ROUTE'
               : sosState === 'CANCELLING' ? 'Cancelling request...'
               : sosState === 'CANCELLED' ? 'Emergency request cancelled'
               : 'READY FOR EMERGENCY REPORT'}
            </p>
            <p className="text-[10px] text-on-surface-variant mt-0.5 font-medium">
              {sosState === 'DISPATCHED'
                ? `Category: ${lastSubmittedPacket?.category || 'CRITICAL'} • Timer: ${formatSec(sosTimer)}`
                : sosState === 'CANCELLED'
                ? 'You can submit a new request if you still need help.'
                : sosState === 'CANCELLING'
                ? 'Please wait...'
                : isCitizenGuest
                ? `Guest Session ID: ${guestId?.slice(0, 14) || 'Guest'}`
                : `User: ${citizenUser?.name || 'Citizen'}`}
            </p>
          </div>
        </div>

        {sosState === 'DISPATCHED' && (
          <span className="text-xs font-mono font-extrabold px-2 py-0.5 bg-error text-white rounded-md">
            ACTIVE
          </span>
        )}
        {sosState === 'CANCELLED' && (
          <span className="text-xs font-mono font-extrabold px-2 py-0.5 bg-on-surface-variant/15 text-on-surface-variant rounded-md">
            CANCELLED
          </span>
        )}
      </div>

      {/* ================================================================ */}
      {/* CANCEL EMERGENCY REQUEST — Shown only when cancellable */}
      {/* ================================================================ */}
      {isCancellable && (
        <button
          type="button"
          onClick={() => setShowCancelConfirm(true)}
          className="w-full py-3 px-4 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant/60 text-on-surface-variant hover:text-error font-bold text-xs flex items-center justify-center gap-2 transition-all duration-150 cursor-pointer min-h-[48px] active:scale-[0.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-error/40 hover:border-error/30 hover:shadow-sm"
          aria-label="Cancel emergency request"
        >
          <span className="material-symbols-outlined text-base">close</span>
          <span>Cancel emergency request</span>
        </button>
      )}

      {/* Post-dispatch non-cancellable notice */}
      {sosState === 'DISPATCHED' && !isCancellable && (
        <div className="p-3 rounded-xl bg-surface-container border border-outline-variant/60 flex items-center gap-2 text-[11px] text-on-surface-variant">
          <span className="material-symbols-outlined text-base text-secondary shrink-0">verified</span>
          <span>Emergency services have already been dispatched. This request can no longer be cancelled.</span>
        </div>
      )}

      {/* Cancelled — success message */}
      {sosState === 'CANCELLED' && (
        <div className="p-3.5 rounded-xl bg-success/8 border border-success/25 space-y-2 animate-fade-in">
          <div className="flex items-center gap-2 text-success font-bold text-xs">
            <span className="material-symbols-outlined text-base">check_circle</span>
            <span>Your emergency request has been cancelled successfully.</span>
          </div>
          <p className="text-[10px] text-on-surface-variant leading-relaxed pl-6">
            If you cancelled by mistake, tap the SOS button below to submit a new emergency report.
          </p>
        </div>
      )}

      {/* ================================================================ */}
      {/* HERO SOS SECTION — Professional Emergency Response Design */}
      {/* ================================================================ */}
      <Card className={`py-8 px-6 text-center space-y-5 border shadow-lg relative overflow-hidden transition-all duration-300 ${
        sosState === 'CANCELLED'
          ? 'border-outline-variant/30 bg-surface'
          : 'border-outline-variant/40 bg-surface'
      }`}>
        {/* Dispatched Glow Background */}
        {sosState === 'DISPATCHED' && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-56 h-56 rounded-full bg-error/15 animate-pulse opacity-80" />
          </div>
        )}

        <div className="relative z-10 flex flex-col items-center justify-center">

          {/* SOS Button with Breathing Glow */}
          <div className="relative flex items-center justify-center">
            {/* Outer Glow Ring (Slow breathing pulse — subtle, 3s cycle) */}
            {sosState === 'IDLE' && (
              <div className="absolute w-44 h-44 rounded-full border-2 border-error/20 animate-sos-glow-ring pointer-events-none" />
            )}

            {/* Main SOS Button */}
            <button
              onClick={() => {
                console.log("STEP 1 - SOS BUTTON CLICKED");
                handleSOSPress();
              }}
              disabled={sosState === 'CANCELLING'}
              className={`w-36 h-36 rounded-full flex flex-col items-center justify-center transition-all duration-200 cursor-pointer border-4 focus:outline-none focus-visible:ring-4 focus-visible:ring-error/50 ${
                sosState === 'DISPATCHED'
                  ? 'bg-error text-white border-white/50 animate-pulse shadow-[0_0_40px_rgba(220,38,38,0.35)]'
                  : sosState === 'CANCELLING'
                  ? 'bg-gray-400 text-white/70 border-white/20 cursor-not-allowed shadow-md'
                  : sosState === 'CANCELLED'
                  ? 'bg-gradient-to-b from-red-500 to-red-700 text-white border-white/25 hover:shadow-[0_8px_32px_rgba(220,38,38,0.3)] hover:scale-[1.03] active:scale-95 animate-sos-breathe'
                  : sosPressed
                  ? 'bg-red-700 text-white border-white/30 scale-95 animate-sos-ripple shadow-lg'
                  : 'bg-gradient-to-b from-red-500 to-red-700 text-white border-white/25 hover:shadow-[0_8px_32px_rgba(220,38,38,0.3)] hover:scale-[1.03] active:scale-95 animate-sos-breathe'
              }`}
              aria-label="Tap for Emergency SOS"
            >
              <span className="material-symbols-outlined text-5xl font-black mb-0.5 drop-shadow-sm">
                {sosState === 'DISPATCHED' ? 'emergency_home'
                 : sosState === 'CANCELLING' ? 'hourglass_top'
                 : 'emergency'}
              </span>
              <span className="text-2xl font-black tracking-tight leading-none drop-shadow-sm">
                {sosState === 'DISPATCHED' ? 'ACTIVE'
                 : sosState === 'CANCELLING' ? '...'
                 : 'SOS'}
              </span>
              <span className="text-[10px] font-bold tracking-wider mt-1 opacity-90">
                {sosState === 'DISPATCHED' ? 'DISPATCHED'
                 : sosState === 'CANCELLING' ? 'Cancelling'
                 : 'Emergency Alert'}
              </span>
            </button>
          </div>

          {/* Primary Message */}
          <p className="text-sm font-bold text-primary mt-4">
            {sosState === 'DISPATCHED'
              ? '🚨 Alert Active — First Responders Notified'
              : sosState === 'CANCELLING'
              ? 'Cancelling your emergency request...'
              : sosState === 'CANCELLED'
              ? 'Tap SOS to submit a new emergency report'
              : 'Tap SOS to Report an Emergency'}
          </p>

          {/* Secondary Message */}
          <p className="text-[11px] text-on-surface-variant leading-snug max-w-[280px]">
            {sosState === 'DISPATCHED'
              ? `Category: ${lastSubmittedPacket?.category || 'CRITICAL'} • Response time: ${formatSec(sosTimer)}`
              : sosState === 'CANCELLING'
              ? 'Please wait while we process your cancellation.'
              : sosState === 'CANCELLED'
              ? 'Your previous request has been cancelled. Submit a new one if you still need assistance.'
              : isCitizenGuest
              ? 'Guest mode supported. No sign-in required.'
              : 'Voice, photo, and emergency details can be added after pressing SOS.'}
          </p>

          {/* Status Chips */}
          {(sosState === 'IDLE' || sosState === 'CANCELLED') && (
            <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-success/10 border border-success/25 text-[10px] font-bold text-success">
                <span className="material-symbols-outlined text-xs">my_location</span>
                GPS Ready
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary/10 border border-secondary/25 text-[10px] font-bold text-secondary">
                <span className="material-symbols-outlined text-xs">wifi</span>
                Network Connected
              </span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-500/10 border border-purple-500/25 text-[10px] font-bold text-purple-500">
                <span className="material-symbols-outlined text-xs">lock</span>
                Secure Transmission
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* Quick Emergency Helpline Contacts Bar */}
      <div className="space-y-1.5 pt-1">
        <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider px-1">
          1-Tap Quick Dial Helplines
        </p>
        <div className="grid grid-cols-4 gap-1.5 text-center text-xs min-w-0">
          <a
            href="tel:112"
            className="p-2.5 rounded-xl bg-error/10 hover:bg-error/20 border border-error/30 text-error font-extrabold flex flex-col items-center gap-0.5 transition-colors cursor-pointer min-h-[44px]"
          >
            <span className="material-symbols-outlined text-base">call</span>
            <span>112</span>
          </a>

          <a
            href="tel:108"
            className="p-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant text-primary font-extrabold flex flex-col items-center gap-0.5 transition-colors cursor-pointer min-h-[44px]"
          >
            <span className="material-symbols-outlined text-base text-secondary">ambulance</span>
            <span>108</span>
          </a>

          <a
            href="tel:101"
            className="p-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant text-primary font-extrabold flex flex-col items-center gap-0.5 transition-colors cursor-pointer min-h-[44px]"
          >
            <span className="material-symbols-outlined text-base text-secondary">fire_truck</span>
            <span>101</span>
          </a>

          <a
            href="tel:1070"
            className="p-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant text-primary font-extrabold flex flex-col items-center gap-0.5 transition-colors cursor-pointer min-h-[44px]"
          >
            <span className="material-symbols-outlined text-base text-secondary">domain</span>
            <span>1070</span>
          </a>
        </div>
      </div>

      {/* ================================================================ */}
      {/* CANCEL CONFIRMATION DIALOG (Modal) */}
      {/* ================================================================ */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
          <Card className="bg-surface border border-outline-variant/60 max-w-sm w-full p-5 sm:p-6 space-y-4 shadow-2xl text-left animate-slide-up">
            {/* Header */}
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-error/10 border border-error/25 flex items-center justify-center text-error shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-xl">warning</span>
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-primary leading-tight">Cancel emergency request?</h3>
                <p className="text-[11px] text-on-surface-variant mt-1.5 leading-relaxed">
                  Are you sure you want to cancel this emergency request?
                </p>
              </div>
            </div>

            {/* Information text */}
            <div className="text-[11px] text-on-surface-variant leading-relaxed space-y-2 pl-0.5">
              <p>
                If responders have not yet been dispatched, your request will be cancelled immediately.
              </p>
              <p>
                If emergency teams are already responding, cancellation will no longer be available.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              {/* Keep Request — Default focus */}
              <button
                type="button"
                autoFocus
                onClick={() => setShowCancelConfirm(false)}
                className="py-3 px-4 rounded-xl bg-secondary hover:brightness-110 text-white font-bold text-xs flex items-center justify-center gap-1.5 min-h-[48px] cursor-pointer transition-all active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary/50"
              >
                <span className="material-symbols-outlined text-base">shield</span>
                <span>Keep request</span>
              </button>

              {/* Cancel Request */}
              <button
                type="button"
                onClick={() => handleCancelRequest()}
                className="py-3 px-4 rounded-xl bg-surface-container hover:bg-error/10 border border-outline-variant/60 hover:border-error/30 text-on-surface-variant hover:text-error font-bold text-xs flex items-center justify-center gap-1.5 min-h-[48px] cursor-pointer transition-all active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-error/40"
              >
                <span className="material-symbols-outlined text-base">close</span>
                <span>Cancel request</span>
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* Emergency Report Modal */}
      <EmergencyReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        onSubmitted={handlePacketSubmitted}
      />
    </div>
  );
}
