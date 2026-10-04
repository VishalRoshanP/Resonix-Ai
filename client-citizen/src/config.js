import { env } from './utils/env';

export const config = {
  appName: 'RESONIX AI',
  appMode: env.appMode,
  apiBaseUrl: env.apiBaseUrl,
  timeoutMs: 10000,
  maxRetryAttempts: 3,
  retryDelayMs: 1000,
  features: {
    voiceFirstSOS: true,
    offlineRelayMesh: true,
    predictiveAi: true,
    mockFallback: false,
  },
  geoDefaults: {
    lat: null,
    lng: null,
    city: 'Location Pending Acquisition',
  },
};
