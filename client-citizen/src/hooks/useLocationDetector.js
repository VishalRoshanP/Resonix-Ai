import { useState, useEffect, useCallback, useRef } from 'react';
import { resolveApiUrl } from '../utils/env';

export const LOCATION_STATUS = {
  IDLE: 'IDLE',
  DETECTING: 'DETECTING',
  SUCCESS: 'SUCCESS',
  UNAVAILABLE: 'UNAVAILABLE',
};

const STORAGE_KEY = 'resonix_last_gps';

export function useLocationDetector() {
  const [status, setStatus] = useState(LOCATION_STATUS.IDLE);
  const [locationData, setLocationData] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch (_) {
      return null;
    }
  });
  const [errorMessage, setErrorMessage] = useState(null);

  const isDetectingRef = useRef(false);
  const locationDataRef = useRef(locationData);
  const isMountedRef = useRef(true);

  useEffect(() => {
    locationDataRef.current = locationData;
  }, [locationData]);

  const detectLocation = useCallback(async () => {
    if (isDetectingRef.current) return locationDataRef.current;
    isDetectingRef.current = true;
    if (isMountedRef.current) {
      setStatus(LOCATION_STATUS.DETECTING);
      setErrorMessage(null);
    }

    if (!navigator.geolocation) {
      isDetectingRef.current = false;
      if (isMountedRef.current) {
        setStatus(LOCATION_STATUS.UNAVAILABLE);
        setErrorMessage('Location unavailable. Your SOS can still be sent.');
      }
      return null;
    }

    return new Promise((resolve) => {
      const options = {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 30000,
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          isDetectingRef.current = false;
          const data = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: Math.round(position.coords.accuracy * 10) / 10,
            altitude: position.coords.altitude,
            heading: position.coords.heading,
            speed: position.coords.speed,
            timestamp: position.timestamp || Date.now(),
          };

          locationDataRef.current = data;
          if (isMountedRef.current) {
            setLocationData(data);
            setStatus(LOCATION_STATUS.SUCCESS);
            setErrorMessage(null);
          }

          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
          } catch (_) {}

          resolve(data);
        },
        (error) => {
          isDetectingRef.current = false;
          if (isMountedRef.current) {
            setStatus(LOCATION_STATUS.UNAVAILABLE);
            const fallbackMsg = 'Location unavailable. Your SOS can still be sent.';
            setErrorMessage(fallbackMsg);
          }
          resolve(null);
        },
        options
      );
    });
  }, []);

  // Send GPS payload to backend report API
  const sendLocationToBackend = useCallback(async (locationPayload) => {
    const dataToSend = locationPayload || locationDataRef.current || locationData;
    if (!dataToSend) return null;

    try {
      const response = await fetch(resolveApiUrl('/api/reports/location'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude: dataToSend.latitude,
          longitude: dataToSend.longitude,
          accuracy: dataToSend.accuracy,
          status: 'GPS_AVAILABLE',
        }),
      });

      return await response.json();
    } catch (err) {
      console.warn('[useLocationDetector] Failed to send location to backend:', err.message);
      return null;
    }
  }, [locationData]);

  // Attempt automatic detection on initial component mount
  useEffect(() => {
    isMountedRef.current = true;
    detectLocation();
    return () => {
      isMountedRef.current = false;
    };
  }, [detectLocation]);

  return {
    status,
    locationData,
    errorMessage,
    detectLocation,
    sendLocationToBackend,
    hasLocation: status === LOCATION_STATUS.SUCCESS && Boolean(locationData),
    isDetecting: status === LOCATION_STATUS.DETECTING,
    isUnavailable: status === LOCATION_STATUS.UNAVAILABLE,
  };
}
