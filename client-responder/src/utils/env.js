export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1',
  appMode: import.meta.env.VITE_APP_MODE || 'responder',
  isMockEnabled: import.meta.env.VITE_ENABLE_MOCK_FALLBACK !== 'false',
  isProduction: import.meta.env.MODE === 'production',
  isDevelopment: import.meta.env.MODE === 'development',
  get: (key, defaultValue = '') => import.meta.env[key] || defaultValue,
};
