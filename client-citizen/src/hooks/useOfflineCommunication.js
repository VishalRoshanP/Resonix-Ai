import { useState, useEffect, useCallback } from 'react';
import { offlineCommunicationService } from '../services/offlineCommunicationService';

/**
 * Custom React Hook for Phase 2 Offline Communication
 * 
 * Provides reactive access to:
 * - isOnline & isOffline boolean status flags
 * - pendingQueue array & queueCount
 * - enqueueSOS method for registering new SOS messages
 * - removeMessage & clearQueue helper methods
 */
export function useOfflineCommunication() {
  const [isOnline, setIsOnline] = useState(() => offlineCommunicationService.isOnline());
  const [pendingQueue, setPendingQueue] = useState(() => offlineCommunicationService.getPendingQueue());

  useEffect(() => {
    // Subscribe to network availability changes
    const unsubNetwork = offlineCommunicationService.onNetworkStateChange((online) => {
      setIsOnline(online);
    });

    // Subscribe to offline queue changes
    const unsubQueue = offlineCommunicationService.onQueueChange((queue) => {
      setPendingQueue(queue);
    });

    return () => {
      unsubNetwork();
      unsubQueue();
    };
  }, []);

  const enqueueSOS = useCallback((sosPayload) => {
    return offlineCommunicationService.enqueueSOS(sosPayload);
  }, []);

  const removeMessage = useCallback((messageId) => {
    return offlineCommunicationService.removeMessage(messageId);
  }, []);

  const clearQueue = useCallback(() => {
    return offlineCommunicationService.clearQueue();
  }, []);

  return {
    isOnline,
    isOffline: !isOnline,
    networkStatus: isOnline ? 'ONLINE' : 'OFFLINE',
    pendingQueue,
    queueCount: pendingQueue.length,
    deviceId: offlineCommunicationService.getDeviceId(),
    enqueueSOS,
    removeMessage,
    clearQueue,
  };
}

export default useOfflineCommunication;
