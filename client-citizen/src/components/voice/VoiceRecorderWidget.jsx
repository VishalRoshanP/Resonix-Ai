import { useState } from 'react';
import { useVoiceRecorder } from '../../hooks/useVoiceRecorder';
import Button from '../ui/Button';

export default function VoiceRecorderWidget({ onVoiceProcessed }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const {
    formattedTime,
    audioUrl,
    transcript,
    setTranscript,
    selectedLang,
    setSelectedLang,
    errorMessage,
    backendResponse,
    startRecording,
    stopRecording,
    cancelRecording,
    deleteRecording,
    reRecord,
    sendToBackend,
    isIdle,
    isListening,
    isRecording,
    isProcessing,
    isRecorded,
  } = useVoiceRecorder();

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

  const handleProcess = async () => {
    const result = await sendToBackend();
    if (result && onVoiceProcessed) {
      onVoiceProcessed(result);
    }
  };

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-5 text-center space-y-4 shadow-sm animate-fade-in text-left">
      {/* Language Selector Header */}
      <div className="flex items-center justify-between border-b border-outline-variant/60 pb-3">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-secondary text-xl">translate</span>
          <span className="text-xs font-bold text-primary">Voice Language</span>
        </div>
        <select
          value={selectedLang}
          onChange={(e) => setSelectedLang(e.target.value)}
          disabled={isRecording}
          className="px-3 py-1.5 rounded-lg bg-surface-container border border-outline-variant text-xs font-bold text-primary focus:outline-none focus:border-secondary cursor-pointer"
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.label}
            </option>
          ))}
        </select>
      </div>

      {/* 1. Main Interactive Microphone Button Area */}
      <div className="text-center py-2">
        <div className="relative inline-block my-1">
          {/* Pulsing Outer Ring when Recording */}
          {isRecording && (
            <div className="absolute -inset-3 rounded-full bg-error/20 animate-ping" />
          )}

          <button
            type="button"
            onClick={isRecording ? stopRecording : () => startRecording(selectedLang)}
            disabled={isProcessing}
            className={`relative z-10 w-24 h-24 rounded-full flex flex-col items-center justify-center text-white shadow-ambient transition-all duration-300 cursor-pointer ${
              isRecording
                ? 'bg-error scale-105 ring-8 ring-error/20'
                : isListening
                ? 'bg-secondary scale-105 ring-8 ring-secondary/20'
                : isRecorded
                ? 'bg-emerald-600 hover:bg-emerald-700'
                : 'bg-primary hover:bg-tertiary'
            }`}
          >
            <span className="material-symbols-outlined text-4xl">
              {isRecording ? 'stop' : isListening ? 'hourglass_top' : isRecorded ? 'check_circle' : 'mic'}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider mt-0.5">
              {isRecording ? 'Stop' : isRecorded ? 'Saved' : 'Tap to Speak'}
            </span>
          </button>
        </div>

        {/* Real-time Status Display */}
        <div className="mt-2 space-y-1">
          {isListening && (
            <p className="text-xs font-bold text-secondary animate-pulse">Initializing Microphone & Noise Suppression...</p>
          )}

          {isRecording && (
            <div className="space-y-2">
              <div className="flex items-center justify-center gap-2 text-sm font-bold text-error">
                <span className="w-2.5 h-2.5 rounded-full bg-error animate-ping" />
                Recording Voice Telemetry... <span className="font-mono text-primary font-bold ml-1">{formattedTime}</span>
              </div>

              {/* Audio Waveform Animation Bars */}
              <div className="flex items-center justify-center gap-1 h-6">
                {[40, 70, 30, 90, 60, 100, 50, 80, 40, 65].map((h, i) => (
                  <div
                    key={i}
                    className="w-1 bg-error rounded-full animate-pulse"
                    style={{
                      height: `${h}%`,
                      animationDelay: `${i * 0.1}s`,
                      animationDuration: '0.6s',
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {isProcessing && (
            <p className="text-xs font-bold text-secondary flex items-center justify-center gap-1.5">
              <span className="material-symbols-outlined animate-spin text-base">sync</span>
              Processing Audio Telemetry...
            </p>
          )}

          {isIdle && (
            <p className="text-xs text-on-surface-variant text-center">
              Tap microphone to begin emergency voice recording with active noise cancellation.
            </p>
          )}

          {errorMessage && <p className="text-xs text-error font-medium text-center">{errorMessage}</p>}
        </div>
      </div>

      {/* 2. Live Speech-to-Text Transcript Preview Area */}
      {(isRecording || isRecorded || transcript) && (
        <div className="space-y-1.5 pt-2 border-t border-outline-variant/60">
          <label className="text-xs font-extrabold text-primary flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-secondary text-base">speech_to_text</span>
              <span>STT Live Transcript Preview</span>
            </span>
            <span className="text-[10px] font-mono text-on-surface-variant uppercase">
              Language: {selectedLang}
            </span>
          </label>
          <textarea
            rows={3}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Live speech transcript will appear here as you speak..."
            className="w-full p-3 rounded-xl bg-surface-container border border-outline-variant text-xs font-medium text-primary focus:outline-none focus:border-secondary resize-none"
          />
        </div>
      )}

      {/* 3. Audio Playback & Actions when Recorded */}
      {isRecorded && (
        <div className="space-y-3 pt-2 border-t border-outline-variant/60">
          {audioUrl && (
            <div className="p-2.5 bg-surface-container rounded-xl border border-outline-variant flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-lg">graphic_eq</span>
              <audio src={audioUrl} controls className="w-full h-8" />
            </div>
          )}

          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              className="text-error border-error/30 hover:bg-error/10 flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-xs">delete</span>
              Delete
            </Button>

            <Button variant="secondary" size="sm" onClick={reRecord}>
              Re-record
            </Button>

            <Button variant="primary" size="sm" onClick={() => handleProcess()}>
              Transmit Voice & STT Payload
            </Button>
          </div>

          {/* Delete Voice Recording Confirmation Dialog */}
          {showDeleteConfirm && (
            <div className="p-3.5 rounded-xl bg-error/10 border border-error/30 space-y-2.5 animate-fade-in mt-2 text-left">
              <div className="flex items-start gap-2 text-error">
                <span className="material-symbols-outlined text-lg shrink-0 mt-0.5">warning</span>
                <div>
                  <p className="font-extrabold text-xs">Delete voice recording?</p>
                  <p className="text-[11px] text-on-surface-variant mt-0.5">This will also remove the current transcript.</p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3 py-1.5 rounded-lg bg-surface border border-outline-variant text-xs font-bold text-primary hover:bg-surface-container cursor-pointer transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    deleteRecording();
                    setShowDeleteConfirm(false);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-error text-white text-xs font-bold hover:brightness-110 cursor-pointer shadow-xs transition-colors flex items-center gap-1"
                >
                  <span className="material-symbols-outlined text-sm">delete</span>
                  <span>Delete</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Transmitted Confirmation */}
      {backendResponse && (
        <div className="p-3 bg-success/10 border border-success/30 rounded-xl text-xs font-bold text-success flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">check_circle</span>
          <span>Emergency message sent</span>
        </div>
      )}
    </div>
  );
}
