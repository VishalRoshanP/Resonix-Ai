/**
 * Real Location Service for RESONIX AI Citizen Mobile (React Native)
 * 
 * Strict Zero Mock Data Policy:
 * - Queries real device GPS coordinates using PermissionsAndroid & native LocationManager via ResonixBleModule / geolocation.
 * - Handles permissions, unavailable, loading, and error states.
 * - Caches last valid snapshot in local storage for offline resilience.
 * - NEVER hardcodes fake coordinates.
 */

const { PermissionsAndroid, Platform, NativeModules } = require('react-native');
const storage = require('../utils/storage');

const GPS_CACHE_KEY = '@resonix_last_known_gps';

class LocationService {
  /**
   * Check if location permission is already granted
   */
  async checkPermissionStatus() {
    if (Platform.OS !== 'android') return true;
    try {
      const fine = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      const coarse = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION);
      return fine || coarse;
    } catch (_) {
      return false;
    }
  }

  /**
   * Request Android Fine & Coarse Location Permissions
   */
  async requestLocationPermission() {
    if (Platform.OS !== 'android') return true;

    try {
      const isAlreadyGranted = await this.checkPermissionStatus();
      if (isAlreadyGranted) return true;

      const granted = await PermissionsAndroid.requestMultiple([
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
      ]);

      return (
        granted['android.permission.ACCESS_FINE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED ||
        granted['android.permission.ACCESS_COARSE_LOCATION'] === PermissionsAndroid.RESULTS.GRANTED
      );
    } catch (err) {
      console.warn('[LocationService] Permission request notice:', err.message);
      return false;
    }
  }

  /**
   * Get Cached Location from storage
   */
  async getCachedLocation() {
    try {
      const cached = await storage.getItem(GPS_CACHE_KEY);
      if (cached && cached.latitude != null && cached.longitude != null) {
        return {
          ...cached,
          hasGps: true,
          isCached: true,
          status: 'CACHED_LOCATION',
        };
      }
    } catch (_) {}
    return null;
  }

  /**
   * Get Current GPS Coordinates with fallback to cache
   */
  async getCurrentLocation() {
    const hasPermission = await this.requestLocationPermission();

    if (!hasPermission) {
      const cached = await this.getCachedLocation();
      if (cached) {
        return {
          ...cached,
          status: 'CACHED_LOCATION',
        };
      }

      return {
        hasGps: false,
        latitude: null,
        longitude: null,
        accuracy: null,
        status: 'PERMISSION_DENIED',
        message: 'Location permission required for automatic GPS.',
      };
    }

    // 1. Query Native Android Location via ResonixBleModule (which queries Android LocationManager GPS & Fused providers)
    try {
      const bleModule = NativeModules?.ResonixBleModule;
      if (bleModule && typeof bleModule.getCurrentLocation === 'function') {
        const nativeLoc = await bleModule.getCurrentLocation();
        if (nativeLoc && nativeLoc.hasLocation && nativeLoc.latitude != null && nativeLoc.longitude != null) {
          const snapshot = {
            hasGps: true,
            latitude: Number(nativeLoc.latitude),
            longitude: Number(nativeLoc.longitude),
            accuracy: Math.round(Number(nativeLoc.accuracy || 10) * 10) / 10,
            altitude: nativeLoc.altitude || null,
            timestamp: new Date(nativeLoc.time || Date.now()).toISOString(),
            status: 'GPS_READY',
            isCached: false,
          };
          await storage.setItem(GPS_CACHE_KEY, snapshot).catch(() => {});
          return snapshot;
        }
      }
    } catch (nativeErr) {
      console.warn('[LocationService] Native getCurrentLocation notice:', nativeErr.message);
    }

    // 2. Query navigator.geolocation if available (cross-platform / polyfill fallback)
    try {
      const geo = typeof navigator !== 'undefined' ? navigator.geolocation : (typeof global !== 'undefined' && global.navigator ? global.navigator.geolocation : null);
      if (geo && typeof geo.getCurrentPosition === 'function') {
        const geoLoc = await new Promise((resolve) => {
          geo.getCurrentPosition(
            (pos) => {
              if (pos?.coords?.latitude != null && pos?.coords?.longitude != null) {
                const snapshot = {
                  hasGps: true,
                  latitude: Number(pos.coords.latitude),
                  longitude: Number(pos.coords.longitude),
                  accuracy: Math.round(Number(pos.coords.accuracy || 10) * 10) / 10,
                  altitude: pos.coords.altitude || null,
                  timestamp: new Date(pos.timestamp || Date.now()).toISOString(),
                  status: 'GPS_READY',
                  isCached: false,
                };
                storage.setItem(GPS_CACHE_KEY, snapshot).catch(() => {});
                resolve(snapshot);
              } else {
                resolve(null);
              }
            },
            () => resolve(null),
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 30000 }
          );
        });
        if (geoLoc) return geoLoc;
      }
    } catch (_) {}

    // 3. Fallback to cached location if available
    const cached = await this.getCachedLocation();
    if (cached) {
      return {
        ...cached,
        status: 'CACHED_LOCATION',
        isCached: true,
      };
    }

    return {
      hasGps: false,
      latitude: null,
      longitude: null,
      accuracy: null,
      status: 'GPS_UNAVAILABLE',
      message: 'Location unavailable — Tap to retry',
    };
  }
}

const locationService = new LocationService();
module.exports = locationService;
