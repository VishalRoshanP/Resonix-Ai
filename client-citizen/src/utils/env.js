export function resolveConfiguredApiBaseUrl() {
  const customUrl = import.meta.env.VITE_API_BASE_URL;

  // On Native Android Capacitor Container: NEVER call mobile device localhost loopback
  if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform()) {
    if (customUrl && !customUrl.includes('localhost') && !customUrl.includes('127.0.0.1')) {
      return customUrl;
    }
    // Android emulator loopback host alias
    return customUrl?.replace(/localhost|127\.0\.0\.1/g, '10.0.2.2') || 'http://10.0.2.2:5000/api/v1';
  }

  // Web Browser Runtime: Use configured URL, dynamic host IP, or fallback
  if (customUrl) {
    return customUrl;
  }

  if (typeof window !== 'undefined' && window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return `${window.location.protocol}//${window.location.hostname}:5000/api/v1`;
  }

  return 'http://localhost:5000/api/v1';
}

export const env = {
  get apiBaseUrl() {
    return resolveConfiguredApiBaseUrl();
  },
  appMode: import.meta.env.VITE_APP_MODE || 'citizen',
  isMockEnabled: import.meta.env.VITE_ENABLE_MOCK_FALLBACK !== 'false',
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
  const baseHost = currentBaseUrl.replace(/\/api\/v1\/?$/, '');
  if (path.startsWith('/')) {
    return `${baseHost}${path}`;
  }
  return `${currentBaseUrl}/${path}`;
}

