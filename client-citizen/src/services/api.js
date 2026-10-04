import { tokenManager } from './tokenManager.js';
import { resolveConfiguredApiBaseUrl, resolveBackendUrl } from '../utils/env.js';

/**
 * Resolves the appropriate Base API URL depending on web vs native Android container
 */
export function getApiBaseUrl() {
  return resolveConfiguredApiBaseUrl();
}

/**
 * Resolves the backend origin URL (without /api/v1) for Socket.IO and asset endpoints
 */
export function getBackendUrl() {
  return resolveBackendUrl();
}

/**
 * Generic HTTP fetch wrapper for client-citizen with Request & Response Interceptors.
 * Connects to the single shared Express backend on port 5000.
 */
async function request(endpoint, options = {}) {
  const baseUrl = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${cleanEndpoint}`;
  const method = (options.method || 'GET').toUpperCase();
  
  let requestBody = null;
  if (options.body) {
    try {
      requestBody = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;
    } catch (_) {
      requestBody = options.body;
    }
  }

  // 1. PRE-REQUEST LOGGING REQUIREMENT
  console.log('==================================================');
  console.log('🚀 [RESONIX CITIZEN API REQUEST INITIATED]');
  console.log(`• API URL:     ${url}`);
  console.log(`• HTTP Method: ${method}`);
  console.log(`• Request Body:`, requestBody);
  console.log('==================================================');

  // Request Interceptor: Attach JWT Token if available
  // Attach 15-Second Network Timeout via AbortController (Fast Backend Responses < 50ms)
  const controller = new AbortController();
  const timeoutMs = options.timeout || 15000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  const token = tokenManager.getToken();
  const config = {
    signal: controller.signal,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  };

  try {
    console.log('[SOS] Waiting Response');
    const response = await fetch(url, config);
    clearTimeout(timeoutId);
    console.log('[SOS] Response Received');

    // Response Interceptor: Handle 401 Unauthorized / Token Expiration
    if (response.status === 401 && !endpoint.includes('/auth/login')) {
      console.warn(`[RESONIX Citizen API] Intercepted 401 Unauthorized on: ${endpoint}. Invalidating session token.`);
      tokenManager.clearAll();
    }

    const json = await response.json().catch(() => null);

    if (!response.ok) {
      const message = json?.message || (typeof json?.errors === 'string' ? json.errors : null) || json?.error || `API Error: ${response.status} ${response.statusText}`;
      const err = new Error(message);
      err.status = response.status;
      err.data = json;

      // 2a. ERROR RESPONSE LOGGING REQUIREMENT
      if (!endpoint.includes('/emergency/status')) {
        console.error('==================================================');
        console.error('❌ [RESONIX CITIZEN API ERROR RESPONSE]');
        console.error(`• API URL:        ${url}`);
        console.error(`• HTTP Method:    ${method}`);
        console.error(`• Status Code:    ${response.status}`);
        console.error(`• Request Body:  `, requestBody);
        console.error(`• Error Response: `, json || message);
        console.error('==================================================');
      } else {
        console.warn(`[RESONIX Citizen API] Background status polling notice (${response.status}): ${message}`);
      }

      throw err;
    }

    // 2b. SUCCESS RESPONSE LOGGING REQUIREMENT
    console.log('==================================================');
    console.log('✅ [RESONIX CITIZEN API SUCCESS RESPONSE]');
    console.log(`• API URL:          ${url}`);
    console.log(`• HTTP Method:      ${method}`);
    console.log(`• Status Code:      ${response.status}`);
    console.log(`• Success Response:`, json);
    console.log('==================================================');

    return json;
  } catch (error) {
    if (error.name === 'AbortError') {
      console.warn(`[SOS] Request timed out after ${Math.round(timeoutMs / 1000)} seconds. Unable to contact the server.`);
      const timeoutErr = new Error('Network timeout: Unable to contact the server.');
      timeoutErr.isTimeout = true;
      timeoutErr.status = 408;
      throw timeoutErr;
    }
    if (!endpoint.includes('/emergency/status')) {
      console.error('==================================================');
      console.error('💥 [RESONIX CITIZEN API EXECUTION FAILURE]');
      console.error(`• API URL:        ${url}`);
      console.error(`• HTTP Method:    ${method}`);
      console.error(`• Request Body:  `, requestBody);
      console.error(`• Error Response: `, error.message || error);
      console.error('==================================================');
    }
    throw error;
  }
}

// Base HTTP verbs
export const api = {
  get: (endpoint, options) => request(endpoint, { method: 'GET', ...options }),
  post: (endpoint, data, options) => request(endpoint, { method: 'POST', body: JSON.stringify(data), ...options }),
  put: (endpoint, data, options) => request(endpoint, { method: 'PUT', body: JSON.stringify(data), ...options }),
  patch: (endpoint, data, options) => request(endpoint, { method: 'PATCH', body: JSON.stringify(data), ...options }),
  delete: (endpoint, options) => request(endpoint, { method: 'DELETE', ...options }),
};

// 7 Standardized Shared API Endpoint Modules
export const healthApi = {
  getHealth: () => api.get('/health'),
  getStatus: () => api.get('/status'),
  getVersion: () => api.get('/version'),
};

export const authApi = {
  login: (credentials) => api.post('/auth/login', credentials),
  register: (data) => api.post('/auth/register', data),
  logout: () => api.post('/auth/logout'),
  getMe: () => api.get('/auth/me'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.post('/auth/reset-password', { token, password }),
};

export const userApi = {
  getUser: (id) => api.get(`/users/${id}`),
  updateUser: (id, data) => api.put(`/users/${id}`, data),
  updateLanguage: (id, language) => api.put(`/users/${id}/language`, { language }),
};

export const citizenApi = {
  sendSOS: (emergencyData, options = {}) => api.post('/emergency/create', emergencyData, { timeout: 4000, ...options }),
  enrichEmergency: (id, data, options = {}) => api.patch(`/emergency/${id}`, data, options),
  syncOffline: (packets) => api.post('/offline/sync', packets),
  uploadRelay: (payload) => api.post('/relay/upload', payload),
  getEmergencyStatus: (id) => api.get(`/emergency/status/${id}`),
  getIncidentStatus: (id) => api.get(`/emergency/status/${id}`),
  cancelSOS: (packetId) => api.put(`/incidents/${packetId}`, { status: 'cancelled' }),
};

export const incidentApi = {
  getIncidents: () => api.get('/incidents'),
  getIncidentById: (id) => api.get(`/incidents/${id}`),
};

export const aiApi = {
  synthesizeReport: (data) => api.post('/ai/analyze', data),
  getReasoning: (id) => api.get(`/ai/report/${id}`),
  processGemmaLanguage: (transcript) => api.post('/ai/gemma-language', { transcript }),
};

export const uploadApi = {
  uploadMedia: (formData) =>
    request('/emergency/upload-photo', {
      method: 'POST',
      body: formData,
      headers: {}, // Let browser set multipart/form-data boundary
    }),
};

export const feedbackApi = {
  submitFeedback: (feedbackData) => api.post('/feedback', feedbackData),
  getAllFeedback: () => api.get('/feedback'),
};

export const settingsApi = {
  getSettings: () => api.get('/settings'),
  updateSettings: (settingsData) => api.put('/settings', settingsData),
};

export const notificationApi = {
  getReports: () => api.get('/reports'),
  getRelayStatus: () => api.get('/relay'),
};

export const weatherApi = {
  getCurrent: (lat, lon, options = {}) =>
    api.get(`/weather/current?lat=${lat}&lon=${lon}${options.fresh ? '&fresh=true' : ''}`),
  getHourlyForecast: (lat, lon, options = {}) =>
    api.get(`/weather/forecast/hourly?lat=${lat}&lon=${lon}${options.fresh ? '&fresh=true' : ''}`),
  getDailyForecast: (lat, lon, options = {}) =>
    api.get(`/weather/forecast/daily?lat=${lat}&lon=${lon}${options.fresh ? '&fresh=true' : ''}`),
  getWarnings: (lat, lon, options = {}) =>
    api.get(`/weather/warnings?lat=${lat}&lon=${lon}${options.fresh ? '&fresh=true' : ''}`),
  getComprehensive: (lat, lon, options = {}) =>
    api.get(`/weather/comprehensive?lat=${lat}&lon=${lon}${options.fresh ? '&fresh=true' : ''}`),
  lookupLocation: (query) =>
    api.get(`/weather/lookup?q=${encodeURIComponent(query)}`),
  reverseLookup: (lat, lon) =>
    api.get(`/weather/reverse-lookup?lat=${lat}&lon=${lon}`),
  askWeather: (query, lat, lon, options = {}) =>
    api.post('/weather/ask', { query, lat, lon, ...options }, { timeout: 30000 }),
  queryVoiceWeather: (payload) =>
    api.post('/weather/voice/query', payload),
  getHistoricalWeather: (lat, lon, options = {}) =>
    api.get(`/weather/historical?lat=${lat}&lon=${lon}${options.year ? `&year=${options.year}` : ''}`),
  getMonthlyHistorical: (lat, lon, options = {}) =>
    api.get(`/weather/historical/monthly?lat=${lat}&lon=${lon}${options.year ? `&year=${options.year}` : ''}`),
  getClimateTrends: (lat, lon, options = {}) =>
    api.get(`/weather/climate-trends?lat=${lat}&lon=${lon}${options.years ? `&years=${options.years.join(',')}` : ''}${options.yearsCount ? `&yearsCount=${options.yearsCount}` : ''}`),
  getNwpForecast: (lat, lon, options = {}) =>
    api.get(`/weather/nwp/forecast?lat=${lat}&lon=${lon}&model=${options.model || 'gfs'}${options.days ? `&days=${options.days}` : ''}${options.fresh ? '&fresh=true' : ''}`),
  getNwpComparison: (lat, lon, options = {}) =>
    api.get(`/weather/nwp/compare?lat=${lat}&lon=${lon}${options.days ? `&days=${options.days}` : ''}${options.fresh ? '&fresh=true' : ''}`),
  getNwpModels: () =>
    api.get('/weather/nwp/models'),
  getLocalWeatherRisk: (lat, lon, options = {}) =>
    api.get(`/weather/risk?lat=${lat}&lon=${lon}${options.radiusKm ? `&radiusKm=${options.radiusKm}` : ''}${options.fresh ? '&fresh=true' : ''}`),
};

export const weatherAlertApi = {
  getActiveAlerts: (lat, lon) =>
    api.get(`/weather/alerts/active${lat != null && lon != null ? `?lat=${lat}&lon=${lon}` : ''}`),
  getLatestWarning: (lat, lon) =>
    api.get(`/weather/alerts/latest${lat != null && lon != null ? `?lat=${lat}&lon=${lon}` : ''}`),
  getAlertHistory: (options = {}) => {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', options.limit);
    if (options.alertType) params.set('alertType', options.alertType);
    if (options.status) params.set('status', options.status);
    const qs = params.toString();
    return api.get(`/weather/alerts/history${qs ? `?${qs}` : ''}`);
  },
  explainAlert: (alert, alertId, language = 'en') =>
    api.post('/weather/alerts/explain', { alert, alertId, language }),
};
