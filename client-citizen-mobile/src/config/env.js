/**
 * Environment & Application Configuration for RESONIX AI Citizen Mobile (React Native)
 * 
 * SINGLE SOURCE OF TRUTH FOR MOBILE BACKEND ORIGIN:
 * - Local development:      'http://localhost:5000' (Android emulator auto-maps to 10.0.2.2)
 * - Production deployment:  'https://resonix-server.onrender.com'
 */

// ============================================================================
// EDIT ONLY THIS SINGLE URL WHEN SWITCHING ENVIRONMENTS:
// ============================================================================
const BACKEND_URL = 'http://localhost:5000';

// ----------------------------------------------------------------------------
// Internal Origin Resolution (Do NOT edit below this line)
// ----------------------------------------------------------------------------
const cleanBackend = BACKEND_URL
  .replace(/\/api\/v1\/?$/, '')
  .replace(/\/+$/, '');

// Detect if running against a local host (localhost / 127.0.0.1)
const isLocalhost = /localhost|127\.0\.0\.1/.test(cleanBackend);

// Detect Android platform safely (handles React Native runtime and non-RN environments)
let isAndroid = true;
let scriptHost = null;
try {
  const { Platform, NativeModules } = require('react-native');
  if (Platform && Platform.OS) {
    isAndroid = Platform.OS === 'android';
  }
  const scriptURL = NativeModules?.SourceCode?.scriptURL;
  if (scriptURL) {
    const match = scriptURL.match(/^https?:\/\/([^:/]+)/);
    if (match && match[1] && !/localhost|127\.0\.0\.1/.test(match[1])) {
      scriptHost = match[1];
    }
  }
} catch (_) {
  // Non-RN environments default to Android
}

// Android emulator uses 10.0.2.2 to access host machine's localhost; production uses exact BACKEND_URL
const primaryOrigin = isLocalhost && isAndroid
  ? (scriptHost ? `http://${scriptHost}:5000` : cleanBackend.replace(/localhost|127\.0\.0\.1/, '10.0.2.2'))
  : cleanBackend;

const fallbackOrigin = cleanBackend;

// Candidate origins to test for real backend reachability
const CANDIDATE_ORIGINS = [];
if (isLocalhost) {
  if (scriptHost) CANDIDATE_ORIGINS.push(`http://${scriptHost}:5000`);
  if (isAndroid) CANDIDATE_ORIGINS.push('http://10.0.2.2:5000');
  CANDIDATE_ORIGINS.push('http://localhost:5000');
  CANDIDATE_ORIGINS.push('http://127.0.0.1:5000');
} else if (cleanBackend) {
  CANDIDATE_ORIGINS.push(cleanBackend);
}

// 8 Canonical Major Categories (100% parity with Citizen Web EmergencyReportModal)
const EMERGENCY_CATEGORIES = [
  { id: 'FLOOD', label: 'Flood / Water', shortLabel: 'Flood', badge: '\u{1F30A}', color: '#3B82F6' },
  { id: 'FIRE', label: 'Fire', shortLabel: 'Fire', badge: '\u{1F525}', color: '#EF4444' },
  { id: 'MEDICAL', label: 'Medical', shortLabel: 'Medical', badge: '\u{2795}', color: '#10B981' },
  { id: 'BUILDING_COLLAPSE', label: 'Building Collapse', shortLabel: 'Collapse', badge: '\u{1F3DA}\u{FE0F}', color: '#F59E0B' },
  { id: 'STORM', label: 'Cyclone / Storm', shortLabel: 'Cyclone', badge: '\u{1F32A}\u{FE0F}', color: '#8B5CF6' },
  { id: 'EARTHQUAKE', label: 'Earthquake', shortLabel: 'Earthquake', badge: '\u{26A0}\u{FE0F}', color: '#EC4899' },
  { id: 'LANDSLIDE', label: 'Landslide', shortLabel: 'Landslide', badge: '\u{1F3D4}\u{FE0F}', color: '#D97706' },
  { id: 'OTHER', label: 'Other Hazard', shortLabel: 'Other', badge: '\u{26A1}', color: '#6B7280' },
];

// 15 Secondary Hazards (NDMA Taxonomy ? 100% parity with Citizen Web)
const SECONDARY_HAZARD_CATEGORIES = [
  { id: 'TSUNAMI', label: 'Tsunami', badge: '\u{1F30A}' },
  { id: 'AVALANCHE', label: 'Avalanche', badge: '\u{2744}\u{FE0F}' },
  { id: 'LIGHTNING', label: 'Lightning', badge: '\u{26A1}' },
  { id: 'THUNDERSTORM', label: 'Thunderstorm / Squall', badge: '\u{26C8}\u{FE0F}' },
  { id: 'DUSTSTORM', label: 'Duststorm', badge: '\u{1F32A}\u{FE0F}' },
  { id: 'HEATWAVE', label: 'Heat Wave', badge: '\u{1F321}\u{FE0F}' },
  { id: 'COLDWAVE', label: 'Cold Wave', badge: '\u{1F9CA}' },
  { id: 'DROUGHT', label: 'Drought', badge: '\u{1F3DC}\u{FE0F}' },
  { id: 'FOREST_FIRE', label: 'Forest Fire', badge: '\u{1F332}\u{1F525}' },
  { id: 'URBAN_FLOOD', label: 'Urban Flood', badge: '\u{1F3E2}\u{1F30A}' },
  { id: 'CHEMICAL_EMERGENCY', label: 'Chemical Emergency', badge: '\u{2623}\u{FE0F}' },
  { id: 'BIOLOGICAL_EMERGENCY', label: 'Biological Emergency', badge: '\u{1F9A0}' },
  { id: 'NUCLEAR_RADIOLOGICAL_EMERGENCY', label: 'Nuclear / Radiation', badge: '\u{2622}\u{FE0F}' },
  { id: 'AIR_POLLUTION_SMOG', label: 'Air Pollution / Smog', badge: '\u{1F32B}\u{FE0F}' },
  { id: 'OTHER', label: 'Other (Unlisted)', badge: '\u{26A0}\u{FE0F}' },
];

// Contextual Mapping from Primary Category to NDMA Secondary Hazards
const CATEGORY_HAZARD_MAP = {
  FLOOD: ['URBAN_FLOOD', 'TSUNAMI', 'DROUGHT'],
  FIRE: ['FOREST_FIRE', 'CHEMICAL_EMERGENCY'],
  STORM: ['THUNDERSTORM', 'LIGHTNING', 'DUSTSTORM'],
  EARTHQUAKE: ['TSUNAMI', 'AVALANCHE'],
  LANDSLIDE: ['AVALANCHE'],
  BUILDING_COLLAPSE: ['CHEMICAL_EMERGENCY'],
  MEDICAL: ['BIOLOGICAL_EMERGENCY', 'HEATWAVE', 'COLDWAVE'],
  OTHER: [
    'HEATWAVE',
    'COLDWAVE',
    'DROUGHT',
    'CHEMICAL_EMERGENCY',
    'BIOLOGICAL_EMERGENCY',
    'NUCLEAR_RADIOLOGICAL_EMERGENCY',
    'AIR_POLLUTION_SMOG',
    'OTHER',
  ],
};

const ENV = {
  API_BASE_URL: `${primaryOrigin}/api/v1`,
  FALLBACK_API_BASE_URL: `${fallbackOrigin}/api/v1`,
  SOCKET_URL: primaryOrigin,

  TIMEOUT_MS: 15000,

  STORAGE_KEYS: {
    AUTH_TOKEN: '@resonix_citizen_auth_token',
    USER_PROFILE: '@resonix_citizen_user_profile',
    GUEST_SESSION: '@resonix_citizen_guest_session',
    OFFLINE_QUEUE: '@resonix_citizen_offline_queue',
    INCIDENT_HISTORY: '@resonix_citizen_incident_history',
    ACTIVE_INCIDENT: '@resonix_citizen_active_incident',
    THEME_MODE: '@resonix_theme_mode',
    SETTINGS: '@resonix_citizen_settings',
    DEVICE_ID: '@resonix_citizen_device_id',
  },

  EMERGENCY_CATEGORIES,
  SECONDARY_HAZARD_CATEGORIES,
  CATEGORY_HAZARD_MAP,
  CANDIDATE_ORIGINS,
};

module.exports = ENV;
