/**
 * RESONIX AI — Centralized Map Incident Normalization & Visual Styling
 * 
 * Provides:
 * 1. normalizeIncidentForMap(incident): Single authoritative normalization layer.
 * 2. getAuthoritativeIncidentCategory(incident): Strict logical priority for final verified category.
 * 3. getIncidentCategoryStyle(category): Unified category -> visual mapping.
 * 4. calculateClusterComposition(memberIncidents): Real category breakdown for multi-incident clusters.
 */

export const CANONICAL_MAP_CATEGORIES = new Set([
  'FIRE',
  'FLOOD',
  'MEDICAL',
  'BUILDING_COLLAPSE',
  'CYCLONE_STORM',
  'EARTHQUAKE',
  'LANDSLIDE',
  'TSUNAMI',
  'AVALANCHE',
  'LIGHTNING',
  'THUNDERSTORM',
  'DUSTSTORM',
  'SQUALL',
  'HEATWAVE',
  'COLDWAVE',
  'DROUGHT',
  'FOREST_FIRE',
  'URBAN_FLOOD',
  'CHEMICAL_EMERGENCY',
  'BIOLOGICAL_EMERGENCY',
  'NUCLEAR_RADIOLOGICAL_EMERGENCY',
  'AIR_POLLUTION_SMOG',
  'OTHER',
  'RESOLVED',
]);

/**
 * Normalizes any category string or alias to one of the canonical categories:
 * FIRE, FLOOD, MEDICAL, BUILDING_COLLAPSE, CYCLONE_STORM, EARTHQUAKE, LANDSLIDE,
 * TSUNAMI, AVALANCHE, LIGHTNING, THUNDERSTORM, DUSTSTORM, SQUALL, HEATWAVE,
 * COLDWAVE, DROUGHT, FOREST_FIRE, URBAN_FLOOD, CHEMICAL_EMERGENCY,
 * BIOLOGICAL_EMERGENCY, NUCLEAR_RADIOLOGICAL_EMERGENCY, AIR_POLLUTION_SMOG, OTHER, RESOLVED
 * 
 * @param {string} rawCategory
 * @returns {string} Canonical category key
 */
export function normalizeCategoryKey(rawCategory) {
  const cat = String(rawCategory || '').toUpperCase().trim().replace(/[\s_-]+/g, '_');
  if (!cat || cat === 'GENERAL' || cat === 'GENERAL_EMERGENCY') return 'OTHER';
  if (['RESOLVED', 'CLOSED', 'COMPLETED'].includes(cat)) return 'RESOLVED';
  if (CANONICAL_MAP_CATEGORIES.has(cat)) return cat;

  // 1. Specific compound disaster types (checked BEFORE broad categories to avoid false captures)
  if (cat.includes('FOREST_FIRE') || cat.includes('WILDFIRE') || cat.includes('BUSHFIRE') || cat.includes('JUNGLE_FIRE')) {
    return 'FOREST_FIRE';
  }
  if (cat.includes('URBAN_FLOOD') || cat.includes('CITY_FLOOD')) {
    return 'URBAN_FLOOD';
  }
  if (cat.includes('TSUNAMI') || cat.includes('TIDAL_WAVE')) {
    return 'TSUNAMI';
  }
  if (cat.includes('AVALANCHE') || cat.includes('SNOW_SLIDE')) {
    return 'AVALANCHE';
  }
  if (
    cat.includes('LANDSLIDE') ||
    cat.includes('LAND_SLIDE') ||
    cat.includes('MUDSLIDE') ||
    cat.includes('MUD_SLIDE') ||
    cat.includes('ROCKSLIDE') ||
    cat.includes('ROCK_SLIDE') ||
    cat.includes('SLOPE_COLLAPSE') ||
    cat.includes('HILL_SLIDE') ||
    cat.includes('DEBRIS_FLOW')
  ) {
    return 'LANDSLIDE';
  }
  if (cat.includes('NUCLEAR') || cat.includes('RADIOLOGICAL') || cat.includes('RADIATION')) {
    return 'NUCLEAR_RADIOLOGICAL_EMERGENCY';
  }
  if (cat.includes('BIOLOGICAL') || cat.includes('BIOHAZARD') || cat.includes('EPIDEMIC') || cat.includes('OUTBREAK')) {
    return 'BIOLOGICAL_EMERGENCY';
  }
  if (cat.includes('CHEMICAL') || cat.includes('TOXIC_GAS') || cat.includes('HAZMAT') || cat.includes('CHEMICAL_LEAK') || cat.includes('CHEMICAL_SPILL')) {
    return 'CHEMICAL_EMERGENCY';
  }
  if (cat.includes('AIR_POLLUTION') || cat.includes('SMOG') || cat.includes('HAZARDOUS_AQI') || cat.includes('AQI_EMERGENCY')) {
    return 'AIR_POLLUTION_SMOG';
  }
  if (cat.includes('THUNDERSTORM') || cat.includes('SEVERE_THUNDERSTORM')) {
    return 'THUNDERSTORM';
  }
  if (cat.includes('LIGHTNING') || cat.includes('THUNDERBOLT') || cat.includes('BIJLI')) {
    return 'LIGHTNING';
  }
  if (cat.includes('DUSTSTORM') || cat.includes('DUST_STORM') || cat.includes('SANDSTORM') || cat.includes('ANDHI')) {
    return 'DUSTSTORM';
  }
  if (cat.includes('SQUALL') || cat.includes('GALE')) {
    return 'SQUALL';
  }
  if (cat.includes('HEATWAVE') || cat.includes('HEAT_WAVE') || cat.includes('EXTREME_HEAT') || cat === 'LOO' || cat.startsWith('LOO_') || cat.endsWith('_LOO') || cat.includes('_LOO_')) {
    return 'HEATWAVE';
  }
  if (cat.includes('COLDWAVE') || cat.includes('COLD_WAVE') || cat.includes('EXTREME_COLD') || cat.includes('FROST')) {
    return 'COLDWAVE';
  }
  if (cat.includes('DROUGHT') || cat.includes('WATER_SCARCITY') || cat.includes('SUKHA')) {
    return 'DROUGHT';
  }

  // 2. Broad primary categories
  if (cat.includes('FIRE') || cat.includes('EXPLOSION') || cat.includes('GAS_LEAK') || cat.includes('BURNING') || cat.includes('BLAZE')) {
    return 'FIRE';
  }
  if (cat.includes('FLOOD') || cat.includes('WATER') || cat.includes('INUNDAT') || cat.includes('SUBMERG')) {
    return 'FLOOD';
  }
  if (cat.includes('CYCLONE') || cat.includes('STORM') || cat.includes('HURRICANE') || cat.includes('TYPHOON') || cat.includes('TORNADO')) {
    return 'CYCLONE_STORM';
  }
  if (cat.includes('EARTHQUAKE') || cat.includes('SEISMIC') || cat.includes('TREMOR') || cat.includes('AFTERSHOCK')) {
    return 'EARTHQUAKE';
  }
  if (cat.includes('COLLAPSE') || cat.includes('STRUCTURAL') || cat.includes('BUILDING')) {
    return 'BUILDING_COLLAPSE';
  }
  if (cat.includes('MEDIC') || cat.includes('HEALTH') || cat.includes('AMBULANCE') || cat.includes('CASUALTY') || cat.includes('HOSPITAL') || cat.includes('INJUR')) {
    return 'MEDICAL';
  }
  return 'OTHER';
}

/**
 * Deterministic Category Visual Style Mapping
 * Used consistently for individual markers, icons, halos, labels, popups, cluster summaries, and legend.
 * 
 * @param {string} category
 * @returns {Object} Complete visual tokens
 */
export function getIncidentCategoryStyle(category) {
  let normKey = normalizeCategoryKey(category);
  if (normKey === 'CYCLONE') normKey = 'CYCLONE_STORM';

  const STYLES = {
    FIRE: {
      key: 'FIRE',
      label: 'Fire',
      emoji: '🔥',
      color: '#ef4444',         // red-500
      fillColor: 'rgba(239, 68, 68, 0.18)',
      strokeColor: '#dc2626',   // red-600
      badgeColor: 'bg-red-500/20 text-red-400 border-red-500/40',
      haloColor: 'rgba(239, 68, 68, 0.40)',
      iconImage: 'disaster-fire',
      criticalIconImage: 'disaster-fire-critical',
      effect: 'warm fire pulse',
      description: 'Fire / thermal conflagration hazard',
    },
    FLOOD: {
      key: 'FLOOD',
      label: 'Flood',
      emoji: '🌊',
      color: '#0284c7',         // sky-600
      fillColor: 'rgba(14, 165, 233, 0.16)',
      strokeColor: '#0284c7',   // sky-600
      badgeColor: 'bg-sky-500/20 text-sky-400 border-sky-500/40',
      haloColor: 'rgba(2, 132, 199, 0.40)',
      iconImage: 'disaster-flood',
      criticalIconImage: 'disaster-flood-critical',
      effect: 'blue water ripple',
      description: 'Rising water / inundation hazard',
    },
    BUILDING_COLLAPSE: {
      key: 'BUILDING_COLLAPSE',
      label: 'Collapse',
      emoji: '🏚',
      color: '#b45309',         // amber-700
      fillColor: 'rgba(180, 83, 9, 0.18)',
      strokeColor: '#92400e',   // amber-800
      badgeColor: 'bg-amber-900/30 text-amber-200 border-amber-700/40',
      haloColor: 'rgba(180, 83, 9, 0.40)',
      iconImage: 'disaster-building_collapse',
      criticalIconImage: 'disaster-building_collapse-critical',
      effect: 'impact dust pulse',
      description: 'Structural collapse / trapped in debris',
    },
    CYCLONE_STORM: {
      key: 'CYCLONE_STORM',
      label: 'Storm',
      emoji: '🌪',
      color: '#64748b',         // slate-500
      fillColor: 'rgba(100, 116, 139, 0.16)',
      strokeColor: '#475569',   // slate-600
      badgeColor: 'bg-slate-500/20 text-slate-200 border-slate-400/40',
      haloColor: 'rgba(100, 116, 139, 0.40)',
      iconImage: 'disaster-cyclone_storm',
      criticalIconImage: 'disaster-cyclone_storm-critical',
      effect: 'rotating wind arc',
      description: 'Cyclone / storm / severe wind hazard',
    },
    EARTHQUAKE: {
      key: 'EARTHQUAKE',
      label: 'Earthquake',
      emoji: '⚠️',
      color: '#f59e0b',         // amber-500
      fillColor: 'rgba(245, 158, 11, 0.18)',
      strokeColor: '#d97706',   // amber-600
      badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
      haloColor: 'rgba(245, 158, 11, 0.40)',
      iconImage: 'disaster-earthquake',
      criticalIconImage: 'disaster-earthquake-critical',
      effect: 'seismic shockwave rings',
      description: 'Earthquake / seismic ground shaking',
    },
    LANDSLIDE: {
      key: 'LANDSLIDE',
      label: 'Landslide',
      emoji: '⛰️',
      color: '#a16207',         // yellow-700 / earth brown
      fillColor: 'rgba(161, 98, 7, 0.18)',
      strokeColor: '#713f12',   // yellow-900 / dark earth
      badgeColor: 'bg-amber-950/40 text-amber-300 border-amber-800/50',
      haloColor: 'rgba(161, 98, 7, 0.40)',
      iconImage: 'disaster-landslide',
      criticalIconImage: 'disaster-landslide-critical',
      effect: 'subtle earth/debris pulse',
      description: 'Landslide / mudslide / slope collapse hazard',
    },
    MEDICAL: {
      key: 'MEDICAL',
      label: 'Medical',
      emoji: '✚',
      color: '#e11d48',         // rose-600
      fillColor: 'rgba(225, 29, 72, 0.18)',
      strokeColor: '#be123c',   // rose-700
      badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      haloColor: 'rgba(225, 29, 72, 0.40)',
      iconImage: 'disaster-medical',
      criticalIconImage: 'disaster-medical-critical',
      effect: 'heartbeat pulse',
      description: 'Medical triage emergency',
    },
    TSUNAMI: {
      key: 'TSUNAMI',
      label: 'Tsunami',
      emoji: '🌊',
      color: '#0891b2',         // cyan-600
      fillColor: 'rgba(8, 145, 178, 0.18)',
      strokeColor: '#0e7490',   // cyan-700
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
      haloColor: 'rgba(8, 145, 178, 0.40)',
      iconImage: 'disaster-tsunami',
      criticalIconImage: 'disaster-tsunami-critical',
      effect: 'water wave/ripple',
      description: 'Tsunami wave / rapid coastal inundation',
    },
    AVALANCHE: {
      key: 'AVALANCHE',
      label: 'Avalanche',
      emoji: '❄️',
      color: '#0284c7',         // sky-600
      fillColor: 'rgba(2, 132, 199, 0.18)',
      strokeColor: '#0369a1',   // sky-700
      badgeColor: 'bg-sky-500/20 text-sky-200 border-sky-400/40',
      haloColor: 'rgba(2, 132, 199, 0.40)',
      iconImage: 'disaster-avalanche',
      criticalIconImage: 'disaster-avalanche-critical',
      effect: 'subtle snow/impact pulse',
      description: 'Snow avalanche / mountain ice slide',
    },
    LIGHTNING: {
      key: 'LIGHTNING',
      label: 'Lightning',
      emoji: '⚡',
      color: '#eab308',         // yellow-500
      fillColor: 'rgba(234, 179, 8, 0.18)',
      strokeColor: '#a16207',   // yellow-700
      badgeColor: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
      haloColor: 'rgba(234, 179, 8, 0.45)',
      iconImage: 'disaster-lightning',
      criticalIconImage: 'disaster-lightning-critical',
      effect: 'very short attention pulse',
      description: 'Lightning strike / severe electrical hazard',
    },
    THUNDERSTORM: {
      key: 'THUNDERSTORM',
      label: 'Thunderstorm',
      emoji: '⛈️',
      color: '#6366f1',         // indigo-500
      fillColor: 'rgba(99, 102, 241, 0.18)',
      strokeColor: '#4f46e5',   // indigo-600
      badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
      haloColor: 'rgba(99, 102, 241, 0.40)',
      iconImage: 'disaster-thunderstorm',
      criticalIconImage: 'disaster-thunderstorm-critical',
      effect: 'subtle atmospheric pulse',
      description: 'Severe thunderstorm / squall activity',
    },
    DUSTSTORM: {
      key: 'DUSTSTORM',
      label: 'Dust Storm',
      emoji: '🌪️',
      color: '#d97706',         // amber-600
      fillColor: 'rgba(217, 119, 6, 0.18)',
      strokeColor: '#b45309',   // amber-700
      badgeColor: 'bg-amber-600/20 text-amber-300 border-amber-600/40',
      haloColor: 'rgba(217, 119, 6, 0.40)',
      iconImage: 'disaster-duststorm',
      criticalIconImage: 'disaster-duststorm-critical',
      effect: 'subtle rotating/dust-like indicator',
      description: 'Dust storm / sandstorm / low visibility',
    },
    SQUALL: {
      key: 'SQUALL',
      label: 'Squall',
      emoji: '💨',
      color: '#06b6d4',         // cyan-500
      fillColor: 'rgba(6, 182, 212, 0.18)',
      strokeColor: '#0891b2',   // cyan-600
      badgeColor: 'bg-cyan-500/20 text-cyan-200 border-cyan-500/40',
      haloColor: 'rgba(6, 182, 212, 0.40)',
      iconImage: 'disaster-squall',
      criticalIconImage: 'disaster-squall-critical',
      effect: 'wind-like ring/arc',
      description: 'Sudden high-velocity squall / gale wind',
    },
    HEATWAVE: {
      key: 'HEATWAVE',
      label: 'Heat Wave',
      emoji: '🌡️',
      color: '#ea580c',         // orange-600
      fillColor: 'rgba(234, 88, 12, 0.18)',
      strokeColor: '#c2410c',   // orange-700
      badgeColor: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
      haloColor: 'rgba(234, 88, 12, 0.40)',
      iconImage: 'disaster-heatwave',
      criticalIconImage: 'disaster-heatwave-critical',
      effect: 'subtle heat pulse',
      description: 'Extreme heat wave / hyperthermia risk',
    },
    COLDWAVE: {
      key: 'COLDWAVE',
      label: 'Cold Wave',
      emoji: '🥶',
      color: '#0284c7',         // sky-600
      fillColor: 'rgba(2, 132, 199, 0.18)',
      strokeColor: '#0369a1',   // sky-700
      badgeColor: 'bg-sky-500/20 text-sky-200 border-sky-500/40',
      haloColor: 'rgba(2, 132, 199, 0.40)',
      iconImage: 'disaster-coldwave',
      criticalIconImage: 'disaster-coldwave-critical',
      effect: 'subtle cold/wave pulse',
      description: 'Extreme cold wave / frost / hypothermia risk',
    },
    DROUGHT: {
      key: 'DROUGHT',
      label: 'Drought',
      emoji: '☀️',
      color: '#ca8a04',         // yellow-600
      fillColor: 'rgba(202, 138, 4, 0.18)',
      strokeColor: '#a16207',   // yellow-700
      badgeColor: 'bg-yellow-600/20 text-yellow-300 border-yellow-600/40',
      haloColor: 'rgba(202, 138, 4, 0.40)',
      iconImage: 'disaster-drought',
      criticalIconImage: 'disaster-drought-critical',
      effect: 'subtle warning pulse',
      description: 'Severe drought / water crisis hazard',
    },
    FOREST_FIRE: {
      key: 'FOREST_FIRE',
      label: 'Forest Fire',
      emoji: '🌲🔥',
      color: '#f97316',         // orange-500
      fillColor: 'rgba(249, 115, 22, 0.18)',
      strokeColor: '#ea580c',   // orange-600
      badgeColor: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
      haloColor: 'rgba(249, 115, 22, 0.40)',
      iconImage: 'disaster-forest_fire',
      criticalIconImage: 'disaster-forest_fire-critical',
      effect: 'fire pulse',
      description: 'Wildfire / forest fire conflagration',
    },
    URBAN_FLOOD: {
      key: 'URBAN_FLOOD',
      label: 'Urban Flood',
      emoji: '🏙️🌊',
      color: '#2563eb',         // blue-600
      fillColor: 'rgba(37, 99, 235, 0.18)',
      strokeColor: '#1d4ed8',   // blue-700
      badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
      haloColor: 'rgba(37, 99, 235, 0.40)',
      iconImage: 'disaster-urban_flood',
      criticalIconImage: 'disaster-urban_flood-critical',
      effect: 'flood/water ripple',
      description: 'City stormwater inundation / urban flooding',
    },
    CHEMICAL_EMERGENCY: {
      key: 'CHEMICAL_EMERGENCY',
      label: 'Chemical Hazmat',
      emoji: '☣️',
      color: '#84cc16',         // lime-500
      fillColor: 'rgba(132, 204, 22, 0.18)',
      strokeColor: '#65a30d',   // lime-600
      badgeColor: 'bg-lime-500/20 text-lime-300 border-lime-500/40',
      haloColor: 'rgba(132, 204, 22, 0.40)',
      iconImage: 'disaster-chemical_emergency',
      criticalIconImage: 'disaster-chemical_emergency-critical',
      effect: 'warning pulse',
      description: 'Hazardous chemical leak / industrial spill',
    },
    BIOLOGICAL_EMERGENCY: {
      key: 'BIOLOGICAL_EMERGENCY',
      label: 'Bio Hazard',
      emoji: '🦠',
      color: '#a855f7',         // purple-500
      fillColor: 'rgba(168, 85, 247, 0.18)',
      strokeColor: '#9333ea',   // purple-600
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
      haloColor: 'rgba(168, 85, 247, 0.40)',
      iconImage: 'disaster-biological_emergency',
      criticalIconImage: 'disaster-biological_emergency-critical',
      effect: 'warning pulse',
      description: 'Biological contamination / disease outbreak',
    },
    NUCLEAR_RADIOLOGICAL_EMERGENCY: {
      key: 'NUCLEAR_RADIOLOGICAL_EMERGENCY',
      label: 'Nuclear Hazard',
      emoji: '☢️',
      color: '#eab308',         // yellow-500
      fillColor: 'rgba(234, 179, 8, 0.20)',
      strokeColor: '#ca8a04',   // yellow-600
      badgeColor: 'bg-yellow-500/25 text-yellow-200 border-yellow-500/50',
      haloColor: 'rgba(234, 179, 8, 0.45)',
      iconImage: 'disaster-nuclear_radiological_emergency',
      criticalIconImage: 'disaster-nuclear_radiological_emergency-critical',
      effect: 'warning pulse',
      description: 'Nuclear / radiological hazard exposure',
    },
    AIR_POLLUTION_SMOG: {
      key: 'AIR_POLLUTION_SMOG',
      label: 'Air Smog',
      emoji: '🌫️',
      color: '#78716c',         // stone-500
      fillColor: 'rgba(120, 113, 108, 0.18)',
      strokeColor: '#57534e',   // stone-600
      badgeColor: 'bg-stone-500/20 text-stone-300 border-stone-500/40',
      haloColor: 'rgba(120, 113, 108, 0.40)',
      iconImage: 'disaster-air_pollution_smog',
      criticalIconImage: 'disaster-air_pollution_smog-critical',
      effect: 'subtle atmospheric warning',
      description: 'Severe air pollution / toxic smog event',
    },
    OTHER: {
      key: 'OTHER',
      label: 'Other Hazard',
      emoji: '⚡',
      color: '#eab308',         // yellow-500
      fillColor: 'rgba(234, 179, 8, 0.16)',
      strokeColor: '#ca8a04',   // yellow-600
      badgeColor: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
      haloColor: 'rgba(234, 179, 8, 0.40)',
      iconImage: 'disaster-other',
      criticalIconImage: 'disaster-other-critical',
      effect: 'warning pulse',
      description: 'Unclassified or pending incident hazard',
    },
    RESOLVED: {
      key: 'RESOLVED',
      label: 'Resolved',
      emoji: '✓',
      color: '#10b981',         // emerald-500
      fillColor: 'rgba(16, 185, 129, 0.12)',
      strokeColor: '#059669',   // emerald-600
      badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
      haloColor: 'rgba(16, 185, 129, 0.40)',
      iconImage: 'disaster-resolved',
      criticalIconImage: 'disaster-resolved',
      effect: 'stable resolved dot',
      description: 'Incident resolved and mission completed',
    },
  };

  return STYLES[normKey] || STYLES.OTHER;
}

/**
 * Extracts the authoritative emergency category with strict priority:
 * 1. final verified detectedCategory (from authoritative server AI)
 * 2. detectedEmergencyCategory
 * 3. aiAssessment.category / aiAnalysis.disasterCategory
 * 4. compatible category field
 * 5. citizenSelectedCategory (ONLY if AI is pending)
 * 
 * @param {Object} incident
 * @returns {string} Authoritative category name
 */
export function getAuthoritativeIncidentCategory(incident) {
  if (!incident || typeof incident !== 'object') return 'OTHER';

  const candidates = [
    incident.detectedCategory,
    incident.detectedEmergencyCategory,
    incident.rawDoc?.detectedCategory,
    incident.rawDoc?.detectedEmergencyCategory,
    incident.aiAssessment?.category,
    incident.aiAnalysis?.disasterCategory,
    incident.aiAnalysis?.category,
    incident.rawDoc?.aiAssessment?.category,
    incident.rawDoc?.aiAnalysis?.disasterCategory,
  ];

  for (const c of candidates) {
    if (typeof c === 'string' && c.trim()) {
      const norm = normalizeCategoryKey(c);
      if (norm !== 'OTHER' || c.trim().toUpperCase() === 'OTHER') {
        return norm;
      }
    }
  }

  // Next: General compatible category field if present and not 'GENERAL'
  const generalCat = incident.category || incident.rawDoc?.category || incident.disaster_type;
  if (typeof generalCat === 'string' && generalCat.trim()) {
    const norm = normalizeCategoryKey(generalCat);
    if (norm !== 'OTHER' || generalCat.trim().toUpperCase() === 'OTHER') {
      return norm;
    }
  }

  // Temporary fallback if AI is still pending
  const citizenHint = incident.citizenSelectedCategory ||
    incident.selectedCategory ||
    incident.citizenInput?.selectedCategory ||
    incident.rawDoc?.citizenSelectedCategory ||
    incident.rawDoc?.selectedCategory;

  if (typeof citizenHint === 'string' && citizenHint.trim()) {
    return normalizeCategoryKey(citizenHint);
  }

  // Type fallback if specific
  if (typeof incident.type === 'string' && incident.type.trim() && incident.type.toLowerCase() !== 'general') {
    return normalizeCategoryKey(incident.type);
  }

  return 'OTHER';
}

/**
 * Single authoritative map data normalization layer.
 * Produces a stable, verified model conforming strictly to Section 21 contract:
 * {
 *   id,
 *   latitude,
 *   longitude,
 *   status,
 *   category,
 *   priority,
 *   timestamp,
 *   categoryConflict,
 *   aiPending
 * }
 * 
 * @param {Object} incident
 * @returns {Object|null} Normalized map model or null if invalid coordinates
 */
export function normalizeIncidentForMap(incident) {
  if (!incident || typeof incident !== 'object') return null;

  // 1. Authoritative Identity
  const id = String(
    incident.incident_id ||
    incident.incidentId ||
    incident.packetId ||
    incident._id ||
    incident.id ||
    incident.clientRequestId ||
    ''
  ).trim();

  if (!id) return null;

  // 2. Exact Real GPS Extraction (Never randomized, never offset)
  let lat = null;
  let lng = null;
  let accuracy = null;

  if (incident.location && typeof incident.location === 'object') {
    if (incident.location.lat != null && incident.location.lat !== '') lat = Number(incident.location.lat);
    else if (incident.location.latitude != null && incident.location.latitude !== '') lat = Number(incident.location.latitude);

    if (incident.location.lng != null && incident.location.lng !== '') lng = Number(incident.location.lng);
    else if (incident.location.longitude != null && incident.location.longitude !== '') lng = Number(incident.location.longitude);

    if (incident.location.accuracy != null && incident.location.accuracy !== '') accuracy = Number(incident.location.accuracy);
    if (accuracy === null && incident.location.accuracyMeters != null && incident.location.accuracyMeters !== '') accuracy = Number(incident.location.accuracyMeters);
  }

  if (lat === null && incident.latitude != null && incident.latitude !== '') lat = Number(incident.latitude);
  if (lat === null && incident.lat != null && incident.lat !== '') lat = Number(incident.lat);
  if (lng === null && incident.longitude != null && incident.longitude !== '') lng = Number(incident.longitude);
  if (lng === null && incident.lng != null && incident.lng !== '') lng = Number(incident.lng);

  if ((lat === null || lng === null) && incident.gpsCoordinates && typeof incident.gpsCoordinates === 'object') {
    if (incident.gpsCoordinates.latitude != null && incident.gpsCoordinates.latitude !== '') lat = Number(incident.gpsCoordinates.latitude);
    else if (incident.gpsCoordinates.lat != null && incident.gpsCoordinates.lat !== '') lat = Number(incident.gpsCoordinates.lat);

    if (incident.gpsCoordinates.longitude != null && incident.gpsCoordinates.longitude !== '') lng = Number(incident.gpsCoordinates.longitude);
    else if (incident.gpsCoordinates.lng != null && incident.gpsCoordinates.lng !== '') lng = Number(incident.gpsCoordinates.lng);

    if (accuracy === null && incident.gpsCoordinates.accuracy != null && incident.gpsCoordinates.accuracy !== '') accuracy = Number(incident.gpsCoordinates.accuracy);
    if (accuracy === null && incident.gpsCoordinates.accuracyMeters != null && incident.gpsCoordinates.accuracyMeters !== '') accuracy = Number(incident.gpsCoordinates.accuracyMeters);
  }

  if (accuracy === null && incident.accuracy != null && incident.accuracy !== '') {
    accuracy = Number(incident.accuracy);
  }
  if (accuracy === null && incident.accuracyMeters != null && incident.accuracyMeters !== '') {
    accuracy = Number(incident.accuracyMeters);
  }

  // Support GeoJSON Point coordinates: [longitude, latitude]
  if (lat === null || lng === null) {
    const coords = Array.isArray(incident.coordinates)
      ? incident.coordinates
      : (Array.isArray(incident.location?.coordinates) ? incident.location.coordinates : null);
    if (coords && coords.length >= 2 && coords[0] != null && coords[1] != null && coords[0] !== '' && coords[1] !== '') {
      lng = Number(coords[0]);
      lat = Number(coords[1]);
    }
  }

  const isValidLat = typeof lat === 'number' && !isNaN(lat) && isFinite(lat) && lat >= -90 && lat <= 90;
  const isValidLng = typeof lng === 'number' && !isNaN(lng) && isFinite(lng) && lng >= -180 && lng <= 180;
  if (!isValidLat || !isValidLng || (lat === 0 && lng === 0)) {
    return null;
  }

  // 3. Authoritative Status & Active Check
  const status = (incident.status || incident.packetStatus || 'ACTIVE').toUpperCase();

  // 4. Authoritative Category & AI Pending State
  const hasAuthoritativeAi = Boolean(
    incident.detectedCategory ||
    incident.detectedEmergencyCategory ||
    incident.rawDoc?.detectedCategory ||
    incident.rawDoc?.detectedEmergencyCategory ||
    incident.aiAssessment?.category
  );

  const category = getAuthoritativeIncidentCategory(incident);
  const aiPending = !hasAuthoritativeAi && status !== 'RESOLVED' && status !== 'COMPLETED';

  // 5. Citizen Selected Category & Conflict Flag
  const citizenSelectedCategory = (
    incident.citizenSelectedCategory ||
    incident.selectedCategory ||
    incident.citizenInput?.selectedCategory ||
    incident.rawDoc?.citizenSelectedCategory ||
    incident.rawDoc?.selectedCategory ||
    null
  );

  const normCitizenCat = citizenSelectedCategory ? normalizeCategoryKey(citizenSelectedCategory) : null;
  const categoryConflict = Boolean(
    incident.categoryConflict ?? (
      normCitizenCat &&
      normCitizenCat !== 'OTHER' &&
      category !== 'OTHER' &&
      category !== normCitizenCat
    )
  );

  // 6. Priority & Timing
  const priority = (
    incident.severity ||
    incident.priority ||
    incident.aiAnalysis?.severity ||
    incident.aiAnalysis?.priority ||
    'HIGH'
  ).toUpperCase();

  const timestamp = incident.createdAt || incident.timestamp || incident.time || new Date().toISOString();

  // 7. Visual Style Tokens
  const style = getIncidentCategoryStyle(category);

  const locationStr = incident.sector || incident.location?.address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  const affectedPeople = incident.affectedPeople || incident.aiAnalysis?.peopleCount || incident.peopleAffected || 0;
  const shortId = id.length > 8 ? `INC-${id.slice(-4).toUpperCase()}` : (id.startsWith('INC-') ? id : `INC-${id}`);

  return {
    ...incident,
    id,
    incidentId: id,
    radarId: id,
    latitude: lat,
    longitude: lng,
    lat,
    lng,
    accuracy: (accuracy != null && !isNaN(accuracy)) ? accuracy : null,
    status,
    category,
    disasterType: style.key,
    style,
    priority,
    timestamp,
    citizenSelectedCategory: normCitizenCat,
    categoryConflict,
    aiPending,
    locationStr,
    affectedPeople,
    shortId,
  };
}

/**
 * Calculates exact category composition for a cluster of member incidents.
 * Enforces Section 6 & 16:
 * - Counts must add up to exact number of incidents.
 * - If categories are mixed, provides breakdown (e.g. FIRE 3, FLOOD 1, MEDICAL 1) and labels as MIXED.
 * - If uniform, labels with dominant category.
 * 
 * @param {Array} memberIncidents Array of incident objects
 * @returns {Object} Cluster composition breakdown
 */
export function calculateClusterComposition(memberIncidents) {
  if (!Array.isArray(memberIncidents) || memberIncidents.length === 0) {
    return {
      total: 0,
      counts: {},
      isMixed: false,
      dominantCategory: 'OTHER',
      dominantCount: 0,
      groupTitle: 'EMERGENCY CLUSTER',
      compactLabel: '🚨 CLUSTER • 0',
      breakdownSummary: 'No reports',
    };
  }

  const counts = {};
  memberIncidents.forEach((inc) => {
    const cat = getAuthoritativeIncidentCategory(inc);
    counts[cat] = (counts[cat] || 0) + 1;
  });

  const distinctCategories = Object.keys(counts);
  const total = memberIncidents.length;

  // Find dominant category (highest count)
  let dominantCategory = distinctCategories[0] || 'OTHER';
  let dominantCount = counts[dominantCategory] || 0;

  distinctCategories.forEach((cat) => {
    if (counts[cat] > dominantCount) {
      dominantCategory = cat;
      dominantCount = counts[cat];
    }
  });

  const isMixed = distinctCategories.length > 1;
  const dominantStyle = getIncidentCategoryStyle(dominantCategory);

  // Readable breakdown summary (e.g. "FIRE 3 • FLOOD 1 • MEDICAL 1")
  const breakdownParts = distinctCategories
    .sort((a, b) => (counts[b] || 0) - (counts[a] || 0))
    .map((cat) => {
      const s = getIncidentCategoryStyle(cat);
      return `${s.label.toUpperCase()} ${counts[cat]}`;
    });
  const breakdownSummary = breakdownParts.join(' • ');

  // Group Title
  const groupTitle = isMixed
    ? `MIXED EMERGENCIES (${total} REPORTS: ${breakdownSummary})`
    : `${dominantStyle.label.toUpperCase()} CLUSTER`;

  // Compact Map Label
  const compactLabel = isMixed
    ? `🚨 MIXED • ${total} (${dominantStyle.emoji} ${dominantStyle.label.toUpperCase()} DOMINANT)`
    : `${dominantStyle.emoji} ${dominantStyle.label.toUpperCase()} • ${total}`;

  return {
    total,
    counts,
    isMixed,
    distinctCategories,
    dominantCategory,
    dominantCount,
    dominantStyle,
    groupTitle,
    compactLabel,
    breakdownSummary,
  };
}

/**
 * Extracts all unique non-empty string identifier variants for an incident.
 *
 * @param {Object} incident
 * @returns {string[]} Array of string identifiers
 */
export function getIncidentIdentifiers(incident) {
  if (!incident || typeof incident !== 'object') return [];
  const rawDoc = incident.rawDoc || {};
  return [
    incident.incident_id,
    incident.incidentId,
    incident.radarId,
    incident._id,
    incident.id,
    incident.packetId,
    incident.clientRequestId,
    rawDoc._id,
    rawDoc.id,
    rawDoc.incidentId,
    rawDoc.incident_id,
    rawDoc.packetId,
    rawDoc.clientRequestId,
  ].filter(Boolean).map(String);
}

/**
 * Checks if two incident objects represent the same physical incident
 * by checking if ANY identifier matches across all known ID fields.
 *
 * @param {Object} a
 * @param {Object} b
 * @returns {boolean} True if they share any identifier
 */
export function doIncidentsMatch(a, b) {
  if (!a || !b) return false;
  const aIds = getIncidentIdentifiers(a);
  const bIds = getIncidentIdentifiers(b);
  if (aIds.length === 0 || bIds.length === 0) return false;

  return aIds.some((aid) => {
    return bIds.some((bid) => {
      if (aid === bid) return true;
      if (aid.length > 8 && bid.length > 8 && (aid.endsWith(bid) || bid.endsWith(aid))) return true;
      return false;
    });
  });
}
