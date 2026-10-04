const PROD_BACKEND_ORIGIN = 'https://resonix-server.onrender.com';

export function resolveBackendUrl() {
  let backend = import.meta.env.VITE_BACKEND_URL;

  if (!backend && import.meta.env.VITE_API_BASE_URL) {
    backend = import.meta.env.VITE_API_BASE_URL.replace(/\/api\/v1\/?$/, '').replace(/\/api\/?$/, '');
  }

  if (!backend || backend.includes('YOUR') || backend.includes('your') || (import.meta.env.DEV && backend.includes('resonix-server.onrender.com'))) {
    backend = import.meta.env.DEV ? 'http://localhost:5000' : PROD_BACKEND_ORIGIN;
  }

  return (backend || PROD_BACKEND_ORIGIN).replace(/\/+$/, '');
}

export function resolveConfiguredApiBaseUrl() {
  const backend = resolveBackendUrl();
  return `${backend}/api/v1`;
}

export const env = {
  get backendUrl() {
    return resolveBackendUrl();
  },
  get apiBaseUrl() {
    return resolveConfiguredApiBaseUrl();
  },
  appMode: import.meta.env.VITE_APP_MODE || 'responder',
  isMockEnabled: false,
  isProduction: import.meta.env.MODE === 'production',
  isDevelopment: import.meta.env.MODE === 'development',
  get: (key, defaultValue = '') => import.meta.env[key] || defaultValue,
};

