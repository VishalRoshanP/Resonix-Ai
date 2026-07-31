import { useState, useEffect, useCallback } from 'react';
import networkConnectivityService from '../services/networkConnectivityService';
import {
  getLocalPackets,
  transmitPacketToBackend,
} from '../services/emergencyPacketManager';
import { RELAY_STATES } from '../services/relayNetworkArchitecture';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(() => networkConnectivityService.isOnline());
  const [relayStatus, setRelayStatus] = useState(() =>
    networkConnectivityService.isOnline() ? RELAY_STATES.IDLE : RELAY_STATES.SEARCHING_FOR_RELAY
  );
  const [isSyncingQueue, setIsSyncingQueue] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState(null);

  // Automatically flush local packet queue when internet connectivity is restored
  const syncLocalQueueToBackend = useCallback(async () => {
    const queue = getLocalPackets();
    if (queue.length === 0) return;

    setIsSyncingQueue(true);
    let successCount = 0;

    for (const packet of [...queue]) {
      const result = await transmitPacketToBackend(packet);
      if (result && result.success) {
        successCount++;
      }
    }

    setIsSyncingQueue(false);
    setLastSyncResult({
      syncedCount: successCount,
      timestamp: new Date().toISOString(),
    });
  }, []);

  // Manual re-check trigger for network connection
  const handleManualRetry = useCallback(async () => {
    const onlineState = await networkConnectivityService.forceRecheck();
    if (onlineState) {
      syncLocalQueueToBackend();
    }
  }, [syncLocalQueueToBackend]);

  useEffect(() => {
    // Subscribe to production-ready networkConnectivityService events
    const unsubscribe = networkConnectivityService.subscribe(({ isOnline: newOnlineState }) => {
      setIsOnline(newOnlineState);
      if (newOnlineState) {
        setRelayStatus(RELAY_STATES.IDLE);
        syncLocalQueueToBackend();
      } else {
        setRelayStatus(RELAY_STATES.SEARCHING_FOR_RELAY);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [syncLocalQueueToBackend]);

  return {
    isOnline,
    relayStatus,
    isSyncingQueue,
    lastSyncResult,
    syncLocalQueueToBackend: handleManualRetry,
    networkModeText: isOnline ? 'ONLINE' : 'OFFLINE_MESH',
  };
}

