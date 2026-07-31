import { useState, useEffect, useCallback } from 'react';
import { responderSocketClient } from '../services/socketClient';

/**
 * Custom React Hook for Responder Real-Time Synchronization
 * 
 * Provides reactive access to:
 * - isConnected boolean state
 * - lastSocketEvent object
 * - updateIncidentStatus method
 * - connect & disconnect methods
 */
export function useSocket(autoConnect = true) {
  const [isConnected, setIsConnected] = useState(() => responderSocketClient.isConnected);
  const [lastSocketEvent, setLastSocketEvent] = useState(null);

  useEffect(() => {
    if (autoConnect) {
      responderSocketClient.connect();
    }

    const unsub = responderSocketClient.onEvent((eventData) => {
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
  }, [autoConnect]);

  const updateIncidentStatus = useCallback((incidentId, status) => {
    return responderSocketClient.updateIncidentStatus(incidentId, status);
  }, []);

  const connect = useCallback(() => {
    return responderSocketClient.connect();
  }, []);

  const disconnect = useCallback(() => {
    return responderSocketClient.disconnect();
  }, []);

  return {
    isConnected,
    lastSocketEvent,
    updateIncidentStatus,
    connect,
    disconnect,
  };
}

export default useSocket;
