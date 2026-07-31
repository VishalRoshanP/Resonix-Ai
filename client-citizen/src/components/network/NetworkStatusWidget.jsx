import { useNetworkStatus } from '../../hooks/useNetworkStatus';
import { getLocalPackets } from '../../services/emergencyPacketManager';

export default function NetworkStatusWidget({ compact = false }) {
  const { isOnline, relayStatus, isSyncingQueue, lastSyncResult, syncLocalQueueToBackend } = useNetworkStatus();
  const queuedCount = getLocalPackets().length;

  if (compact) {
    return (
      <div className="inline-flex items-center gap-1.5 text-xs font-semibold">
        {isOnline ? (
          <span className="flex items-center gap-1 text-emerald-800 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            Online
          </span>
        ) : (
          <span className="flex items-center gap-1 text-amber-800 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30" title="Offline Mode - Searching for Relay...">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
            Offline Mesh
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-4 sm:p-5 text-left space-y-3 shadow-sm animate-fade-in overflow-hidden">
      {/* Online Mode State */}
      {isOnline ? (
        <div className="space-y-2 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 animate-pulse shrink-0" />
              <span className="font-bold text-primary text-sm">Network Connected</span>
            </div>

            <span className="text-[9px] sm:text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-800 px-2 py-0.5 rounded-full border border-emerald-500/30 whitespace-nowrap shrink-0">
              Direct Server
            </span>
          </div>

          <p className="text-xs text-on-surface-variant leading-relaxed">
            Emergency packets will be transmitted directly to the RESONIX AI backend API.
          </p>

          {isSyncingQueue && (
            <div className="p-2.5 bg-secondary/10 border border-secondary/20 rounded-xl text-xs font-semibold text-secondary flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-base animate-spin shrink-0">sync</span>
              <span className="break-words">Syncing locally queued packets to backend...</span>
            </div>
          )}

          {lastSyncResult && (
            <div className="text-[10px] font-mono text-emerald-800 font-semibold">
              ✓ Synced {lastSyncResult.syncedCount} packet(s) upon network restoration.
            </div>
          )}
        </div>
      ) : (
        /* Offline Mode State with "Searching for Relay..." */
        <div className="p-3.5 bg-amber-50 border border-amber-300/60 rounded-xl space-y-3 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 text-amber-900 font-bold text-sm min-w-0">
              <span className="material-symbols-outlined text-lg shrink-0">wifi_off</span>
              <span>Offline Mode</span>
            </div>

            <span className="text-[9px] sm:text-[10px] font-bold uppercase bg-amber-500/15 text-amber-900 px-2 py-0.5 rounded-full border border-amber-400/50 whitespace-nowrap shrink-0">
              Mesh Relay Active
            </span>
          </div>

          {/* Searching for Relay Indicator with Radar Pulse Animation */}
          <div className="flex items-center gap-3 p-3 bg-surface-container/60 border border-amber-300/30 rounded-lg min-w-0">
            <div className="relative flex items-center justify-center shrink-0">
              <span className="w-8 h-8 rounded-full bg-amber-400/20 animate-ping absolute" />
              <span className="material-symbols-outlined text-amber-700 text-xl relative z-10">
                cell_tower
              </span>
            </div>

            <div className="min-w-0">
              <div className="text-xs font-bold text-amber-900 flex items-center gap-1">
                Searching for Relay...
              </div>
              <p className="text-[10px] text-on-surface-variant font-medium mt-0.5 break-words">
                Scanning for nearest P2P mesh relay node (Bluetooth / WebRTC architecture ready).
              </p>
            </div>
          </div>

          <p className="text-xs text-on-surface-variant leading-relaxed break-words">
            Emergency packets will be stored locally ({queuedCount} packet(s) queued) and automatically transmitted when internet connectivity or a mesh relay is detected.
          </p>

          <button
            type="button"
            onClick={syncLocalQueueToBackend}
            className="text-xs font-bold text-amber-900 hover:text-amber-700 flex items-center gap-1 cursor-pointer min-h-[36px]"
          >
            <span className="material-symbols-outlined text-sm">sync</span>
            Retry Network Connection Now
          </button>
        </div>
      )}
    </div>
  );
}
