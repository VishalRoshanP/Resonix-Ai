/**
 * API Service Client Adapter for RESONIX AI Citizen Mobile (React Native)
 * 
 * Communicates directly with the Node.js / Express backend APIs:
 * - Authentication: Login, Register, Profile
 * - Emergency Management: Create SOS packet (POST /api/v1/emergency/create), List, Status, Enrich, Cancel
 * - Voice STT: Transcribe Audio (POST /api/v1/emergency/transcribe)
 * 
 * Includes token injection, timeout handling, and automatic fallback from 10.0.2.2 to localhost.
 * ZERO MOCK DATA: Never injects fake GPS coordinates or fake payloads.
 */

const ENV = require('../config/env');
const storage = require('../utils/storage');

class ApiService {
  constructor() {
    this.baseUrl = ENV.API_BASE_URL;
    this.fallbackUrl = ENV.FALLBACK_API_BASE_URL;
  }

  /**
   * Sets active API base URL dynamically upon successful backend reachability verification
   */
  setBaseUrl(newBaseUrl) {
    if (newBaseUrl && typeof newBaseUrl === 'string') {
      const clean = newBaseUrl.replace(/\/+$/, '');
      this.baseUrl = clean.endsWith('/api/v1') ? clean : `${clean}/api/v1`;
      console.log(`[ApiService] Base URL dynamically updated to: ${this.baseUrl}`);
    }
  }

  /**
   * Gets stored JWT authorization header
   */
  async _getAuthHeaders() {
    const token = await storage.getItem(ENV.STORAGE_KEYS.AUTH_TOKEN);
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  /**
   * Helper fetch with timeout and fallback URL handling
   */
  async _request(endpoint, options = {}) {
    const headers = await this._getAuthHeaders();
    const fetchOptions = {
      ...options,
      headers: {
        ...headers,
        ...(options.headers || {}),
      },
    };

    let primaryUrl = `${this.baseUrl}${endpoint}`;
    let fallbackUrl = `${this.fallbackUrl}${endpoint}`;

    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), options.timeoutMs || ENV.TIMEOUT_MS);

      const response = await fetch(primaryUrl, {
        ...fetchOptions,
        signal: controller.signal,
      });

      clearTimeout(id);
      return await this._parseResponse(response);
    } catch (err) {
      // Only attempt fallback if fallback URL is genuinely distinct from primary URL
      // and failure was a network connection error (not an explicit 4xx client rejection)
      const isDifferentHost = Boolean(this.fallbackUrl && this.baseUrl && this.fallbackUrl !== this.baseUrl && fallbackUrl !== primaryUrl);
      const isClientError = Boolean(err.status && err.status >= 400 && err.status < 500);

      if (isDifferentHost && !isClientError) {
        try {
          const controller2 = new AbortController();
          const id2 = setTimeout(() => controller2.abort(), options.timeoutMs || ENV.TIMEOUT_MS);

          const response2 = await fetch(fallbackUrl, {
            ...fetchOptions,
            signal: controller2.signal,
          });

          clearTimeout(id2);
          return await this._parseResponse(response2);
        } catch (fallbackErr) {
          throw err;
        }
      }

      throw err;
    }
  }

  /**
   * Parses fetch HTTP response
   */
  async _parseResponse(response) {
    let data = null;
    const text = await response.text();
    try {
      data = JSON.parse(text);
    } catch (_) {
      data = { rawText: text };
    }

    if (!response.ok) {
      const errorMsg = data?.message || data?.error || `HTTP ${response.status}: ${response.statusText}`;
      const err = new Error(errorMsg);
      err.status = response.status;
      err.data = data;
      throw err;
    }

    return data;
  }

  // ----------------------------------------------------
  // AUTHENTICATION APIs
  // ----------------------------------------------------

  /**
   * Citizen Login
   */
  async login(email, password) {
    const data = await this._request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (data.token) {
      await storage.setItem(ENV.STORAGE_KEYS.AUTH_TOKEN, data.token);
    }
    if (data.user) {
      await storage.setItem(ENV.STORAGE_KEYS.USER_PROFILE, data.user);
    }
    return data;
  }

  /**
   * Citizen Registration
   */
  async register(name, email, password, phone = '') {
    const data = await this._request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, phone, role: 'CITIZEN' }),
    });

    if (data.token) {
      await storage.setItem(ENV.STORAGE_KEYS.AUTH_TOKEN, data.token);
    }
    if (data.user) {
      await storage.setItem(ENV.STORAGE_KEYS.USER_PROFILE, data.user);
    }
    return data;
  }

  /**
   * Fetch current authenticated citizen profile
   */
  async getProfile() {
    return this._request('/auth/me', { method: 'GET' });
  }

  /**
   * Update citizen user profile
   */
  async updateProfile(userId, profileData) {
    return this._request(`/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  }

  // ----------------------------------------------------
  // EMERGENCY INCIDENT APIs
  // ----------------------------------------------------

  /**
   * Creates real emergency packet on Express backend (POST /api/v1/emergency/create)
   * Strictly no mock GPS coordinates!
   */
  async createEmergency(emergencyPacket = {}) {
    const lat = emergencyPacket.latitude != null ? Number(emergencyPacket.latitude) : emergencyPacket.gpsCoordinates?.latitude != null ? Number(emergencyPacket.gpsCoordinates.latitude) : null;
    const lng = emergencyPacket.longitude != null ? Number(emergencyPacket.longitude) : emergencyPacket.gpsCoordinates?.longitude != null ? Number(emergencyPacket.gpsCoordinates.longitude) : null;
    const hasGps = lat != null && lng != null;

    const payload = {
      packetId: emergencyPacket.packetId || `pkt_mob_${Date.now()}`,
      clientRequestId: emergencyPacket.clientRequestId || emergencyPacket.packetId || `pkt_mob_${Date.now()}`,
      category: (emergencyPacket.category || 'OTHER').toUpperCase(),
      selectedCategory: emergencyPacket.selectedCategory || emergencyPacket.category || 'OTHER',
      citizenSelectedCategory: emergencyPacket.citizenSelectedCategory || emergencyPacket.category || 'OTHER',
      secondaryHazard: emergencyPacket.secondaryHazard || null,
      coordinates: hasGps ? [lng, lat] : undefined,
      description: emergencyPacket.description || emergencyPacket.text || `${emergencyPacket.category || 'Emergency'} reported from Citizen Mobile`,
      transcript: emergencyPacket.transcript || emergencyPacket.description || '',
      voiceTranscript: emergencyPacket.voiceTranscript || emergencyPacket.transcript || '',
      originalTranscript: emergencyPacket.originalTranscript || emergencyPacket.transcript || '',
      nativeScriptTranscript: emergencyPacket.nativeScriptTranscript || null,
      englishTranslation: emergencyPacket.englishTranslation || null,
      detectedLanguage: emergencyPacket.detectedLanguage || emergencyPacket.selectedVoiceLanguage || null,
      detectedLanguageCode: emergencyPacket.detectedLanguageCode || emergencyPacket.selectedVoiceLanguageCode || null,
      selectedVoiceLanguage: emergencyPacket.selectedVoiceLanguage || null,
      selectedVoiceLanguageCode: emergencyPacket.selectedVoiceLanguageCode || null,
      audioData: emergencyPacket.audioData || emergencyPacket.audioReference?.audioData || null,
      mimeType: emergencyPacket.mimeType || emergencyPacket.audioReference?.mimeType || 'audio/mp4',
      victimName: emergencyPacket.victimName || emergencyPacket.citizenName || 'Citizen User',
      deviceId: emergencyPacket.deviceId || 'REACT_NATIVE_ANDROID_CLIENT',
      latitude: lat,
      longitude: lng,
      gpsCoordinates: {
        hasGps,
        latitude: lat,
        longitude: lng,
        accuracy: emergencyPacket.gpsCoordinates?.accuracy || emergencyPacket.accuracy || null,
        sector: emergencyPacket.sector || (hasGps ? `GPS: ${lat.toFixed(4)}, ${lng.toFixed(4)}` : 'Live Telemetry Sector'),
      },
      photoReference: emergencyPacket.photoReference || { hasPhoto: false },
      audioReference: emergencyPacket.audioReference || { hasAudio: false },
      timestamp: emergencyPacket.timestamp || new Date().toISOString(),
      sourceDeviceId: emergencyPacket.sourceDeviceId || emergencyPacket.originDevice || emergencyPacket.deviceId || 'REACT_NATIVE_ANDROID_CLIENT',
      originDevice: emergencyPacket.originDevice || emergencyPacket.sourceDeviceId || emergencyPacket.deviceId || 'REACT_NATIVE_ANDROID_CLIENT',
      hopCount: emergencyPacket.hopCount != null ? Number(emergencyPacket.hopCount) : 0,
      relayCount: emergencyPacket.relayCount != null ? Number(emergencyPacket.relayCount) : (emergencyPacket.hopCount ? Number(emergencyPacket.hopCount) : 0),
      isRelayed: Boolean(emergencyPacket.hopCount && Number(emergencyPacket.hopCount) > 0),
      meshHops: Array.isArray(emergencyPacket.meshHops) ? emergencyPacket.meshHops : [],
      ttl: emergencyPacket.ttl != null ? Number(emergencyPacket.ttl) : 7,
      checksum: emergencyPacket.checksum || null,
      relayMetadata: emergencyPacket.relayMetadata || {
        relayCount: emergencyPacket.hopCount || 0,
        relayHistory: Array.isArray(emergencyPacket.relayHistory) ? emergencyPacket.relayHistory : [],
        originDevice: emergencyPacket.sourceDeviceId || emergencyPacket.originDevice || emergencyPacket.deviceId || 'REACT_NATIVE_ANDROID_CLIENT',
      },
      relayHistory: Array.isArray(emergencyPacket.relayHistory)
        ? emergencyPacket.relayHistory
        : Array.isArray(emergencyPacket.relayMetadata?.relayHistory)
        ? emergencyPacket.relayMetadata.relayHistory
        : [],
    };

    return this._request('/emergency/create', {
      method: 'POST',
      body: JSON.stringify(payload),
      timeoutMs: 6000,
    });
  }

  /**
   * Asynchronous non-blocking emergency enrichment (voice, photo, translation)
   */
  async enrichEmergency(packetId, enrichPayload = {}) {
    return this._request(`/emergency/${packetId}`, {
      method: 'PATCH',
      body: JSON.stringify(enrichPayload),
    });
  }

  /**
   * Cancel an emergency request
   */
  async cancelSOS(packetId) {
    return this._request(`/incidents/${packetId}`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'cancelled' }),
    });
  }

  /**
   * Retrieve emergency packet status by ID
   */
  async getEmergencyStatus(id) {
    return this._request(`/emergency/status/${id}`, { method: 'GET' });
  }

  /**
   * Fetches reported emergencies history
   */
  async getEmergencies() {
    try {
      return await this._request('/emergency/list', { method: 'GET' });
    } catch (err) {
      try {
        return await this._request('/emergency/history', { method: 'GET' });
      } catch (_) {
        throw err;
      }
    }
  }

  /**
   * Multilingual STT Audio Transcription via Express Backend (Gemini / Sarvam Saaras)
   */
  async transcribeAudio(audioData, mimeType = 'audio/mp4', durationSeconds = 5, languageHint = null, transcript = '') {
    const cleanHint = (languageHint && languageHint !== 'AUTO') ? languageHint : null;
    return this._request('/emergency/transcribe', {
      method: 'POST',
      body: JSON.stringify({
        audioData,
        dataUrl: audioData,
        mimeType,
        durationSeconds,
        languageHint: cleanHint,
        transcript: transcript || '',
      }),
      timeoutMs: 45000,
    });
  }

  /**
   * Weather Intelligence APIs (SIH26068)
   * Real meteorological data ingested by backend worker.
   * Zero API keys exposed to mobile application.
   */
  async getWeatherCurrent(lat, lon, fresh = false) {
    return this._request(`/weather/current?lat=${lat}&lon=${lon}${fresh ? '&fresh=true' : ''}`, { method: 'GET' });
  }

  async getWeatherHourly(lat, lon, fresh = false) {
    return this._request(`/weather/forecast/hourly?lat=${lat}&lon=${lon}${fresh ? '&fresh=true' : ''}`, { method: 'GET' });
  }

  async getWeatherDaily(lat, lon, fresh = false) {
    return this._request(`/weather/forecast/daily?lat=${lat}&lon=${lon}${fresh ? '&fresh=true' : ''}`, { method: 'GET' });
  }

  async getWeatherWarnings(lat, lon, fresh = false) {
    return this._request(`/weather/warnings?lat=${lat}&lon=${lon}${fresh ? '&fresh=true' : ''}`, { method: 'GET' });
  }

  async getWeatherComprehensive(lat, lon, fresh = false) {
    return this._request(`/weather/comprehensive?lat=${lat}&lon=${lon}${fresh ? '&fresh=true' : ''}`, { method: 'GET' });
  }

  async searchWeatherLocation(query) {
    return this._request(`/weather/lookup?q=${encodeURIComponent(query)}`, { method: 'GET' });
  }

  async reverseLookupWeatherLocation(lat, lon) {
    return this._request(`/weather/reverse-lookup?lat=${lat}&lon=${lon}`, { method: 'GET' });
  }

  async askWeather(query, lat, lon, options = {}) {
    return this._request('/weather/ask', {
      method: 'POST',
      body: JSON.stringify({ query, lat, lon, ...options }),
    });
  }
}

const apiService = new ApiService();
module.exports = apiService;
