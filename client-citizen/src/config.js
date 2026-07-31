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
    mockFallback: env.isMockEnabled,
  },
  geoDefaults: {
    lat: 12.9716,
    lng: 77.5946,
    city: 'Bengaluru Command Hub',
  },
};
