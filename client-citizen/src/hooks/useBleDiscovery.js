import { useState, useEffect, useCallback } from 'react';
import { bleDiscoveryService, BLE_STATE } from '../services/bleDiscoveryService';

/**
 * Custom React Hook for Phase 2 BLE Peer Discovery
 * 
 * Provides reactive access to:
 * - bluetoothState & errorMessage
 * - isScanning & isAdvertising flags
 * - nearbyPeers list & peerCount
 * - startDiscovery & stopDiscovery controls
 */
export function useBleDiscovery(autoStart = false) {
  const [bluetoothState, setBluetoothState] = useState(() => bleDiscoveryService.getBluetoothState());
  const [errorMessage, setErrorMessage] = useState(() => bleDiscoveryService.getErrorMessage());
  const [nearbyPeers, setNearbyPeers] = useState(() => bleDiscoveryService.getNearbyPeers());
  const [isScanning, setIsScanning] = useState(() => bleDiscoveryService.isScanning);

  useEffect(() => {
    // Subscribe to Bluetooth state & error updates
    const unsubState = bleDiscoveryService.onStateChange((state, errorMsg) => {
      setBluetoothState(state);
      setErrorMessage(errorMsg);
      setIsScanning(bleDiscoveryService.isScanning);
    });

    // Subscribe to nearby peers list updates
    const unsubPeers = bleDiscoveryService.onPeersChange((peers) => {
      setNearbyPeers(peers);
    });

    if (autoStart) {
      bleDiscoveryService.startDiscovery();
    }

    return () => {
      unsubState();
      unsubPeers();
    };
  }, [autoStart]);

  const startDiscovery = useCallback(() => {
    return bleDiscoveryService.startDiscovery();
  }, []);

  const stopDiscovery = useCallback(() => {
    return bleDiscoveryService.stopDiscovery();
  }, []);

  return {
    bluetoothState,
    errorMessage,
    isScanning,
    isAdvertising: bleDiscoveryService.isAdvertising,
    isBleSupported: bleDiscoveryService.isBleSupported(),
    nearbyPeers,
    peerCount: nearbyPeers.length,
    startDiscovery,
    stopDiscovery,
  };
}

export default useBleDiscovery;
