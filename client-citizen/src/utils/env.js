const PROD_BACKEND_ORIGIN = 'https://resonix-server.onrender.com';

export function resolveBackendUrl() {
  let backend = import.meta.env.VITE_BACKEND_URL;

  if (!backend && import.meta.env.VITE_API_BASE_URL) {
    backend = import.meta.env.VITE_API_BASE_URL.replace(/\/api\/v1\/?$/, '').replace(/\/api\/?$/, '');
  }

  if (!backend || backend.includes('YOUR') || backend.includes('your') || (import.meta.env.DEV && backend.includes('resonix-server.onrender.com'))) {
    backend = import.meta.env.DEV ? 'http://localhost:5000' : PROD_BACKEND_ORIGIN;
  }

  // Remove trailing slash if present
  backend = (backend || PROD_BACKEND_ORIGIN).replace(/\/+$/, '');

  // On Native Android Capacitor Container: NEVER call mobile device localhost loopback
  if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform()) {
    if (!backend.includes('localhost') && !backend.includes('127.0.0.1')) {
      return backend;
    }
    // Android emulator loopback host alias
    return backend.replace(/localhost|127\.0\.0\.1/g, '10.0.2.2');
  }

  return backend;
}

export function resolveConfiguredApiBaseUrl() {
  const backend = resolveBackendUrl();
  return backend ? `${backend}/api/v1` : '/api/v1';
}

export const env = {
  get backendUrl() {
    return resolveBackendUrl();
  },
  get apiBaseUrl() {
    return resolveConfiguredApiBaseUrl();
  },
  appMode: import.meta.env.VITE_APP_MODE || 'citizen',
  isMockEnabled: false,
  isProduction: import.meta.env.MODE === 'production',
  isDevelopment: import.meta.env.MODE === 'development',
  get: (key, defaultValue = '') => import.meta.env[key] || defaultValue,
};

export function resolveApiUrl(path) {
  const currentBaseUrl = env.apiBaseUrl;
  if (!path) return currentBaseUrl;
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const baseHost = resolveBackendUrl();
  if (path.startsWith('/api/v1')) {
    return `${baseHost}${path}`;
  }
  if (path.startsWith('/api/')) {
    return `${baseHost}${path}`;
  }
  if (path.startsWith('/')) {
    return `${baseHost}${path}`;
  }
  return `${currentBaseUrl}/${path}`;
}

