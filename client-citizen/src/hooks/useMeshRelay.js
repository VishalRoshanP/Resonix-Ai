import { useState, useEffect, useCallback } from 'react';
import { meshRelayService } from '../services/meshRelayService';

/**
 * Custom React Hook for Phase 2 Automatic Multi-Hop SOS Relay
 * 
 * Provides reactive access to:
 * - isRelayActive status flag
 * - relayedPacketsCount metric
 * - receiveRelayedSOS handler (for simulating/processing incoming peer relays)
 * - startAutoRelayLoop & stopAutoRelayLoop control methods
 */
export function useMeshRelay() {
  const [isRelayActive, setIsRelayActive] = useState(() => meshRelayService.isRelayActive);
  const [relayedPacketsCount, setRelayedPacketsCount] = useState(() => meshRelayService.relayedPacketsCount);
  const [lastRelayEvent, setLastRelayEvent] = useState(null);

  useEffect(() => {
    // Subscribe to multi-hop mesh relay events
    const unsub = meshRelayService.onRelayEvent((eventData) => {
      setLastRelayEvent(eventData);
      setRelayedPacketsCount(meshRelayService.relayedPacketsCount);
      setIsRelayActive(meshRelayService.isRelayActive);
    });

    return () => {
      unsub();
    };
  }, []);

  const receiveRelayedSOS = useCallback((rawPayload, senderDeviceId, rssi) => {
    return meshRelayService.receiveRelayedSOS(rawPayload, senderDeviceId, rssi);
  }, []);

  const startRelay = useCallback(() => {
    meshRelayService.startAutoRelayLoop();
    setIsRelayActive(true);
  }, []);

  const stopRelay = useCallback(() => {
    meshRelayService.stopAutoRelayLoop();
    setIsRelayActive(false);
  }, []);

  return {
    isRelayActive,
    relayedPacketsCount,
    lastRelayEvent,
    receiveRelayedSOS,
    startRelay,
    stopRelay,
  };
}

export default useMeshRelay;
