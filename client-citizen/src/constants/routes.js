// Route path constants — Single source of truth for Citizen Application
export const ROUTES = {
  // Portal Landing Entry
  LANDING: '/',

  // Citizen Application Core Routes
  CITIZEN_ROOT: '/citizen',
  CITIZEN_LOGIN: '/citizen/login',
  CITIZEN_REGISTER: '/citizen/register',
  CITIZEN_HOME: '/citizen/home',
  CITIZEN_PROFILE: '/citizen/profile',
  CITIZEN_SETTINGS: '/citizen/settings',
  CITIZEN_STATUS: '/citizen/status',

  // Legacy & Alias Shortcuts (Preserved for Navigation Fidelity)
  CITIZEN: '/citizen',
  LOGIN: '/citizen/login',
  REGISTER: '/citizen/register',
  HOME: '/citizen/home',
  PROFILE: '/citizen/profile',
  SETTINGS: '/citizen/settings',
  STATUS: '/citizen/status',
  SOS: '/sos',
  VOICE_RELAY: '/voice-relay',
  EMERGENCY_GUIDE: '/emergency-guide',
  LANGUAGE_SELECTION: '/language-selection',
  PERMISSIONS: '/permissions',
};
