import { tokenManager } from './tokenManager.js';
import { resolveConfiguredApiBaseUrl } from '../utils/env.js';

/**
 * Resolves the appropriate Base API URL depending on web vs native Android container
 */
export function getApiBaseUrl() {
  return resolveConfiguredApiBaseUrl();
}

/**
 * Generic HTTP fetch wrapper for client-citizen with Request & Response Interceptors.
 * Connects to the single shared Express backend on port 5000.
 */
async function request(endpoint, options = {}) {
  const baseUrl = getApiBaseUrl();
  const url = endpoint.startsWith('http') ? endpoint : `${baseUrl}${endpoint}`;
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
  // Attach 15-Second Network Timeout via AbortController
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
      console.error('==================================================');
      console.error('❌ [RESONIX CITIZEN API ERROR RESPONSE]');
      console.error(`• API URL:        ${url}`);
      console.error(`• HTTP Method:    ${method}`);
      console.error(`• Status Code:    ${response.status}`);
      console.error(`• Request Body:  `, requestBody);
      console.error(`• Error Response: `, json || message);
      console.error('==================================================');

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
      console.warn('[SOS] Request timed out after 15 seconds. Unable to contact the server.');
      const timeoutErr = new Error('Unable to contact the server.');
      timeoutErr.isTimeout = true;
      throw timeoutErr;
    }
    console.error('==================================================');
    console.error('💥 [RESONIX CITIZEN API EXECUTION FAILURE]');
    console.error(`• API URL:        ${url}`);
    console.error(`• HTTP Method:    ${method}`);
    console.error(`• Request Body:  `, requestBody);
    console.error(`• Error Response: `, error.message || error);
    console.error('==================================================');
    throw error;
  }
}

/**
 * Mock delay helper for offline development
 */
export async function mockResponse(data, delayMs = 150) {
  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  return data;
}

// Base HTTP verbs
export const api = {
  get: (endpoint) => request(endpoint, { method: 'GET' }),
  post: (endpoint, data) => request(endpoint, { method: 'POST', body: JSON.stringify(data) }),
  put: (endpoint, data) => request(endpoint, { method: 'PUT', body: JSON.stringify(data) }),
  patch: (endpoint, data) => request(endpoint, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (endpoint) => request(endpoint, { method: 'DELETE' }),
  mock: mockResponse,
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
  sendSOS: (emergencyData) => api.post('/emergency/create', emergencyData),
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

export const notificationApi = {
  getReports: () => api.get('/reports'),
  getRelayStatus: () => api.get('/relay'),
};
