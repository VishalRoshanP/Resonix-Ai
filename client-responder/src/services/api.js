import { tokenManager } from './tokenManager';
import { env } from '../utils/env';

/**
 * Generic HTTP fetch wrapper for client-responder with Request & Response Interceptors.
 * Connects to the single shared Express backend.
 */
async function fetchApi(endpoint, options = {}) {
  const baseUrl = env.apiBaseUrl;
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${cleanEndpoint}`;

  // 1. Request Interceptor: Attach Responder JWT Token
  const token = tokenManager.getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const signal = options.signal || AbortSignal.timeout(25000);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      signal,
    });

    // 2. Response Interceptor: Handle 401 Unauthorized / Token Expiration
    if (response.status === 401) {
      console.warn(`[RESONIX Responder API] Intercepted 401 Unauthorized on: ${endpoint}. Invalidating responder session token.`);
      tokenManager.clearAll();
    }

    if (!response.ok) {
      const errorJson = await response.json().catch(() => null);
      const message = errorJson?.message || `API Error: ${response.status} ${response.statusText}`;
      const err = new Error(message);
      err.status = response.status;
      err.data = errorJson;
      throw err;
    }

    return await response.json();
  } catch (error) {
    // Suppress transient network errors (cold-boot race, Wi-Fi roaming, VPN reconnect, signal timeout) from cluttering console
    const msg = error.message || '';
    const isTransient = msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('ERR_') || msg.includes('aborted') || msg.includes('timed out') || error.name === 'TimeoutError';
    const logFn = isTransient ? console.debug : console.warn;
    logFn(`[RESONIX Responder API] Endpoint request error: ${endpoint}`, msg);
    throw error;
  }
}

// In-flight GET request coalescing map (prevents duplicate simultaneous network requests)
const inFlightGets = new Map();

// Safe short-lived client read cache (only for static read-only endpoints, NEVER mutations or SOS)
const safeReadCache = new Map();

const CACHE_CONFIG = [
  { prefix: '/weather', ttl: 30000 },
  { prefix: '/resources', ttl: 10000 },
  { prefix: '/incidents/dashboard-summary', ttl: 5000 },
];

export const invalidateApiCache = (pattern) => {
  if (!pattern) {
    safeReadCache.clear();
    return;
  }
  for (const key of safeReadCache.keys()) {
    if (key.includes(pattern)) {
      safeReadCache.delete(key);
    }
  }
};

// Base HTTP verbs
export const api = {
  get: (endpoint, options = {}) => {
    const isFresh = options.fresh === true || options.bypassCache === true;
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

    // 1. Check safe read cache if applicable
    if (!isFresh) {
      const rule = CACHE_CONFIG.find((c) => cleanEndpoint.startsWith(c.prefix));
      if (rule) {
        const cached = safeReadCache.get(cleanEndpoint);
        if (cached && Date.now() - cached.timestamp < rule.ttl) {
          return Promise.resolve(cached.data);
        }
      }
    }

    // 2. Coalesce in-flight identical GET requests
    if (inFlightGets.has(cleanEndpoint) && !options.bypassDeduplication) {
      return inFlightGets.get(cleanEndpoint);
    }

    const requestPromise = fetchApi(endpoint, { method: 'GET', ...options })
      .then((data) => {
        // Cache if eligible
        const rule = CACHE_CONFIG.find((c) => cleanEndpoint.startsWith(c.prefix));
        if (rule) {
          safeReadCache.set(cleanEndpoint, { data, timestamp: Date.now() });
        }
        return data;
      })
      .finally(() => {
        inFlightGets.delete(cleanEndpoint);
      });

    inFlightGets.set(cleanEndpoint, requestPromise);
    return requestPromise;
  },
  post: (endpoint, body, options = {}) => {
    // Invalidate relevant cache on mutations
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    if (cleanEndpoint.startsWith('/incidents')) invalidateApiCache('/incidents');
    if (cleanEndpoint.startsWith('/resources')) invalidateApiCache('/resources');
    return fetchApi(endpoint, { method: 'POST', body: JSON.stringify(body), ...options });
  },
  put: (endpoint, body, options = {}) => {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    if (cleanEndpoint.startsWith('/incidents')) invalidateApiCache('/incidents');
    if (cleanEndpoint.startsWith('/resources')) invalidateApiCache('/resources');
    return fetchApi(endpoint, { method: 'PUT', body: JSON.stringify(body), ...options });
  },
  delete: (endpoint, options = {}) => {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    if (cleanEndpoint.startsWith('/incidents')) invalidateApiCache('/incidents');
    if (cleanEndpoint.startsWith('/resources')) invalidateApiCache('/resources');
    return fetchApi(endpoint, { method: 'DELETE', ...options });
  },
};

// 7 Standardized Shared API Endpoint Modules
export const healthApi = {
  getHealth: () => api.get('/health'),
  getStatus: () => api.get('/status'),
  getVersion: () => api.get('/version'),
};

export const authApi = {
  login: (credentials) => api.post('/auth/login', typeof credentials === 'string' ? { email: credentials } : credentials),
  registerUser: (data) => api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
  forgotPassword: (identifier) => api.post('/auth/forgot-password', { identifier }),
  resetPassword: (identifier, otpCode, newPassword) => api.post('/auth/reset-password', { identifier, otpCode, newPassword }),
  getAllUsers: () => api.get('/auth/users'),
  approveUser: (id) => api.put(`/auth/users/${id}/approve`, {}),
  rejectUser: (id) => api.put(`/auth/users/${id}/reject`, {}),
  toggleActiveUser: (id, isActive) => api.put(`/auth/users/${id}/toggle-active`, { isActive }),
};

export const citizenApi = {
  getCitizenRequests: () => api.get('/incidents'),
  getEmergencyStatus: (id) => api.get(`/emergency/status/${id}`),
};

export const incidentApi = {
  getIncidents: async (options = {}) => {
    const res = await api.get('/incidents', options);
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.data?.incidents)) return res.data.incidents;
    if (Array.isArray(res?.data?.data)) return res.data.data;
    if (Array.isArray(res?.data)) return res.data;
    if (Array.isArray(res?.incidents)) return res.incidents;
    return [];
  },
  getDashboardSummary: async (options = {}) => {
    const res = await api.get('/incidents/dashboard-summary', options);
    return res?.data || res;
  },
  createIncident: (data) => api.post('/incidents', data),
  updateIncident: (id, data) => api.put(`/incidents/${id}`, data),
  acknowledgeIncident: (id, payload = {}) => api.put(`/incidents/${id}/acknowledge`, payload),
  deleteIncident: (id) => api.delete(`/incidents/${id}`),
  clearHistory: () => api.delete('/incidents/history'),
  getFusionClusters: (options = {}) => api.get('/incidents/fusion', options),
};

export const incidentFusionApi = {
  getClusters: (status) => api.get(`/incidents/fusion${status ? `?status=${status}` : ''}`),
};

export const aiApi = {
  synthesizeReport: (data) => api.post('/ai/analyze', data),
  getReasoning: (id) => api.get(`/ai/report/${id}`),
};

export const uploadApi = {
  uploadMedia: (formData) =>
    fetchApi('/emergency/upload-photo', {
      method: 'POST',
      body: formData,
      headers: {},
    }),
};

export const notificationApi = {
  getReports: () => api.get('/reports'),
  getRelayStatus: () => api.get('/relay'),
};

export const reportApi = {
  getReports: (options = {}) => api.get('/reports', options),
  getReportById: (id) => api.get(`/reports/${id}`),
  triageReport: (data) => api.post('/reports/triage', data),
  triageReportById: (id) => api.post(`/reports/${id}/triage`, {}),
};

export const relayApi = {
  getRelayNodes: () => api.get('/relay'),
  getAnalytics: () => api.get('/relay/analytics'),
  getAnalyticsById: (id) => api.get(`/relay/analytics/${id}`),
};

export const resourceApi = {
  getResources: async (params = {}) => {
    const { signal, ...queryParams } = params;
    const query = new URLSearchParams();
    if (queryParams.search) query.set('search', queryParams.search);
    if (queryParams.status && queryParams.status !== 'ALL') query.set('status', queryParams.status);
    if (queryParams.assignedIncidentId) query.set('assignedIncidentId', queryParams.assignedIncidentId);
    if (queryParams.incidentId) query.set('incidentId', queryParams.incidentId);
    if (queryParams.page) query.set('page', queryParams.page);
    if (queryParams.limit) query.set('limit', queryParams.limit);
    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await api.get(`/resources${qs}`, signal ? { signal } : {});
    if (Array.isArray(res)) return res;
    if (Array.isArray(res?.data?.resources)) return res.data.resources;
    if (Array.isArray(res?.data)) return res.data;
    if (Array.isArray(res?.resources)) return res.resources;
    return [];
  },
  getResourceById: (id) => api.get(`/resources/${id}`),
  createResource: (data) => api.post('/resources', data),
  updateResource: (id, data) => api.put(`/resources/${id}`, data),
  assignResource: (data) => api.post('/resources/assign', data),
  releaseResource: (id) => api.post(`/resources/${id}/release`, {}),
  deleteResource: (id) => api.delete(`/resources/${id}`),
};

export const settingsApi = {
  getSettings: () => api.get('/settings'),
  updateSettings: (data) => api.put('/settings', data),
};

export const weatherApi = {
  getCurrent: (lat, lon, options = {}) =>
    api.get(`/weather/current?lat=${lat}&lon=${lon}${options.fresh ? '&fresh=true' : ''}`, options.signal ? { signal: options.signal } : {}),
  getHourlyForecast: (lat, lon, options = {}) =>
    api.get(`/weather/forecast/hourly?lat=${lat}&lon=${lon}${options.fresh ? '&fresh=true' : ''}`, options.signal ? { signal: options.signal } : {}),
  getDailyForecast: (lat, lon, options = {}) =>
    api.get(`/weather/forecast/daily?lat=${lat}&lon=${lon}${options.fresh ? '&fresh=true' : ''}`, options.signal ? { signal: options.signal } : {}),
  getWarnings: (lat, lon, options = {}) =>
    api.get(`/weather/warnings?lat=${lat}&lon=${lon}${options.fresh ? '&fresh=true' : ''}`, options.signal ? { signal: options.signal } : {}),
  getComprehensive: (lat, lon, options = {}) =>
    api.get(`/weather/comprehensive?lat=${lat}&lon=${lon}${options.fresh ? '&fresh=true' : ''}`, options.signal ? { signal: options.signal } : {}),
  lookupLocation: (query, options = {}) =>
    api.get(`/weather/lookup?q=${encodeURIComponent(query)}`, options.signal ? { signal: options.signal } : {}),
  reverseLookup: (lat, lon, options = {}) =>
    api.get(`/weather/reverse-lookup?lat=${lat}&lon=${lon}`, options.signal ? { signal: options.signal } : {}),
  askWeather: (query, lat, lon, options = {}) =>
    api.post('/weather/ask', { query, lat, lon, ...options }),
  getActiveAlerts: (lat, lon, options = {}) =>
    api.get(`/weather/alerts/active${lat != null && lon != null ? `?lat=${lat}&lon=${lon}` : ''}`, options.signal ? { signal: options.signal } : {}),
  getLocalRisk: (lat, lon, options = {}) =>
    api.get(`/weather/risk?lat=${lat}&lon=${lon}${options.fresh ? '&fresh=true' : ''}`, options.signal ? { signal: options.signal } : {}),
  getNwpForecast: (lat, lon, options = {}) =>
    api.get(`/weather/nwp/forecast?lat=${lat}&lon=${lon}${options.model ? `&model=${options.model}` : ''}${options.fresh ? '&fresh=true' : ''}`, options.signal ? { signal: options.signal } : {}),
  getNwpComparison: (lat, lon, options = {}) =>
    api.get(`/weather/nwp/compare?lat=${lat}&lon=${lon}${options.fresh ? '&fresh=true' : ''}`, options.signal ? { signal: options.signal } : {}),
  getNwpModels: (options = {}) =>
    api.get('/weather/nwp/models', options.signal ? { signal: options.signal } : {}),
  getSituationView: (lat, lon, options = {}) =>
    api.get(`/weather/situation?lat=${lat}&lon=${lon}${options.fresh ? '&fresh=true' : ''}${options.radiusKm ? `&radiusKm=${options.radiusKm}` : ''}`, options.signal ? { signal: options.signal } : {}),
};



