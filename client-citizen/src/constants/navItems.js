import { ROUTES } from './routes';

// Navigation items for Sidebar & MobileBottomNav — single source of truth
export const SIDEBAR_NAV_ITEMS = [
  { label: 'Dashboard', icon: 'dashboard', path: ROUTES.DASHBOARD },
  { label: 'Map', icon: 'map', path: ROUTES.MAP },
  { label: 'Intelligence', icon: 'psychology', path: ROUTES.INTELLIGENCE },
  { label: 'Active Incidents', icon: 'warning', path: ROUTES.INCIDENT },
  { label: 'Personnel', icon: 'groups', path: ROUTES.PERSONNEL },
  { label: 'Logistics', icon: 'inventory_2', path: ROUTES.LOGISTICS },
  { label: 'Analytics', icon: 'analytics', path: ROUTES.ANALYTICS },
  { label: 'System Health', icon: 'monitor_heart', path: ROUTES.DIAGNOSTICS },
  { label: 'Incident Timeline', icon: 'history', path: ROUTES.CRISIS_LOG },
];

export const MOBILE_NAV_ITEMS = [
  { label: 'Dashboard', icon: 'dashboard', path: ROUTES.DASHBOARD },
  { label: 'Map', icon: 'map', path: ROUTES.MAP },
  // Center position is reserved for Voice Relay FAB
  { label: 'Intelligence', icon: 'psychology', path: ROUTES.INTELLIGENCE },
  { label: 'Relay', icon: 'hub', path: ROUTES.OFFLINE_RELAY },
];

export const SECONDARY_NAV_ITEMS = [
  { label: 'Documentation', icon: 'description', path: ROUTES.EMERGENCY_GUIDE },
  { label: 'Settings', icon: 'settings', path: ROUTES.SETTINGS },
];

