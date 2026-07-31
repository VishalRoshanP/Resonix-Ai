import { useState, useEffect, useCallback } from 'react';
import { autoSyncService } from '../services/autoSyncService';

/**
 * Custom React Hook for Phase 2 Automatic Synchronization
 * 
 * Provides reactive access to:
 * - isSyncing status flag
 * - lastSyncTimestamp ISO string
 * - pendingCount number
 * - syncLogs array of debugging logs
 * - triggerSyncNow manual trigger handler
 */
export function useAutoSync() {
  const [syncState, setSyncState] = useState(() => autoSyncService.getSyncState());

  useEffect(() => {
    // Subscribe to real-time auto sync state & logging updates
    const unsub = autoSyncService.onSyncEvent((state) => {
      setSyncState(state);
    });

    return () => {
      unsub();
    };
  }, []);

  const triggerSyncNow = useCallback(() => {
    return autoSyncService.triggerSyncNow();
  }, []);

  return {
    isSyncing: syncState.isSyncing,
    lastSyncTimestamp: syncState.lastSyncTimestamp,
    pendingCount: syncState.pendingCount,
    syncLogs: syncState.syncLogs,
    triggerSyncNow,
  };
}

export default useAutoSync;
