import React, { useState, useEffect } from 'react';
import { offlineCommunicationService, SYNC_STATUS } from '../../services/offlineCommunicationService';
import { autoSyncService } from '../../services/autoSyncService';

/**
 * RESONIX AI — Offline Sync Status Modal
 * 
 * Displays:
 * - Current network status
 * - List of locally persisted emergency reports waiting to sync
 * - Telemetry details: Client Event ID, Timestamp, Location, Category, Citizen Message, Voice & Media flags, Sync Status
 * - Retry attempts & backoff details
 * - Manual "Sync Now" button
 */
export default function OfflineSyncStatusModal({ isOpen, onClose }) {
  const [reports, setReports] = useState([]);
  const [isOnline, setIsOnline] = useState(() => offlineCommunicationService.isOnline());
  const [syncState, setSyncState] = useState(() => autoSyncService.getSyncState());
  const [copiedId, setCopiedId] = useState(null);

  useEffect(() => {
    if (!isOpen) return;

    // Load initial reports
    setReports(offlineCommunicationService.getPendingQueue());
    setIsOnline(offlineCommunicationService.isOnline());

    // Subscribe to queue updates
    const unsubQueue = offlineCommunicationService.onQueueChange((queue) => {
      setReports([...queue]);
    });

    // Subscribe to network changes
    const unsubNet = offlineCommunicationService.onNetworkStateChange((online) => {
      setIsOnline(online);
    });

    // Subscribe to sync service events
    const unsubSync = autoSyncService.onSyncEvent((state) => {
      setSyncState(state);
    });

    return () => {
      unsubQueue();
      unsubNet();
      unsubSync();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCopyId = (id) => {
    try {
      navigator.clipboard.writeText(id);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (_) {}
  };

  const handleManualSync = () => {
    autoSyncService.triggerSyncNow();
  };

  const getCategoryBadgeClass = (cat) => {
    const c = String(cat || '').toUpperCase();
    if (c.includes('FIRE')) return 'bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30';
    if (c.includes('MEDIC')) return 'bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30';
    if (c.includes('FLOOD')) return 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/30';
    if (c.includes('COLLAPSE') || c.includes('EARTHQUAKE')) return 'bg-amber-500/15 text-amber-800 dark:text-amber-400 border-amber-500/30';
    return 'bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30';
  };

  const getStatusBadge = (status, retryCount = 0) => {
    switch (status) {
      case 'SYNCING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
            Syncing...
          </span>
        );
      case 'RETRYING':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-800 dark:text-amber-400 border border-amber-500/30">
            <span className="material-symbols-outlined text-xs">autorenew</span>
            Retrying {retryCount > 0 ? `(#${retryCount})` : ''}
          </span>
        );
      case 'SYNCED':
      case 'DELIVERED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
            <span className="material-symbols-outlined text-xs">check_circle</span>
            Delivered
          </span>
        );
      case 'QUEUED':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/30">
            <span className="material-symbols-outlined text-xs">hourglass_empty</span>
            Queued
          </span>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
      <div className="bg-surface-container-high border border-outline-variant/60 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-outline-variant/40 flex items-center justify-between gap-3 bg-surface-container">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <span className="material-symbols-outlined text-2xl">sync_saved_locally</span>
            </div>
            <div>
              <h2 className="font-bold text-base sm:text-lg text-on-surface leading-tight">
                Offline Reports & Sync Status
              </h2>
              <p className="text-xs text-on-surface-variant">
                Local persistence guarantees emergency reports are never lost
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container-highest rounded-lg transition-colors"
            aria-label="Close"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Network & Sync Overview Bar */}
        <div className="px-4 sm:px-5 py-3 bg-surface-container-low border-b border-outline-variant/30 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-on-surface-variant">Network:</span>
            {isOnline ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 px-2.5 py-0.5 rounded-full border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Online (Connected)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 dark:text-amber-400 bg-amber-500/15 px-2.5 py-0.5 rounded-full border border-amber-500/30">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                Offline Mode (Local Storage Active)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-on-surface-variant">
              Pending: <strong className="text-on-surface">{reports.length}</strong>
            </span>
            <button
              type="button"
              onClick={handleManualSync}
              disabled={syncState.isSyncing || !isOnline || reports.length === 0}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-primary text-on-primary text-xs font-bold rounded-lg shadow-xs hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <span className={`material-symbols-outlined text-sm ${syncState.isSyncing ? 'animate-spin' : ''}`}>
                sync
              </span>
              {syncState.isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
        </div>

        {/* Reports Content List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {reports.length === 0 ? (
            <div className="py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-3">
                <span className="material-symbols-outlined text-2xl">check_circle</span>
              </div>
              <h3 className="font-bold text-sm text-on-surface mb-1">Queue Is Clear</h3>
              <p className="text-xs text-on-surface-variant max-w-sm mx-auto">
                No offline emergency reports pending synchronization. All submitted reports are safely delivered to responders.
              </p>
            </div>
          ) : (
            reports.map((report, idx) => {
              const eventId = report.clientEventId || report.clientRequestId || report.packetId || report.messageId || `report_${idx}`;
              const category = report.category || 'GENERAL';
              const message = report.citizenMessage || report.emergencyText || report.description || 'Emergency SOS report';
              const hasVoice = Boolean(report.voiceTranscript || report.audioReference?.hasAudio || report.voicePath);
              const hasMedia = Boolean((report.media && report.media.length > 0) || report.photoReference?.hasPhoto || report.imagePath);
              const status = report.syncStatus || report.deliveryStatus || 'QUEUED';
              const location = report.location || { latitude: report.latitude, longitude: report.longitude };

              return (
                <div
                  key={eventId}
                  className="bg-surface-container border border-outline-variant/50 rounded-xl p-3.5 sm:p-4 text-left transition-all hover:border-outline-variant"
                >
                  <div className="flex items-start justify-between gap-2.5 mb-2">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase border ${getCategoryBadgeClass(category)}`}>
                        {category}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyId(eventId)}
                        className="inline-flex items-center gap-1 font-mono text-[11px] text-on-surface-variant hover:text-primary transition-colors cursor-pointer"
                        title="Click to copy unique client event ID"
                      >
                        <span className="truncate max-w-[140px] sm:max-w-[200px]">{eventId}</span>
                        <span className="material-symbols-outlined text-xs">
                          {copiedId === eventId ? 'done' : 'content_copy'}
                        </span>
                      </button>
                    </div>

                    <div className="shrink-0">
                      {getStatusBadge(status, report.retryCount)}
                    </div>
                  </div>

                  {/* Citizen Message */}
                  <p className="text-xs text-on-surface font-medium mb-2.5 leading-relaxed line-clamp-2">
                    {message}
                  </p>

                  {/* Metadata chips */}
                  <div className="flex items-center gap-3 text-[11px] text-on-surface-variant font-mono flex-wrap border-t border-outline-variant/30 pt-2">
                    {/* Timestamp */}
                    <span className="inline-flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">schedule</span>
                      {new Date(report.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </span>

                    {/* Location */}
                    {location?.latitude != null && location?.longitude != null ? (
                      <span className="inline-flex items-center gap-1" title={location.address || 'GPS Coordinates'}>
                        <span className="material-symbols-outlined text-xs">location_on</span>
                        {Number(location.latitude).toFixed(4)}, {Number(location.longitude).toFixed(4)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-on-surface-variant/60">
                        <span className="material-symbols-outlined text-xs">location_off</span>
                        No GPS
                      </span>
                    )}

                    {/* Voice transcript badge */}
                    {hasVoice && (
                      <span className="inline-flex items-center gap-1 text-primary">
                        <span className="material-symbols-outlined text-xs">mic</span>
                        Voice Transcript
                      </span>
                    )}

                    {/* Media badge */}
                    {hasMedia && (
                      <span className="inline-flex items-center gap-1 text-primary">
                        <span className="material-symbols-outlined text-xs">photo_camera</span>
                        Media Attached
                      </span>
                    )}

                    {/* Last Error if any */}
                    {report.lastError && (
                      <span className="text-red-500 dark:text-red-400 truncate max-w-[200px]" title={report.lastError}>
                        Error: {report.lastError}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 bg-surface-container border-t border-outline-variant/40 flex items-center justify-between gap-3 text-xs text-on-surface-variant">
          <span className="flex items-center gap-1 text-[11px]">
            <span className="material-symbols-outlined text-xs text-primary">security</span>
            Encrypted local persistence • Zero data loss
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-surface-container-highest hover:bg-surface-container-highest/80 text-on-surface font-semibold text-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
