import { tokenManager } from './tokenManager';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

/**
 * Generic HTTP fetch wrapper for client-responder with Request & Response Interceptors.
 * Connects to the single shared Express backend on port 5000.
 */
async function fetchApi(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;

  // 1. Request Interceptor: Attach Responder JWT Token
  const token = tokenManager.getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
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
    console.warn(`[RESONIX Responder API] Endpoint request error: ${endpoint}`, error.message);
    throw error;
  }
}

// Base HTTP verbs
export const api = {
  get: (endpoint) => fetchApi(endpoint, { method: 'GET' }),
  post: (endpoint, body) => fetchApi(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  put: (endpoint, body) => fetchApi(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (endpoint) => fetchApi(endpoint, { method: 'DELETE' }),
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
  getIncidents: () => api.get('/incidents'),
  createIncident: (data) => api.post('/incidents', data),
  updateIncident: (id, data) => api.put(`/incidents/${id}`, data),
  deleteIncident: (id) => api.delete(`/incidents/${id}`),
  clearHistory: () => api.delete('/incidents/history'),
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

export const relayApi = {
  getRelayNodes: () => api.get('/relay'),
  getAnalytics: () => api.get('/relay/analytics'),
  getAnalyticsById: (id) => api.get(`/relay/analytics/${id}`),
};
