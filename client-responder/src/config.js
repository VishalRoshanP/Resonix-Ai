import { env } from './utils/env';

export const config = {
  appName: 'RESONIX AI Command Center',
  appMode: env.appMode,
  apiBaseUrl: env.apiBaseUrl,
  timeoutMs: 15000,
  maxRetryAttempts: 3,
  retryDelayMs: 1000,
  features: {
    incidentManagement: true,
    resourceDispatching: true,
    predictiveAnalytics: true,
    mockFallback: false,
  },
  geoDefaults: {
    lat: null,
    lng: null,
    city: 'Resonix Operations Command Center',
  },
};
