import React, { useState, useEffect } from 'react';
import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { getLocalPackets } from '../../services/emergencyPacketManager';
import { offlineCommunicationService } from '../../services/offlineCommunicationService';
import OfflineSyncStatusModal from './OfflineSyncStatusModal';

export default function NetworkStatusWidget({ compact = false }) {
  const { isOnline, relayStatus, isSyncingQueue, lastSyncResult, syncLocalQueueToBackend } = useNetworkStatus();
  const [pendingCount, setPendingCount] = useState(() => Math.max(getLocalPackets().length, offlineCommunicationService.getPendingCount()));
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    const updateCount = () => {
      setPendingCount(Math.max(getLocalPackets().length, offlineCommunicationService.getPendingCount()));
    };

    updateCount();
    const unsub = offlineCommunicationService.onQueueChange(() => updateCount());
    const interval = setInterval(updateCount, 3000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  if (compact) {
    return (
      <>
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold">
          {isOnline ? (
            <span className="flex items-center gap-1 text-emerald-800 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              Online
            </span>
          ) : (
            <span className="flex items-center gap-1 text-amber-800 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30" title="Offline Mode - Searching for Relay...">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
              Offline Mesh
            </span>
          )}

          {pendingCount > 0 && (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 dark:text-amber-300 bg-amber-500/20 hover:bg-amber-500/30 px-2 py-0.5 rounded-full border border-amber-500/40 cursor-pointer transition-colors"
              title="Click to view pending offline emergency reports"
            >
              <span className="material-symbols-outlined text-xs">sync_saved_locally</span>
              {pendingCount} Pending
            </button>
          )}
        </div>

        <OfflineSyncStatusModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
      </>
    );
  }

  return (
    <>
      <div className="bg-surface-container border border-outline-variant/60 rounded-xl p-3 sm:p-3.5 text-left shadow-xs transition-all animate-fade-in">
        {isOnline ? (
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <span className="w-3 h-3 rounded-full bg-emerald-600 animate-pulse shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-xs text-emerald-800 dark:text-emerald-300 leading-tight">
                    Network Connected
                  </span>
                  <span className="text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-500/30 whitespace-nowrap shrink-0">
                    Direct Server
                  </span>
                  {pendingCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(true)}
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-800 dark:text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 px-2 py-0.5 rounded-full border border-amber-500/30 cursor-pointer transition-colors"
                    >
                      <span className="material-symbols-outlined text-xs">sync_saved_locally</span>
                      {pendingCount} Pending Sync
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-on-surface-variant font-mono truncate mt-0.5">
                  {isSyncingQueue
                    ? 'Syncing offline emergency queue...'
                    : (pendingCount > 0 ? `${pendingCount} offline report(s) ready to sync` : 'Emergency packets send instantly to backend')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {pendingCount > 0 && (
                <button
                  type="button"
                  onClick={() => setIsModalOpen(true)}
                  className="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container-high rounded-lg transition-colors flex items-center justify-center shrink-0 cursor-pointer min-h-[36px] min-w-[36px]"
                  title="View Pending Reports"
                  aria-label="View Pending Reports"
                >
                  <span className="material-symbols-outlined text-base">list_alt</span>
                </button>
              )}
              <button
                type="button"
                onClick={syncLocalQueueToBackend}
                className="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container-high rounded-lg transition-colors flex items-center justify-center shrink-0 cursor-pointer min-h-[36px] min-w-[36px]"
                title="Retry Network Connection Now"
                aria-label="Retry Network Connection"
              >
                <span className="material-symbols-outlined text-base">sync</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <span className="material-symbols-outlined text-lg text-amber-600 dark:text-amber-400 animate-pulse shrink-0">
                wifi_off
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-xs text-amber-800 dark:text-amber-300 leading-tight">
                    Offline Mode
                  </span>
                  <span className="text-[10px] font-bold uppercase bg-amber-500/15 text-amber-900 dark:text-amber-300 px-1.5 py-0.2 rounded border border-amber-400/50 whitespace-nowrap shrink-0">
                    Mesh Active
                  </span>
                  {pendingCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(true)}
                      className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-900 dark:text-amber-300 bg-amber-500/20 hover:bg-amber-500/30 px-2 py-0.5 rounded-full border border-amber-500/40 cursor-pointer transition-colors"
                    >
                      <span className="material-symbols-outlined text-xs">sync_saved_locally</span>
                      {pendingCount} Stored
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-on-surface-variant font-mono truncate mt-0.5">
                  {pendingCount > 0 ? `${pendingCount} packet(s) stored locally • Retrying...` : 'Searching for nearest mesh relay node...'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setIsModalOpen(true)}
                className="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container-high rounded-lg transition-colors flex items-center justify-center shrink-0 cursor-pointer min-h-[36px] min-w-[36px]"
                title="View Pending Reports"
                aria-label="View Pending Reports"
              >
                <span className="material-symbols-outlined text-base">list_alt</span>
              </button>
              <button
                type="button"
                onClick={syncLocalQueueToBackend}
                className="p-2 text-on-surface-variant hover:text-primary hover:bg-surface-container-high rounded-lg transition-colors flex items-center justify-center shrink-0 cursor-pointer min-h-[36px] min-w-[36px]"
                title="Retry Network Connection Now"
                aria-label="Retry Network Connection"
              >
                <span className="material-symbols-outlined text-base">sync</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <OfflineSyncStatusModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}
