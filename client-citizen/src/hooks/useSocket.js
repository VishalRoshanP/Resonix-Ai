import { useState, useEffect, useCallback } from 'react';
import { citizenSocketClient } from '../services/socketClient';

/**
 * Custom React Hook for Citizen Real-Time Synchronization
 * 
 * Provides reactive access to:
 * - isConnected boolean state
 * - isReconnecting boolean state
 * - lastSocketEvent object
 * - connect & disconnect methods
 * 
 * Reconnect Handling:
 * - Preserves current state on disconnect
 * - Socket.IO auto-reconnects with exponential backoff
 * - Emits SOCKET_RECONNECTED event for pages to fetch latest state
 */
export function useSocket(userId = 'usr_guest', autoConnect = true) {
  const [isConnected, setIsConnected] = useState(() => citizenSocketClient.isConnected);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [lastSocketEvent, setLastSocketEvent] = useState(null);

  useEffect(() => {
    if (autoConnect) {
      citizenSocketClient.connect(userId);
    }

    const unsub = citizenSocketClient.onEvent((eventData) => {
      if (eventData.type === 'SOCKET_CONNECTED' || eventData.type === 'SOCKET_RECONNECTED') {
        setIsConnected(true);
        setIsReconnecting(false);
      } else if (eventData.type === 'SOCKET_DISCONNECTED') {
        setIsConnected(false);
      } else if (eventData.type === 'SOCKET_RECONNECTING') {
        setIsReconnecting(true);
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
    isReconnecting,
    lastSocketEvent,
    connect,
    disconnect,
  };
}

export default useSocket;
