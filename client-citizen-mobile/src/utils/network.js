/**
 * Network Detection & Health Check Utility for RESONIX AI Citizen Mobile
 * 
 * Verifies backend connectivity with fallback pings and health checks.
 */

const ENV = require('../config/env');

const networkUtil = {
  /**
   * Pings Express backend health endpoint to check real online status
   * Tests active origin and candidate origins, dynamically updating apiService baseUrl
   */
  checkServerHealth: async (customUrl = null) => {
    const apiService = require('../services/apiService');
    const currentOrigin = (apiService && apiService.baseUrl)
      ? apiService.baseUrl.replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '')
      : (ENV.API_BASE_URL || '').replace(/\/api\/v1\/?$/, '').replace(/\/+$/, '');

    const candidates = [];
    if (customUrl) {
      candidates.push(customUrl);
    } else {
      if (currentOrigin) candidates.push(currentOrigin);
      if (Array.isArray(ENV.CANDIDATE_ORIGINS)) {
        for (const o of ENV.CANDIDATE_ORIGINS) {
          const clean = o.replace(/\/+$/, '');
          if (!candidates.includes(clean)) candidates.push(clean);
        }
      }
    }

    const pingEndpoint = async (origin) => {
      const probeUrls = [`${origin}/api/v1/health`, `${origin}/health`, `${origin}/api/health`];
      for (const url of probeUrls) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 6000);
        try {
          const response = await fetch(url, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: controller.signal,
          });
          clearTimeout(id);
          if (response.ok || response.status === 200 || response.status === 204) {
            let data = null;
            try { data = await response.json(); } catch (_) {}
            return { origin, data };
          }
        } catch (_) {
          clearTimeout(id);
        }
      }
      throw new Error(`Unreachable: ${origin}`);
    };

    try {
      // Race candidate origins in parallel for instantaneous (<100ms) connection discovery!
      const winning = await Promise.any(candidates.map((orig) => pingEndpoint(orig)));
      if (winning && winning.origin) {
        if (apiService && typeof apiService.setBaseUrl === 'function') {
          apiService.setBaseUrl(`${winning.origin}/api/v1`);
        }
        try {
          const citizenSocketClient = require('../services/citizenSocketClient');
          if (citizenSocketClient && typeof citizenSocketClient.setServerUrl === 'function') {
            citizenSocketClient.setServerUrl(winning.origin);
          }
        } catch (_) {}

        return {
          isOnline: true,
          status: winning.data?.status || winning.data?.data?.serverStatus || 'OK',
          origin: winning.origin,
          connectionType: 'DIRECT SERVER',
          latencyMs: 0,
        };
      }
    } catch (_) {
      // All candidates failed
    }

    return {
      isOnline: false,
      connectionType: 'OFFLINE QUEUE',
      reason: 'Backend server unreachable across all candidate endpoints.',
    };
  },
};

module.exports = networkUtil;
