import { useState, useEffect, useCallback } from 'react';
import { citizenSocketClient } from '../services/socketClient';

/**
 * Custom React Hook for Citizen Real-Time Synchronization
 * 
 * Provides reactive access to:
 * - isConnected boolean state
 * - lastSocketEvent object
 * - connect & disconnect methods
 */
export function useSocket(userId = 'usr_guest', autoConnect = true) {
  const [isConnected, setIsConnected] = useState(() => citizenSocketClient.isConnected);
  const [lastSocketEvent, setLastSocketEvent] = useState(null);

  useEffect(() => {
    if (autoConnect) {
      citizenSocketClient.connect(userId);
    }

    const unsub = citizenSocketClient.onEvent((eventData) => {
      if (eventData.type === 'SOCKET_CONNECTED') {
        setIsConnected(true);
      } else if (eventData.type === 'SOCKET_DISCONNECTED') {
        setIsConnected(false);
      }
      setLastSocketEvent(eventData);
    });

    return () => {
      unsub();
    };
  }, [userId, autoConnect]);

  const connect = useCallback((id = userId) => {
    return citizenSocketClient.connect(id);
  }, [userId]);

  const disconnect = useCallback(() => {
    return citizenSocketClient.disconnect();
  }, []);

  return {
    isConnected,
    lastSocketEvent,
    connect,
    disconnect,
  };
}

export default useSocket;
