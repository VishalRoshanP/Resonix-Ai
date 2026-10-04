/**
 * RESONIX AI — Disaster-Aware Map Visualizations
 * High-performance GPU-friendly visual language for emergency command center.
 * 
 * Provides:
 * 1. Category normalization mapping database categories to 7 strict disaster types.
 * 2. Visual styling tokens (colors, translucent fills, stroke styles).
 * 3. Animated canvas textures conforming to MapLibre's StyleImageInterface.
 * 4. Respects `prefers-reduced-motion` with clean static fallback graphics.
 * 5. Compact, non-overlapping cluster labels (e.g. "FIRE • 5", "FLOOD • 8").
 */

import { normalizeCategoryKey } from '../../utils/mapIncidentNormalizer';

export function normalizeDisasterCategory(rawCategory) {
  return normalizeCategoryKey(rawCategory);
}

export const DISASTER_TYPES = [
  'FLOOD',
  'FIRE',
  'CYCLONE_STORM',
  'CYCLONE',
  'EARTHQUAKE',
  'BUILDING_COLLAPSE',
  'LANDSLIDE',
  'MEDICAL',
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
];

export const DISASTER_CONFIGS = {
  RESOLVED: {
    type: 'RESOLVED',
    label: 'Resolved',
    emoji: '✓',
    color: '#10b981', // emerald-500
    fillColor: 'rgba(16, 185, 129, 0.12)',
    strokeColor: '#059669',
    badgeColor: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    description: 'incident resolved and mission completed',
    duration: 0,
    isStatic: true,
  },
  FLOOD: {
    type: 'FLOOD',
    label: 'Flood',
    emoji: '🌊',
    color: '#0284c7', // sky-600
    fillColor: 'rgba(14, 165, 233, 0.16)',
    strokeColor: '#0284c7',
    badgeColor: 'bg-sky-500/20 text-sky-400 border-sky-500/40',
    description: 'water/flood affected area',
    duration: 2400,
  },
  FIRE: {
    type: 'FIRE',
    label: 'Fire',
    emoji: '🔥',
    color: '#ef4444', // red-500
    fillColor: 'rgba(239, 68, 68, 0.18)',
    strokeColor: '#dc2626',
    badgeColor: 'bg-red-500/20 text-red-400 border-red-500/40',
    description: 'fire affected area',
    duration: 2000,
  },
  CYCLONE_STORM: {
    type: 'CYCLONE_STORM',
    label: 'Storm',
    emoji: '🌪',
    color: '#64748b', // slate-500 white/blue-gray
    fillColor: 'rgba(100, 116, 139, 0.16)',
    strokeColor: '#475569',
    badgeColor: 'bg-slate-500/20 text-slate-200 border-slate-400/40',
    description: 'storm/cyclone affected area',
    duration: 3200, // very low frequency
  },
  CYCLONE: {
    type: 'CYCLONE',
    label: 'Storm',
    emoji: '🌪',
    color: '#64748b',
    fillColor: 'rgba(100, 116, 139, 0.16)',
    strokeColor: '#475569',
    badgeColor: 'bg-slate-500/20 text-slate-200 border-slate-400/40',
    description: 'storm/cyclone affected area',
    duration: 3200,
  },
  EARTHQUAKE: {
    type: 'EARTHQUAKE',
    label: 'Earthquake',
    emoji: '⚠️',
    color: '#f59e0b', // amber-500
    fillColor: 'rgba(245, 158, 11, 0.18)',
    strokeColor: '#d97706',
    badgeColor: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
    description: 'earthquake/seismic activity',
    duration: 2400,
  },
  BUILDING_COLLAPSE: {
    type: 'BUILDING_COLLAPSE',
    label: 'Collapse',
    emoji: '🏚',
    color: '#b45309', // warm brown/orange
    fillColor: 'rgba(180, 83, 9, 0.18)',
    strokeColor: '#92400e',
    badgeColor: 'bg-amber-900/30 text-amber-200 border-amber-700/40',
    description: 'structural collapse / debris area',
    duration: 2200,
  },
  LANDSLIDE: {
    type: 'LANDSLIDE',
    label: 'Landslide',
    emoji: '⛰️',
    color: '#a16207', // earth yellow-700
    fillColor: 'rgba(161, 98, 7, 0.18)',
    strokeColor: '#713f12',
    badgeColor: 'bg-amber-950/40 text-amber-300 border-amber-800/50',
    description: 'landslide / mudslide hazard',
    duration: 2300,
  },
  MEDICAL: {
    type: 'MEDICAL',
    label: 'Medical',
    emoji: '✚',
    color: '#e11d48', // red/pink rose-600
    fillColor: 'rgba(225, 29, 72, 0.18)',
    strokeColor: '#be123c',
    badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    description: 'medical emergency',
    duration: 1800,
  },
  TSUNAMI: {
    type: 'TSUNAMI',
    label: 'Tsunami',
    emoji: '🌊',
    color: '#0891b2', // cyan-600
    fillColor: 'rgba(8, 145, 178, 0.18)',
    strokeColor: '#0e7490',
    badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    description: 'tsunami wave / coastal inundation',
    duration: 2500,
  },
  AVALANCHE: {
    type: 'AVALANCHE',
    label: 'Avalanche',
    emoji: '❄️',
    color: '#0284c7', // sky-600
    fillColor: 'rgba(2, 132, 199, 0.18)',
    strokeColor: '#0369a1',
    badgeColor: 'bg-sky-500/20 text-sky-200 border-sky-400/40',
    description: 'snow avalanche hazard',
    duration: 2200,
  },
  LIGHTNING: {
    type: 'LIGHTNING',
    label: 'Lightning',
    emoji: '⚡',
    color: '#eab308', // yellow-500
    fillColor: 'rgba(234, 179, 8, 0.18)',
    strokeColor: '#a16207',
    badgeColor: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
    description: 'lightning strike hazard',
    duration: 1600,
  },
  THUNDERSTORM: {
    type: 'THUNDERSTORM',
    label: 'Thunderstorm',
    emoji: '⛈️',
    color: '#6366f1', // indigo-500
    fillColor: 'rgba(99, 102, 241, 0.18)',
    strokeColor: '#4f46e5',
    badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    description: 'severe thunderstorm hazard',
    duration: 2600,
  },
  DUSTSTORM: {
    type: 'DUSTSTORM',
    label: 'Dust Storm',
    emoji: '🌪️',
    color: '#d97706', // amber-600
    fillColor: 'rgba(217, 119, 6, 0.18)',
    strokeColor: '#b45309',
    badgeColor: 'bg-amber-600/20 text-amber-300 border-amber-600/40',
    description: 'dust storm / sandstorm hazard',
    duration: 3000,
  },
  SQUALL: {
    type: 'SQUALL',
    label: 'Squall',
    emoji: '💨',
    color: '#06b6d4', // cyan-500
    fillColor: 'rgba(6, 182, 212, 0.18)',
    strokeColor: '#0891b2',
    badgeColor: 'bg-cyan-500/20 text-cyan-200 border-cyan-500/40',
    description: 'squall / high-velocity gale',
    duration: 2800,
  },
  HEATWAVE: {
    type: 'HEATWAVE',
    label: 'Heat Wave',
    emoji: '🌡️',
    color: '#ea580c', // orange-600
    fillColor: 'rgba(234, 88, 12, 0.18)',
    strokeColor: '#c2410c',
    badgeColor: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    description: 'extreme heat wave hazard',
    duration: 2400,
  },
  COLDWAVE: {
    type: 'COLDWAVE',
    label: 'Cold Wave',
    emoji: '🥶',
    color: '#0284c7', // sky-600
    fillColor: 'rgba(2, 132, 199, 0.18)',
    strokeColor: '#0369a1',
    badgeColor: 'bg-sky-500/20 text-sky-200 border-sky-500/40',
    description: 'extreme cold wave hazard',
    duration: 2400,
  },
  DROUGHT: {
    type: 'DROUGHT',
    label: 'Drought',
    emoji: '☀️',
    color: '#ca8a04', // yellow-600
    fillColor: 'rgba(202, 138, 4, 0.18)',
    strokeColor: '#a16207',
    badgeColor: 'bg-yellow-600/20 text-yellow-300 border-yellow-600/40',
    description: 'severe drought hazard',
    duration: 2200,
  },
  FOREST_FIRE: {
    type: 'FOREST_FIRE',
    label: 'Forest Fire',
    emoji: '🌲🔥',
    color: '#f97316', // orange-500
    fillColor: 'rgba(249, 115, 22, 0.18)',
    strokeColor: '#ea580c',
    badgeColor: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    description: 'wildfire / forest fire hazard',
    duration: 2000,
  },
  URBAN_FLOOD: {
    type: 'URBAN_FLOOD',
    label: 'Urban Flood',
    emoji: '🏙️🌊',
    color: '#2563eb', // blue-600
    fillColor: 'rgba(37, 99, 235, 0.18)',
    strokeColor: '#1d4ed8',
    badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    description: 'urban inundation hazard',
    duration: 2400,
  },
  CHEMICAL_EMERGENCY: {
    type: 'CHEMICAL_EMERGENCY',
    label: 'Chemical Hazmat',
    emoji: '☣️',
    color: '#84cc16', // lime-500
    fillColor: 'rgba(132, 204, 22, 0.18)',
    strokeColor: '#65a30d',
    badgeColor: 'bg-lime-500/20 text-lime-300 border-lime-500/40',
    description: 'chemical spill / hazmat emergency',
    duration: 2100,
  },
  BIOLOGICAL_EMERGENCY: {
    type: 'BIOLOGICAL_EMERGENCY',
    label: 'Bio Hazard',
    emoji: '🦠',
    color: '#a855f7', // purple-500
    fillColor: 'rgba(168, 85, 247, 0.18)',
    strokeColor: '#9333ea',
    badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    description: 'bio hazard / outbreak emergency',
    duration: 2100,
  },
  NUCLEAR_RADIOLOGICAL_EMERGENCY: {
    type: 'NUCLEAR_RADIOLOGICAL_EMERGENCY',
    label: 'Nuclear Hazard',
    emoji: '☢️',
    color: '#eab308', // yellow-500
    fillColor: 'rgba(234, 179, 8, 0.20)',
    strokeColor: '#ca8a04',
    badgeColor: 'bg-yellow-500/25 text-yellow-200 border-yellow-500/50',
    description: 'radiological / nuclear hazard',
    duration: 2100,
  },
  AIR_POLLUTION_SMOG: {
    type: 'AIR_POLLUTION_SMOG',
    label: 'Air Smog',
    emoji: '🌫️',
    color: '#78716c', // stone-500
    fillColor: 'rgba(120, 113, 108, 0.18)',
    strokeColor: '#57534e',
    badgeColor: 'bg-stone-500/20 text-stone-300 border-stone-500/40',
    description: 'toxic smog / hazardous air emergency',
    duration: 2500,
  },
  OTHER: {
    type: 'OTHER',
    label: 'Other Hazard',
    emoji: '⚡',
    color: '#eab308', // yellow-500
    fillColor: 'rgba(234, 179, 8, 0.16)',
    strokeColor: '#ca8a04',
    badgeColor: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
    description: 'hazard requires attention',
    duration: 2000,
  },
};

/**
/**
 * Clean, compact operational cluster badge formatter.
 * Strict priority order:
 * 1. Disaster category
 * 2. Number of reports
 * 3. Priority indicator (e.g. "● CRITICAL\nFLOOD • 12 REPORTS")
 * 
 * Never displays internal database IDs or verbose AI text.
 */
export function getCompactClusterLabel(dominantHazard, reportCount, priority, composition = null) {
  const p = String(priority || 'HIGH').toUpperCase();
  const count = Number(reportCount) || 1;
  const isCrit = (p === 'CRITICAL' || p === 'LEVEL_4' || p === 'LEVEL_5');
  const critSuffix = isCrit ? ' | CRITICAL' : '';

  if (composition && composition.isMixed) {
    const domNorm = normalizeDisasterCategory(composition.dominantCategory || dominantHazard);
    const domCfg = DISASTER_CONFIGS[domNorm] || DISASTER_CONFIGS.OTHER;
    return `🚨 MIXED • ${count} (${domCfg.emoji} ${domCfg.label.toUpperCase()} DOMINANT)${critSuffix}`;
  }

  const norm = normalizeDisasterCategory(dominantHazard);
  const cfg = DISASTER_CONFIGS[norm] || DISASTER_CONFIGS.OTHER;
  const emoji = cfg.emoji || '🚨';
  const catName = cfg.label.toUpperCase();

  return `${emoji} ${catName} • ${count}${critSuffix}`;
}

export const isReducedMotion = () => {
  if (typeof window === 'undefined') return false;
  return Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches);
};

// ============================================================================
// COMPOSITE INCIDENT MARKER STRUCTURE
// ============================================================================
// OUTER EFFECT (ripples / heat halo / seismic arcs)
//       ↓
// CATEGORY HALO (vibrant themed badge)
//       ↓
// CATEGORY ICON (crisp distinct vector glyph)
//       ↓
// STEM
//       ↓
// GPS DOT ● (anchored right at exact coordinates)
// ============================================================================

function drawIncidentMarker(ctx, size, t, reduced, isCritical, options) {
  const cx = size / 2;
  const cy = size / 2; // Exact GPS anchor point at center (40, 40)
  const badgeY = cy - 20; // Floating category badge center (40, 20)
  const badgeR = isCritical ? 12.0 : 10.5;

  // 1. Dynamic category outer effect (ripples, heat halo, seismic arcs, etc.) centered at (cx, badgeY)
  if (options.drawEffect) {
    options.drawEffect(ctx, cx, badgeY, t, reduced, isCritical);
  }

  // 2. High-contrast connector stem from GPS anchor point to floating badge
  ctx.beginPath();
  ctx.moveTo(cx, cy - 3.8);
  ctx.lineTo(cx, badgeY + badgeR + 0.5);
  ctx.strokeStyle = isCritical ? 'rgba(239, 68, 68, 0.95)' : (options.stemColor || '#ffffff');
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.stroke();

  // 3. Category Badge Disc at (cx, badgeY)
  const scale = (options.getScale && !reduced) ? options.getScale(t) : 1.0;
  const currentR = badgeR * scale;

  // Rich gradient fill for category badge
  const grad = ctx.createLinearGradient(cx, badgeY - currentR, cx, badgeY + currentR);
  grad.addColorStop(0, options.gradTop || options.primaryColor);
  grad.addColorStop(1, options.gradBottom || options.primaryColor);

  ctx.beginPath();
  ctx.arc(cx, badgeY, currentR, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = isCritical ? '#ffffff' : (options.badgeBorder || '#ffffff');
  ctx.lineWidth = isCritical ? 2.0 : 1.5;
  ctx.stroke();

  // If Critical: Steady prominent red halo ring around badge
  if (isCritical) {
    ctx.beginPath();
    ctx.arc(cx, badgeY, currentR + 3.2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.95)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }

  // 4. Category Glyph inside badge
  if (options.drawGlyph) {
    options.drawGlyph(ctx, cx, badgeY, reduced, isCritical);
  }

  // 5. GPS Anchor Point Node (●) right at (cx, cy)
  const dotR = isCritical ? 4.2 : 3.5;
  ctx.beginPath();
  ctx.arc(cx, cy, dotR, 0, Math.PI * 2);
  ctx.fillStyle = options.primaryColor;
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.8;
  ctx.stroke();

  // Critical subtle outer ring on GPS node
  if (isCritical) {
    ctx.beginPath();
    ctx.arc(cx, cy, dotR + 2.5, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.95)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}

// ----------------------------------------------------------------------------
// 1. FLOOD (🌊) — Sky-blue core + 2 expanding concentric water ripples ( )
// ----------------------------------------------------------------------------
function drawFlood(ctx, size, t, reduced, isCritical) {
  drawIncidentMarker(ctx, size, t, reduced, isCritical, {
    primaryColor: '#0284c7',
    gradTop: '#38bdf8',
    gradBottom: '#0284c7',
    badgeBorder: '#e0f2fe',
    stemColor: 'rgba(56, 189, 248, 0.90)',
    drawEffect: (c, cx, by, time, red, crit) => {
      if (!red) {
        // 2 concentric water ripples expanding and fading smoothly
        for (let i = 0; i < 2; i++) {
          const phase = (time + i * 0.5) % 1;
          const r = 11 + 14 * phase;
          const alpha = Math.max(0, (1 - phase) * (crit ? 0.85 : 0.65));
          c.beginPath();
          c.arc(cx, by, r, 0, Math.PI * 2);
          c.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
          c.lineWidth = crit ? 2.2 : 1.6;
          c.stroke();
        }
      } else {
        c.beginPath();
        c.arc(cx, by, 16, 0, Math.PI * 2);
        c.strokeStyle = 'rgba(56, 189, 248, 0.7)';
        c.lineWidth = 1.8;
        c.stroke();
      }
    },
    drawGlyph: (c, cx, by) => {
      // Dual white water wave curves (〰)
      c.beginPath();
      c.moveTo(cx - 5.5, by - 1.5);
      c.quadraticCurveTo(cx - 2.8, by - 4.2, cx, by - 1.5);
      c.quadraticCurveTo(cx + 2.8, by + 1.2, cx + 5.5, by - 1.5);
      c.moveTo(cx - 5.5, by + 2.5);
      c.quadraticCurveTo(cx - 2.8, by - 0.2, cx, by + 2.5);
      c.quadraticCurveTo(cx + 2.8, by + 5.2, cx + 5.5, by + 2.5);
      c.strokeStyle = '#ffffff';
      c.lineWidth = 1.4;
      c.lineCap = 'round';
      c.stroke();
    },
  });
}

// ----------------------------------------------------------------------------
// 2. FIRE (🔥) — Warm orange/red core + soft thermal heat halo + gentle breathing pulse
// ----------------------------------------------------------------------------
function drawFire(ctx, size, t, reduced, isCritical) {
  drawIncidentMarker(ctx, size, t, reduced, isCritical, {
    primaryColor: '#dc2626',
    gradTop: '#f97316',
    gradBottom: '#dc2626',
    badgeBorder: '#fef08a',
    stemColor: 'rgba(249, 115, 22, 0.90)',
    getScale: (time) => 1.0 + 0.08 * Math.sin(time * Math.PI * 2),
    drawEffect: (c, cx, by, time, red, crit) => {
      if (!red) {
        // Soft outward heat glow
        const grad = c.createRadialGradient(cx, by, 2, cx, by, 25);
        grad.addColorStop(0, crit ? 'rgba(239, 68, 68, 0.45)' : 'rgba(239, 68, 68, 0.35)');
        grad.addColorStop(0.5, 'rgba(249, 115, 22, 0.18)');
        grad.addColorStop(1, 'rgba(239, 68, 68, 0)');
        c.beginPath();
        c.arc(cx, by, 25, 0, Math.PI * 2);
        c.fillStyle = grad;
        c.fill();

        // Subtle expanding heat ring
        const ringR = 11 + 14 * time;
        const ringAlpha = Math.max(0, (1 - time) * (crit ? 0.75 : 0.60));
        c.beginPath();
        c.arc(cx, by, ringR, 0, Math.PI * 2);
        c.strokeStyle = `rgba(249, 115, 22, ${ringAlpha})`;
        c.lineWidth = crit ? 2.2 : 1.6;
        c.stroke();
      } else {
        c.beginPath();
        c.arc(cx, by, 16, 0, Math.PI * 2);
        c.strokeStyle = 'rgba(249, 115, 22, 0.7)';
        c.lineWidth = 1.8;
        c.stroke();
      }
    },
    drawGlyph: (c, cx, by, red, crit, time = 0) => {
      // Hot center core
      const coreGrad = c.createRadialGradient(cx, by + 1, 0, cx, by + 1, 3.5);
      coreGrad.addColorStop(0, '#ffffff');
      coreGrad.addColorStop(0.7, '#fef08a');
      coreGrad.addColorStop(1, 'rgba(249, 115, 22, 0)');
      c.beginPath();
      c.arc(cx, by + 1, 3.5, 0, Math.PI * 2);
      c.fillStyle = coreGrad;
      c.fill();

      // Flame glyph contour
      c.beginPath();
      c.moveTo(cx, by - 6.0);
      c.quadraticCurveTo(cx + 4.2, by - 1.2, cx + 3.2, by + 3.8);
      c.quadraticCurveTo(cx, by + 5.2, cx - 3.2, by + 3.8);
      c.quadraticCurveTo(cx - 4.2, by - 1.2, cx, by - 6.0);
      c.fillStyle = '#ffffff';
      c.fill();
    },
  });
}

// ----------------------------------------------------------------------------
// 3. EARTHQUAKE (⚠️) — Amber core + lateral seismic shockwave bracket rings ) (
// ----------------------------------------------------------------------------
function drawEarthquake(ctx, size, t, reduced, isCritical) {
  drawIncidentMarker(ctx, size, t, reduced, isCritical, {
    primaryColor: '#d97706',
    gradTop: '#f59e0b',
    gradBottom: '#b45309',
    badgeBorder: '#fef3c7',
    stemColor: 'rgba(245, 158, 11, 0.90)',
    drawEffect: (c, cx, by, time, red, crit) => {
      if (!red) {
        // Lateral bracket shockwaves ) ( pulsing and settling cleanly
        if (time < 0.45) {
          const p = time / 0.45;
          const r1 = 11 + 14 * p;
          const a1 = Math.max(0, (1 - p) * (crit ? 0.85 : 0.70));

          // Left bracket arc )
          c.beginPath();
          c.arc(cx, by, r1, Math.PI * 0.7, Math.PI * 1.3);
          c.strokeStyle = `rgba(245, 158, 11, ${a1})`;
          c.lineWidth = crit ? 2.2 : 1.8;
          c.stroke();

          // Right bracket arc (
          c.beginPath();
          c.arc(cx, by, r1, -Math.PI * 0.3, Math.PI * 0.3);
          c.strokeStyle = `rgba(245, 158, 11, ${a1})`;
          c.lineWidth = crit ? 2.2 : 1.8;
          c.stroke();
        }
      } else {
        c.beginPath();
        c.arc(cx, by, 16, Math.PI * 0.7, Math.PI * 1.3);
        c.arc(cx, by, 16, -Math.PI * 0.3, Math.PI * 0.3);
        c.strokeStyle = 'rgba(245, 158, 11, 0.7)';
        c.lineWidth = 1.8;
        c.stroke();
      }
    },
    drawGlyph: (c, cx, by) => {
      // Bold seismic fracture zigzag in crisp white
      c.beginPath();
      c.moveTo(cx - 3.5, by - 4.5);
      c.lineTo(cx - 0.8, by - 1.2);
      c.lineTo(cx - 2.5, by + 0.8);
      c.lineTo(cx + 1.2, by + 4.5);
      c.lineTo(cx + 3.8, by + 1.2);
      c.strokeStyle = '#ffffff';
      c.lineWidth = 1.6;
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.stroke();
    },
  });
}

// ----------------------------------------------------------------------------
// 4. CYCLONE / STORM (🌪) — Slate-blue core + slow rotating atmospheric wind arcs
// ----------------------------------------------------------------------------
function drawCyclone(ctx, size, t, reduced, isCritical) {
  drawIncidentMarker(ctx, size, t, reduced, isCritical, {
    primaryColor: '#475569',
    gradTop: '#94a3b8',
    gradBottom: '#334155',
    badgeBorder: '#e2e8f0',
    stemColor: 'rgba(148, 163, 184, 0.90)',
    drawEffect: (c, cx, by, time, red, crit) => {
      if (!red) {
        const angle = time * Math.PI * 2;
        // Slow rotating wind vortex arcs
        c.beginPath();
        c.arc(cx, by, 15, angle, angle + 1.9);
        c.strokeStyle = crit ? 'rgba(255, 255, 255, 0.90)' : 'rgba(226, 232, 240, 0.85)';
        c.lineWidth = 1.8;
        c.lineCap = 'round';
        c.stroke();

        c.beginPath();
        c.arc(cx, by, 20, angle + Math.PI, angle + Math.PI + 1.7);
        c.strokeStyle = 'rgba(148, 163, 184, 0.65)';
        c.lineWidth = 1.5;
        c.lineCap = 'round';
        c.stroke();
      } else {
        c.beginPath();
        c.arc(cx, by, 16, 0, Math.PI * 1.5);
        c.strokeStyle = 'rgba(148, 163, 184, 0.7)';
        c.lineWidth = 1.8;
        c.lineCap = 'round';
        c.stroke();
      }
    },
    drawGlyph: (c, cx, by) => {
      // Atmospheric spiral vortex glyph in crisp white
      c.beginPath();
      c.arc(cx, by, 3.8, 0, Math.PI * 1.6);
      c.strokeStyle = '#ffffff';
      c.lineWidth = 1.6;
      c.lineCap = 'round';
      c.stroke();
    },
  });
}

// ----------------------------------------------------------------------------
// 5. BUILDING COLLAPSE (🏚) — Terracotta core + kinetic impact pulse ring
// ----------------------------------------------------------------------------
function drawCollapse(ctx, size, t, reduced, isCritical) {
  drawIncidentMarker(ctx, size, t, reduced, isCritical, {
    primaryColor: '#b45309',
    gradTop: '#d97706',
    gradBottom: '#78350f',
    badgeBorder: '#fed7aa',
    stemColor: 'rgba(217, 119, 6, 0.90)',
    drawEffect: (c, cx, by, time, red, crit) => {
      if (!red) {
        // Kinetic impact pulse ring that quickly decelerates and settles
        if (time < 0.45) {
          const p = time / 0.45;
          const ease = 1 - Math.pow(1 - p, 2);
          const r = 11 + 14 * ease;
          const a = Math.max(0, (1 - ease) * (crit ? 0.85 : 0.70));
          c.beginPath();
          c.arc(cx, by, r, 0, Math.PI * 2);
          c.strokeStyle = `rgba(217, 119, 6, ${a})`;
          c.lineWidth = crit ? 2.2 : 1.7;
          c.stroke();
        }
      } else {
        c.beginPath();
        c.arc(cx, by, 16, 0, Math.PI * 2);
        c.strokeStyle = 'rgba(180, 83, 9, 0.7)';
        c.lineWidth = 1.8;
        c.stroke();
      }
    },
    drawGlyph: (c, cx, by) => {
      // Masonry structural block with diagonal fracture crack
      c.strokeStyle = '#ffffff';
      c.lineWidth = 1.4;
      c.strokeRect(cx - 3.8, by - 3.8, 7.6, 7.6);
      c.beginPath();
      c.moveTo(cx - 3.8, by - 3.8);
      c.lineTo(cx + 3.8, by + 3.8);
      c.stroke();
    },
  });
}

// ----------------------------------------------------------------------------
// 6. MEDICAL (✚) — Rose-red core + double-pulse heartbeat rhythm
// ----------------------------------------------------------------------------
function drawMedical(ctx, size, t, reduced, isCritical) {
  let beatScale = 1.0;
  if (!reduced) {
    if (t < 0.14) {
      beatScale = 1.0 + 0.15 * Math.sin((t / 0.14) * Math.PI);
    } else if (t >= 0.18 && t < 0.30) {
      beatScale = 1.0 + 0.10 * Math.sin(((t - 0.18) / 0.12) * Math.PI);
    }
  }

  drawIncidentMarker(ctx, size, t, reduced, isCritical, {
    primaryColor: '#e11d48',
    gradTop: '#fb7185',
    gradBottom: '#be123c',
    badgeBorder: '#ffe4e6',
    stemColor: 'rgba(244, 63, 94, 0.90)',
    getScale: () => beatScale,
    drawEffect: (c, cx, by, time, red, crit) => {
      if (!red) {
        let ringR = 0;
        let ringA = 0;
        if (time < 0.14) {
          const p = time / 0.14;
          ringR = 11 + 13 * p;
          ringA = (1 - p) * (crit ? 0.85 : 0.70);
        } else if (time >= 0.18 && time < 0.30) {
          const p = (time - 0.18) / 0.12;
          ringR = 11 + 17 * p;
          ringA = (1 - p) * (crit ? 0.70 : 0.55);
        }

        if (ringA > 0) {
          c.beginPath();
          c.arc(cx, by, ringR, 0, Math.PI * 2);
          c.strokeStyle = `rgba(244, 63, 94, ${ringA})`;
          c.lineWidth = crit ? 2.2 : 1.7;
          c.stroke();
        }
      } else {
        c.beginPath();
        c.arc(cx, by, 16, 0, Math.PI * 2);
        c.strokeStyle = 'rgba(244, 63, 94, 0.7)';
        c.lineWidth = 1.8;
        c.stroke();
      }
    },
    drawGlyph: (c, cx, by) => {
      // Bold white Swiss medical cross (✚)
      c.fillStyle = '#ffffff';
      c.fillRect(cx - 4.5, by - 1.5, 9, 3);
      c.fillRect(cx - 1.5, by - 4.5, 3, 9);
    },
  });
}

// ----------------------------------------------------------------------------
// 7. OTHER (⚡) — Golden amber core + warning pulse ring
// ----------------------------------------------------------------------------
function drawOther(ctx, size, t, reduced, isCritical) {
  drawIncidentMarker(ctx, size, t, reduced, isCritical, {
    primaryColor: '#d97706',
    gradTop: '#f59e0b',
    gradBottom: '#b45309',
    badgeBorder: '#fef3c7',
    stemColor: 'rgba(245, 158, 11, 0.90)',
    drawEffect: (c, cx, by, time, red, crit) => {
      if (!red) {
        const scale = 0.5 + 0.5 * Math.sin(time * Math.PI * 2);
        const r = 11 + 11 * scale;
        const a = 0.2 + 0.40 * (1 - scale);
        c.beginPath();
        c.arc(cx, by, r, 0, Math.PI * 2);
        c.strokeStyle = `rgba(245, 158, 11, ${a})`;
        c.lineWidth = crit ? 2.2 : 1.7;
        c.stroke();
      } else {
        c.beginPath();
        c.arc(cx, by, 16, 0, Math.PI * 2);
        c.strokeStyle = 'rgba(245, 158, 11, 0.7)';
        c.lineWidth = 1.8;
        c.stroke();
      }
    },
    drawGlyph: (c, cx, by) => {
      // High-contrast warning exclamation mark
      c.fillStyle = '#ffffff';
      c.fillRect(cx - 1.1, by - 4.8, 2.2, 5.2);
      c.beginPath();
      c.arc(cx, by + 3.4, 1.2, 0, Math.PI * 2);
      c.fill();
    },
  });
}

// ----------------------------------------------------------------------------
// RESOLVED (✓) — Static emerald core + checkmark
// ----------------------------------------------------------------------------
function drawResolved(ctx, size) {
  drawIncidentMarker(ctx, size, 0, true, false, {
    primaryColor: '#059669',
    gradTop: '#34d399',
    gradBottom: '#059669',
    badgeBorder: '#a7f3d0',
    stemColor: 'rgba(16, 185, 129, 0.90)',
    drawEffect: (c, cx, by) => {
      c.beginPath();
      c.arc(cx, by, 15, 0, Math.PI * 2);
      c.strokeStyle = 'rgba(16, 185, 129, 0.55)';
      c.lineWidth = 1.5;
      c.stroke();
    },
    drawGlyph: (c, cx, by) => {
      // Checkmark (✓)
      c.beginPath();
      c.moveTo(cx - 3.8, by);
      c.lineTo(cx - 1.2, by + 2.8);
      c.lineTo(cx + 3.8, by - 2.6);
      c.strokeStyle = '#ffffff';
      c.lineWidth = 1.8;
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.stroke();
    },
  });
}

// ----------------------------------------------------------------------------
// 8. LANDSLIDE (⛰️) — Earth-brown core + subtle debris / slope pulse
// ----------------------------------------------------------------------------
function drawLandslide(ctx, size, t, reduced, isCritical) {
  drawIncidentMarker(ctx, size, t, reduced, isCritical, {
    primaryColor: '#a16207',
    gradTop: '#d97706',
    gradBottom: '#713f12',
    badgeBorder: '#fde68a',
    stemColor: 'rgba(161, 98, 7, 0.90)',
    drawEffect: (c, cx, by, time, red, crit) => {
      if (!red) {
        for (let i = 0; i < 2; i++) {
          const phase = (time + i * 0.5) % 1;
          const r = 11 + 13 * phase;
          const alpha = Math.max(0, (1 - phase) * (crit ? 0.80 : 0.60));
          c.beginPath();
          c.arc(cx, by, r, 0, Math.PI * 2);
          c.strokeStyle = `rgba(161, 98, 7, ${alpha})`;
          c.lineWidth = crit ? 2.2 : 1.6;
          c.stroke();
        }
      } else {
        c.beginPath();
        c.arc(cx, by, 16, 0, Math.PI * 2);
        c.strokeStyle = 'rgba(161, 98, 7, 0.7)';
        c.lineWidth = 1.8;
        c.stroke();
      }
    },
    drawGlyph: (c, cx, by) => {
      c.beginPath();
      c.moveTo(cx - 5.5, by + 4);
      c.lineTo(cx - 1.5, by - 3.5);
      c.lineTo(cx + 2.5, by + 0.5);
      c.lineTo(cx + 5.5, by + 4);
      c.strokeStyle = '#ffffff';
      c.lineWidth = 1.6;
      c.lineCap = 'round';
      c.stroke();
      c.fillStyle = '#fef08a';
      c.beginPath();
      c.arc(cx + 0.5, by - 2, 1.1, 0, Math.PI * 2);
      c.arc(cx + 3.2, by - 0.5, 0.9, 0, Math.PI * 2);
      c.arc(cx + 4.5, by + 2, 1.2, 0, Math.PI * 2);
      c.fill();
    },
  });
}

// ----------------------------------------------------------------------------
// 9. TSUNAMI (🌊) — Deep cyan core + coastal wave ripples
// ----------------------------------------------------------------------------
function drawTsunami(ctx, size, t, reduced, isCritical) {
  drawIncidentMarker(ctx, size, t, reduced, isCritical, {
    primaryColor: '#0891b2',
    gradTop: '#22d3ee',
    gradBottom: '#0e7490',
    badgeBorder: '#cffafe',
    stemColor: 'rgba(8, 145, 178, 0.90)',
    drawEffect: (c, cx, by, time, red, crit) => {
      if (!red) {
        for (let i = 0; i < 2; i++) {
          const phase = (time + i * 0.5) % 1;
          const r = 11 + 15 * phase;
          const alpha = Math.max(0, (1 - phase) * (crit ? 0.85 : 0.65));
          c.beginPath();
          c.arc(cx, by, r, 0, Math.PI * 2);
          c.strokeStyle = `rgba(8, 145, 178, ${alpha})`;
          c.lineWidth = crit ? 2.2 : 1.6;
          c.stroke();
        }
      } else {
        c.beginPath();
        c.arc(cx, by, 16, 0, Math.PI * 2);
        c.strokeStyle = 'rgba(8, 145, 178, 0.7)';
        c.lineWidth = 1.8;
        c.stroke();
      }
    },
    drawGlyph: (c, cx, by) => {
      c.beginPath();
      c.moveTo(cx - 5.5, by + 3.5);
      c.bezierCurveTo(cx - 2.5, by + 3.5, cx - 1.5, by - 4.5, cx + 2.5, by - 4.5);
      c.quadraticCurveTo(cx + 4.5, by - 2, cx + 2, by - 1.5);
      c.strokeStyle = '#ffffff';
      c.lineWidth = 1.5;
      c.lineCap = 'round';
      c.stroke();
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(cx + 2.2, by - 3.2, 1.1, 0, Math.PI * 2);
      c.fill();
    },
  });
}

// ----------------------------------------------------------------------------
// 10. AVALANCHE (❄️) — Ice blue core + snow pulse
// ----------------------------------------------------------------------------
function drawAvalanche(ctx, size, t, reduced, isCritical) {
  drawIncidentMarker(ctx, size, t, reduced, isCritical, {
    primaryColor: '#0284c7',
    gradTop: '#7dd3fc',
    gradBottom: '#0369a1',
    badgeBorder: '#e0f2fe',
    stemColor: 'rgba(2, 132, 199, 0.90)',
    drawEffect: (c, cx, by, time, red, crit) => {
      if (!red) {
        const r = 11 + 13 * time;
        const alpha = Math.max(0, (1 - time) * (crit ? 0.75 : 0.55));
        c.beginPath();
        c.arc(cx, by, r, 0, Math.PI * 2);
        c.strokeStyle = `rgba(125, 211, 252, ${alpha})`;
        c.lineWidth = crit ? 2.0 : 1.5;
        c.stroke();
      } else {
        c.beginPath();
        c.arc(cx, by, 16, 0, Math.PI * 2);
        c.strokeStyle = 'rgba(125, 211, 252, 0.7)';
        c.lineWidth = 1.8;
        c.stroke();
      }
    },
    drawGlyph: (c, cx, by) => {
      c.beginPath();
      c.moveTo(cx - 5, by + 4);
      c.lineTo(cx, by - 4);
      c.lineTo(cx + 5, by + 4);
      c.strokeStyle = '#ffffff';
      c.lineWidth = 1.5;
      c.stroke();
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(cx - 1.5, by + 1.5, 1.0, 0, Math.PI * 2);
      c.arc(cx + 2.0, by + 0.5, 1.0, 0, Math.PI * 2);
      c.fill();
    },
  });
}

// ----------------------------------------------------------------------------
// 11. LIGHTNING (⚡) — Electric amber core + short attention pulse
// ----------------------------------------------------------------------------
function drawLightning(ctx, size, t, reduced, isCritical) {
  drawIncidentMarker(ctx, size, t, reduced, isCritical, {
    primaryColor: '#eab308',
    gradTop: '#fde047',
    gradBottom: '#ca8a04',
    badgeBorder: '#fef9c3',
    stemColor: 'rgba(234, 179, 8, 0.90)',
    drawEffect: (c, cx, by, time, red, crit) => {
      if (!red) {
        if (time < 0.3) {
          const p = time / 0.3;
          const r = 11 + 14 * p;
          const alpha = (1 - p) * (crit ? 0.85 : 0.65);
          c.beginPath();
          c.arc(cx, by, r, 0, Math.PI * 2);
          c.strokeStyle = `rgba(250, 204, 21, ${alpha})`;
          c.lineWidth = crit ? 2.2 : 1.6;
          c.stroke();
        }
      } else {
        c.beginPath();
        c.arc(cx, by, 16, 0, Math.PI * 2);
        c.strokeStyle = 'rgba(250, 204, 21, 0.7)';
        c.lineWidth = 1.8;
        c.stroke();
      }
    },
    drawGlyph: (c, cx, by) => {
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.moveTo(cx + 1, by - 5);
      c.lineTo(cx - 3, by);
      c.lineTo(cx, by);
      c.lineTo(cx - 1, by + 5);
      c.lineTo(cx + 3, by - 0.5);
      c.lineTo(cx, by - 0.5);
      c.closePath();
      c.fill();
    },
  });
}

// ----------------------------------------------------------------------------
// 12. THUNDERSTORM (⛈️) — Indigo core + atmospheric pulse
// ----------------------------------------------------------------------------
function drawThunderstorm(ctx, size, t, reduced, isCritical) {
  drawIncidentMarker(ctx, size, t, reduced, isCritical, {
    primaryColor: '#6366f1',
    gradTop: '#818cf8',
    gradBottom: '#4338ca',
    badgeBorder: '#e0e7ff',
    stemColor: 'rgba(99, 102, 241, 0.90)',
    drawEffect: (c, cx, by, time, red, crit) => {
      if (!red) {
        const r = 11 + 13 * time;
        const alpha = Math.max(0, (1 - time) * (crit ? 0.75 : 0.55));
        c.beginPath();
        c.arc(cx, by, r, 0, Math.PI * 2);
        c.strokeStyle = `rgba(129, 140, 248, ${alpha})`;
        c.lineWidth = crit ? 2.0 : 1.5;
        c.stroke();
      } else {
        c.beginPath();
        c.arc(cx, by, 16, 0, Math.PI * 2);
        c.strokeStyle = 'rgba(129, 140, 248, 0.7)';
        c.lineWidth = 1.8;
        c.stroke();
      }
    },
    drawGlyph: (c, cx, by) => {
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(cx - 2, by - 1, 2.8, Math.PI * 0.7, Math.PI * 1.8);
      c.arc(cx + 2, by - 1.5, 2.5, Math.PI * 1.1, Math.PI * 2.2);
      c.arc(cx + 3.5, by + 1, 2.0, 0, Math.PI * 0.5);
      c.arc(cx - 3.5, by + 1, 2.0, Math.PI * 0.5, Math.PI);
      c.closePath();
      c.fill();
    },
  });
}

// ----------------------------------------------------------------------------
// 13. DUSTSTORM (🌪️) — Sand/amber core + rotating dust indicator
// ----------------------------------------------------------------------------
function drawDuststorm(ctx, size, t, reduced, isCritical) {
  drawIncidentMarker(ctx, size, t, reduced, isCritical, {
    primaryColor: '#d97706',
    gradTop: '#f59e0b',
    gradBottom: '#b45309',
    badgeBorder: '#fef3c7',
    stemColor: 'rgba(217, 119, 6, 0.90)',
    drawEffect: (c, cx, by, time, red, crit) => {
      if (!red) {
        const angle = time * Math.PI * 2;
        c.beginPath();
        c.arc(cx, by, 15, angle, angle + Math.PI * 0.9);
        c.strokeStyle = crit ? 'rgba(245, 158, 11, 0.85)' : 'rgba(245, 158, 11, 0.65)';
        c.lineWidth = 1.8;
        c.stroke();
      } else {
        c.beginPath();
        c.arc(cx, by, 16, 0, Math.PI * 2);
        c.strokeStyle = 'rgba(245, 158, 11, 0.7)';
        c.lineWidth = 1.8;
        c.stroke();
      }
    },
    drawGlyph: (c, cx, by) => {
      c.strokeStyle = '#ffffff';
      c.lineWidth = 1.4;
      c.lineCap = 'round';
      c.beginPath();
      c.arc(cx - 1, by - 1.5, 3.5, Math.PI * 0.2, Math.PI * 1.2);
      c.stroke();
      c.beginPath();
      c.arc(cx + 1, by + 1.5, 3.5, Math.PI * 1.2, Math.PI * 0.2);
      c.stroke();
    },
  });
}

// ----------------------------------------------------------------------------
// 14. SQUALL (💨) — Cyan core + wind-like arc
// ----------------------------------------------------------------------------
function drawSquall(ctx, size, t, reduced, isCritical) {
  drawIncidentMarker(ctx, size, t, reduced, isCritical, {
    primaryColor: '#06b6d4',
    gradTop: '#22d3ee',
    gradBottom: '#0891b2',
    badgeBorder: '#cffafe',
    stemColor: 'rgba(6, 182, 212, 0.90)',
    drawEffect: (c, cx, by, time, red, crit) => {
      if (!red) {
        c.beginPath();
        c.arc(cx, by, 14, -0.4, 0.4);
        c.strokeStyle = crit ? 'rgba(34, 211, 238, 0.85)' : 'rgba(34, 211, 238, 0.65)';
        c.lineWidth = 2.0;
        c.stroke();
      } else {
        c.beginPath();
        c.arc(cx, by, 16, 0, Math.PI * 2);
        c.strokeStyle = 'rgba(34, 211, 238, 0.7)';
        c.lineWidth = 1.8;
        c.stroke();
      }
    },
    drawGlyph: (c, cx, by) => {
      c.strokeStyle = '#ffffff';
      c.lineWidth = 1.4;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(cx - 4.5, by - 2);
      c.lineTo(cx + 3, by - 2);
      c.arc(cx + 3, by - 3.5, 1.5, Math.PI * 0.5, Math.PI * 1.5, true);
      c.moveTo(cx - 3, by + 2);
      c.lineTo(cx + 4.5, by + 2);
      c.arc(cx + 4.5, by + 3.5, 1.5, Math.PI * 1.5, Math.PI * 0.5);
      c.stroke();
    },
  });
}

// ----------------------------------------------------------------------------
// 15. HEATWAVE (🌡️) — Deep orange core + heat shimmer pulse
// ----------------------------------------------------------------------------
function drawHeatwave(ctx, size, t, reduced, isCritical) {
  drawIncidentMarker(ctx, size, t, reduced, isCritical, {
    primaryColor: '#ea580c',
    gradTop: '#fb923c',
    gradBottom: '#c2410c',
    badgeBorder: '#fed7aa',
    stemColor: 'rgba(234, 88, 12, 0.90)',
    drawEffect: (c, cx, by, time, red, crit) => {
      if (!red) {
        const r = 11 + 12 * time;
        const alpha = Math.max(0, (1 - time) * (crit ? 0.75 : 0.55));
        c.beginPath();
        c.arc(cx, by, r, 0, Math.PI * 2);
        c.strokeStyle = `rgba(251, 146, 60, ${alpha})`;
        c.lineWidth = crit ? 2.0 : 1.5;
        c.stroke();
      } else {
        c.beginPath();
        c.arc(cx, by, 16, 0, Math.PI * 2);
        c.strokeStyle = 'rgba(251, 146, 60, 0.7)';
        c.lineWidth = 1.8;
        c.stroke();
      }
    },
    drawGlyph: (c, cx, by) => {
      c.strokeStyle = '#ffffff';
      c.lineWidth = 1.4;
      c.lineCap = 'round';
      [-3, 0, 3].forEach((dx) => {
        c.beginPath();
        c.moveTo(cx + dx, by + 4);
        c.quadraticCurveTo(cx + dx - 1.5, by + 1, cx + dx, by - 1);
        c.quadraticCurveTo(cx + dx + 1.5, by - 3, cx + dx, by - 4);
        c.stroke();
      });
    },
  });
}

// ----------------------------------------------------------------------------
// 16. COLDWAVE (🥶) — Frost cyan core + cold wave pulse
// ----------------------------------------------------------------------------
function drawColdwave(ctx, size, t, reduced, isCritical) {
  drawIncidentMarker(ctx, size, t, reduced, isCritical, {
    primaryColor: '#0284c7',
    gradTop: '#a5f3fc',
    gradBottom: '#0369a1',
    badgeBorder: '#cffafe',
    stemColor: 'rgba(2, 132, 199, 0.90)',
    drawEffect: (c, cx, by, time, red, crit) => {
      if (!red) {
        const r = 11 + 13 * time;
        const alpha = Math.max(0, (1 - time) * (crit ? 0.75 : 0.55));
        c.beginPath();
        c.arc(cx, by, r, 0, Math.PI * 2);
        c.strokeStyle = `rgba(165, 243, 252, ${alpha})`;
        c.lineWidth = crit ? 2.0 : 1.5;
        c.stroke();
      } else {
        c.beginPath();
        c.arc(cx, by, 16, 0, Math.PI * 2);
        c.strokeStyle = 'rgba(165, 243, 252, 0.7)';
        c.lineWidth = 1.8;
        c.stroke();
      }
    },
    drawGlyph: (c, cx, by) => {
      c.strokeStyle = '#ffffff';
      c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(cx - 4.5, by); c.lineTo(cx + 4.5, by);
      c.moveTo(cx, by - 4.5); c.lineTo(cx, by + 4.5);
      c.moveTo(cx - 3, by - 3); c.lineTo(cx + 3, by + 3);
      c.moveTo(cx + 3, by - 3); c.lineTo(cx - 3, by + 3);
      c.stroke();
    },
  });
}

// ----------------------------------------------------------------------------
// 17. DROUGHT (☀️) — Golden dry core + warning pulse
// ----------------------------------------------------------------------------
function drawDrought(ctx, size, t, reduced, isCritical) {
  drawIncidentMarker(ctx, size, t, reduced, isCritical, {
    primaryColor: '#ca8a04',
    gradTop: '#facc15',
    gradBottom: '#a16207',
    badgeBorder: '#fef9c3',
    stemColor: 'rgba(202, 138, 4, 0.90)',
    drawEffect: (c, cx, by, time, red, crit) => {
      if (!red) {
        const r = 11 + 12 * time;
        const alpha = Math.max(0, (1 - time) * (crit ? 0.70 : 0.50));
        c.beginPath();
        c.arc(cx, by, r, 0, Math.PI * 2);
        c.strokeStyle = `rgba(250, 204, 21, ${alpha})`;
        c.lineWidth = crit ? 2.0 : 1.5;
        c.stroke();
      } else {
        c.beginPath();
        c.arc(cx, by, 16, 0, Math.PI * 2);
        c.strokeStyle = 'rgba(250, 204, 21, 0.7)';
        c.lineWidth = 1.8;
        c.stroke();
      }
    },
    drawGlyph: (c, cx, by) => {
      c.strokeStyle = '#ffffff';
      c.lineWidth = 1.4;
      c.beginPath();
      c.arc(cx, by - 1, 2.5, Math.PI, 0);
      c.moveTo(cx - 4.5, by + 3); c.lineTo(cx + 4.5, by + 3);
      c.stroke();
    },
  });
}

// ----------------------------------------------------------------------------
// 18. FOREST_FIRE (🌲🔥) — Blaze orange/red core + fire pulse
// ----------------------------------------------------------------------------
function drawForestFire(ctx, size, t, reduced, isCritical) {
  drawIncidentMarker(ctx, size, t, reduced, isCritical, {
    primaryColor: '#f97316',
    gradTop: '#fb923c',
    gradBottom: '#c2410c',
    badgeBorder: '#fed7aa',
    stemColor: 'rgba(249, 115, 22, 0.90)',
    getScale: (time) => 1.0 + 0.08 * Math.sin(time * Math.PI * 2),
    drawEffect: (c, cx, by, time, red, crit) => {
      if (!red) {
        const ringR = 11 + 14 * time;
        const ringAlpha = Math.max(0, (1 - time) * (crit ? 0.80 : 0.60));
        c.beginPath();
        c.arc(cx, by, ringR, 0, Math.PI * 2);
        c.strokeStyle = `rgba(249, 115, 22, ${ringAlpha})`;
        c.lineWidth = crit ? 2.2 : 1.6;
        c.stroke();
      } else {
        c.beginPath();
        c.arc(cx, by, 16, 0, Math.PI * 2);
        c.strokeStyle = 'rgba(249, 115, 22, 0.7)';
        c.lineWidth = 1.8;
        c.stroke();
      }
    },
    drawGlyph: (c, cx, by) => {
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.moveTo(cx - 2, by - 4);
      c.lineTo(cx - 4.5, by + 1);
      c.lineTo(cx - 2.5, by + 1);
      c.lineTo(cx - 4.5, by + 4);
      c.lineTo(cx, by + 4);
      c.lineTo(cx + 1, by + 2);
      c.quadraticCurveTo(cx + 4, by, cx + 1, by - 4);
      c.closePath();
      c.fill();
    },
  });
}

// ----------------------------------------------------------------------------
// 19. URBAN_FLOOD (🏙️🌊) — Deep blue core + urban water ripple
// ----------------------------------------------------------------------------
function drawUrbanFlood(ctx, size, t, reduced, isCritical) {
  drawIncidentMarker(ctx, size, t, reduced, isCritical, {
    primaryColor: '#2563eb',
    gradTop: '#60a5fa',
    gradBottom: '#1d4ed8',
    badgeBorder: '#dbeafe',
    stemColor: 'rgba(37, 99, 235, 0.90)',
    drawEffect: (c, cx, by, time, red, crit) => {
      if (!red) {
        for (let i = 0; i < 2; i++) {
          const phase = (time + i * 0.5) % 1;
          const r = 11 + 14 * phase;
          const alpha = Math.max(0, (1 - phase) * (crit ? 0.85 : 0.65));
          c.beginPath();
          c.arc(cx, by, r, 0, Math.PI * 2);
          c.strokeStyle = `rgba(96, 165, 250, ${alpha})`;
          c.lineWidth = crit ? 2.2 : 1.6;
          c.stroke();
        }
      } else {
        c.beginPath();
        c.arc(cx, by, 16, 0, Math.PI * 2);
        c.strokeStyle = 'rgba(96, 165, 250, 0.7)';
        c.lineWidth = 1.8;
        c.stroke();
      }
    },
    drawGlyph: (c, cx, by) => {
      c.fillStyle = '#ffffff';
      c.fillRect(cx - 4.5, by - 4, 3.5, 6);
      c.fillRect(cx - 0.5, by - 5.5, 4.5, 7.5);
      c.beginPath();
      c.moveTo(cx - 5.5, by + 3);
      c.quadraticCurveTo(cx - 2.5, by + 1.5, cx, by + 3);
      c.quadraticCurveTo(cx + 2.5, by + 4.5, cx + 5.5, by + 3);
      c.strokeStyle = '#ffffff';
      c.lineWidth = 1.4;
      c.stroke();
    },
  });
}

// ----------------------------------------------------------------------------
// 20. CHEMICAL_EMERGENCY (☣️) — Toxic lime core + warning pulse
// ----------------------------------------------------------------------------
function drawChemicalEmergency(ctx, size, t, reduced, isCritical) {
  drawIncidentMarker(ctx, size, t, reduced, isCritical, {
    primaryColor: '#84cc16',
    gradTop: '#a3e635',
    gradBottom: '#4d7c0f',
    badgeBorder: '#ecfccb',
    stemColor: 'rgba(132, 204, 22, 0.90)',
    drawEffect: (c, cx, by, time, red, crit) => {
      if (!red) {
        const r = 11 + 13 * time;
        const alpha = Math.max(0, (1 - time) * (crit ? 0.80 : 0.60));
        c.beginPath();
        c.arc(cx, by, r, 0, Math.PI * 2);
        c.strokeStyle = `rgba(163, 230, 53, ${alpha})`;
        c.lineWidth = crit ? 2.2 : 1.6;
        c.stroke();
      } else {
        c.beginPath();
        c.arc(cx, by, 16, 0, Math.PI * 2);
        c.strokeStyle = 'rgba(163, 230, 53, 0.7)';
        c.lineWidth = 1.8;
        c.stroke();
      }
    },
    drawGlyph: (c, cx, by) => {
      c.strokeStyle = '#ffffff';
      c.lineWidth = 1.4;
      c.beginPath();
      c.moveTo(cx - 1.5, by - 4.5);
      c.lineTo(cx + 1.5, by - 4.5);
      c.moveTo(cx - 1, by - 4.5);
      c.lineTo(cx - 1, by - 1.5);
      c.lineTo(cx - 4, by + 3.5);
      c.lineTo(cx + 4, by + 3.5);
      c.lineTo(cx + 1, by - 1.5);
      c.lineTo(cx + 1, by - 4.5);
      c.stroke();
    },
  });
}

// ----------------------------------------------------------------------------
// 21. BIOLOGICAL_EMERGENCY (🦠) — Bio purple core + warning pulse
// ----------------------------------------------------------------------------
function drawBiologicalEmergency(ctx, size, t, reduced, isCritical) {
  drawIncidentMarker(ctx, size, t, reduced, isCritical, {
    primaryColor: '#a855f7',
    gradTop: '#c084fc',
    gradBottom: '#7e22ce',
    badgeBorder: '#f3e8ff',
    stemColor: 'rgba(168, 85, 247, 0.90)',
    drawEffect: (c, cx, by, time, red, crit) => {
      if (!red) {
        const r = 11 + 13 * time;
        const alpha = Math.max(0, (1 - time) * (crit ? 0.80 : 0.60));
        c.beginPath();
        c.arc(cx, by, r, 0, Math.PI * 2);
        c.strokeStyle = `rgba(192, 132, 252, ${alpha})`;
        c.lineWidth = crit ? 2.2 : 1.6;
        c.stroke();
      } else {
        c.beginPath();
        c.arc(cx, by, 16, 0, Math.PI * 2);
        c.strokeStyle = 'rgba(192, 132, 252, 0.7)';
        c.lineWidth = 1.8;
        c.stroke();
      }
    },
    drawGlyph: (c, cx, by) => {
      c.strokeStyle = '#ffffff';
      c.lineWidth = 1.3;
      c.beginPath();
      c.arc(cx, by - 2, 2.2, 0, Math.PI * 2);
      c.arc(cx - 2.2, by + 1.8, 2.2, 0, Math.PI * 2);
      c.arc(cx + 2.2, by + 1.8, 2.2, 0, Math.PI * 2);
      c.stroke();
    },
  });
}

// ----------------------------------------------------------------------------
// 22. NUCLEAR_RADIOLOGICAL_EMERGENCY (☢️) — Yellow/amber core + warning pulse
// ----------------------------------------------------------------------------
function drawNuclearRadiologicalEmergency(ctx, size, t, reduced, isCritical) {
  drawIncidentMarker(ctx, size, t, reduced, isCritical, {
    primaryColor: '#eab308',
    gradTop: '#fde047',
    gradBottom: '#ca8a04',
    badgeBorder: '#fef08a',
    stemColor: 'rgba(234, 179, 8, 0.90)',
    drawEffect: (c, cx, by, time, red, crit) => {
      if (!red) {
        const r = 11 + 14 * time;
        const alpha = Math.max(0, (1 - time) * (crit ? 0.85 : 0.65));
        c.beginPath();
        c.arc(cx, by, r, 0, Math.PI * 2);
        c.strokeStyle = `rgba(250, 204, 21, ${alpha})`;
        c.lineWidth = crit ? 2.2 : 1.6;
        c.stroke();
      } else {
        c.beginPath();
        c.arc(cx, by, 16, 0, Math.PI * 2);
        c.strokeStyle = 'rgba(250, 204, 21, 0.7)';
        c.lineWidth = 1.8;
        c.stroke();
      }
    },
    drawGlyph: (c, cx, by) => {
      c.fillStyle = '#ffffff';
      c.beginPath();
      c.arc(cx, by, 1.4, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#ffffff';
      c.lineWidth = 2.0;
      [0, 2.094, 4.189].forEach((a) => {
        c.beginPath();
        c.arc(cx, by, 3.8, a - 0.4, a + 0.4);
        c.stroke();
      });
    },
  });
}

// ----------------------------------------------------------------------------
// 23. AIR_POLLUTION_SMOG (🌫️) — Gray/stone core + atmospheric haze
// ----------------------------------------------------------------------------
function drawAirPollutionSmog(ctx, size, t, reduced, isCritical) {
  drawIncidentMarker(ctx, size, t, reduced, isCritical, {
    primaryColor: '#78716c',
    gradTop: '#a8a29e',
    gradBottom: '#57534e',
    badgeBorder: '#e7e5e4',
    stemColor: 'rgba(120, 113, 108, 0.90)',
    drawEffect: (c, cx, by, time, red, crit) => {
      if (!red) {
        const r = 11 + 12 * time;
        const alpha = Math.max(0, (1 - time) * (crit ? 0.70 : 0.50));
        c.beginPath();
        c.arc(cx, by, r, 0, Math.PI * 2);
        c.strokeStyle = `rgba(168, 162, 158, ${alpha})`;
        c.lineWidth = crit ? 2.0 : 1.5;
        c.stroke();
      } else {
        c.beginPath();
        c.arc(cx, by, 16, 0, Math.PI * 2);
        c.strokeStyle = 'rgba(168, 162, 158, 0.7)';
        c.lineWidth = 1.8;
        c.stroke();
      }
    },
    drawGlyph: (c, cx, by) => {
      c.strokeStyle = '#ffffff';
      c.lineWidth = 1.3;
      c.lineCap = 'round';
      [-3, 0, 3].forEach((dy, i) => {
        c.beginPath();
        c.moveTo(cx - 4.5 + (i % 2) * 1.5, by + dy);
        c.lineTo(cx + 4.5 - ((i + 1) % 2) * 1.5, by + dy);
        c.stroke();
      });
    },
  });
}

export function drawDisasterCanvas(ctx, disasterType, size, t, reduced, isCritical = false) {
  if (disasterType === 'RESOLVED') {
    drawResolved(ctx, size);
    return;
  }

  const type = normalizeDisasterCategory(disasterType);
  switch (type) {
    case 'FLOOD':
      drawFlood(ctx, size, t, reduced, isCritical);
      break;
    case 'FIRE':
      drawFire(ctx, size, t, reduced, isCritical);
      break;
    case 'CYCLONE_STORM':
    case 'CYCLONE':
      drawCyclone(ctx, size, t, reduced, isCritical);
      break;
    case 'EARTHQUAKE':
      drawEarthquake(ctx, size, t, reduced, isCritical);
      break;
    case 'BUILDING_COLLAPSE':
      drawCollapse(ctx, size, t, reduced, isCritical);
      break;
    case 'LANDSLIDE':
      drawLandslide(ctx, size, t, reduced, isCritical);
      break;
    case 'MEDICAL':
      drawMedical(ctx, size, t, reduced, isCritical);
      break;
    case 'TSUNAMI':
      drawTsunami(ctx, size, t, reduced, isCritical);
      break;
    case 'AVALANCHE':
      drawAvalanche(ctx, size, t, reduced, isCritical);
      break;
    case 'LIGHTNING':
      drawLightning(ctx, size, t, reduced, isCritical);
      break;
    case 'THUNDERSTORM':
      drawThunderstorm(ctx, size, t, reduced, isCritical);
      break;
    case 'DUSTSTORM':
      drawDuststorm(ctx, size, t, reduced, isCritical);
      break;
    case 'SQUALL':
      drawSquall(ctx, size, t, reduced, isCritical);
      break;
    case 'HEATWAVE':
      drawHeatwave(ctx, size, t, reduced, isCritical);
      break;
    case 'COLDWAVE':
      drawColdwave(ctx, size, t, reduced, isCritical);
      break;
    case 'DROUGHT':
      drawDrought(ctx, size, t, reduced, isCritical);
      break;
    case 'FOREST_FIRE':
      drawForestFire(ctx, size, t, reduced, isCritical);
      break;
    case 'URBAN_FLOOD':
      drawUrbanFlood(ctx, size, t, reduced, isCritical);
      break;
    case 'CHEMICAL_EMERGENCY':
      drawChemicalEmergency(ctx, size, t, reduced, isCritical);
      break;
    case 'BIOLOGICAL_EMERGENCY':
      drawBiologicalEmergency(ctx, size, t, reduced, isCritical);
      break;
    case 'NUCLEAR_RADIOLOGICAL_EMERGENCY':
      drawNuclearRadiologicalEmergency(ctx, size, t, reduced, isCritical);
      break;
    case 'AIR_POLLUTION_SMOG':
      drawAirPollutionSmog(ctx, size, t, reduced, isCritical);
      break;
    default:
      drawOther(ctx, size, t, reduced, isCritical);
      break;
  }
}

/**
 * Shared Animation Clock & Throttle Controller
 * Throttles texture re-generation to 25 FPS (~40ms interval).
 * Eliminates GPU readback saturation and preserves 100% responsiveness.
 */
const RENDER_INTERVAL_MS = 40; // 25 FPS
let lastScheduledRepaint = 0;

function scheduleSharedRepaint(map) {
  const now = performance.now();
  if (now - lastScheduledRepaint >= RENDER_INTERVAL_MS) {
    lastScheduledRepaint = now;
    map.triggerRepaint();
  } else {
    setTimeout(() => {
      lastScheduledRepaint = performance.now();
      map.triggerRepaint();
    }, RENDER_INTERVAL_MS - (now - lastScheduledRepaint));
  }
}

/**
 * Creates an animated custom image implementing MapLibre's StyleImageInterface.
 * MapLibre natively renders this texture quad in WebGL with zero DOM elements.
 */
export function createDisasterStyleImage(map, disasterType, isCritical = false) {
  const size = 80;
  const config = DISASTER_CONFIGS[disasterType] || DISASTER_CONFIGS.OTHER;
  let canvas = null;
  let ctx = null;
  let hasRenderedStatic = false;
  let lastFrameTime = 0;

  return {
    width: size,
    height: size,
    data: new Uint8Array(size * size * 4),

    onAdd: function () {
      canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      ctx = canvas.getContext('2d', { willReadFrequently: true });
    },

    render: function () {
      if (!ctx || !canvas) return false;

      // Handle static / resolved icons or reduced motion
      const reduced = isReducedMotion();
      if (config.isStatic || (reduced && hasRenderedStatic)) {
        if (hasRenderedStatic) return false;
        ctx.clearRect(0, 0, size, size);
        drawDisasterCanvas(ctx, disasterType, size, 0, true, isCritical);
        const imgData = ctx.getImageData(0, 0, size, size);
        this.data.set(imgData.data);
        hasRenderedStatic = true;
        return true;
      }

      const now = performance.now();
      if (!reduced && now - lastFrameTime < RENDER_INTERVAL_MS) {
        return false;
      }
      lastFrameTime = now;

      const duration = config.duration || 2000;
      const t = reduced ? 0 : (now % duration) / duration;

      ctx.clearRect(0, 0, size, size);
      drawDisasterCanvas(ctx, disasterType, size, t, reduced, isCritical);

      const imgData = ctx.getImageData(0, 0, size, size);
      this.data.set(imgData.data);

      if (reduced) {
        hasRenderedStatic = true;
        return true;
      }

      scheduleSharedRepaint(map);
      return true;
    },
  };
}

/**
 * Renders a crisp, subtle "+" crosshair reticle with a dashed leader line stem for the cluster center.
 * GUARANTEED to be visually distinct from individual incident markers:
 * - NO fire/flood/disaster emojis or animated effects.
 * - Thin, calm crosshair lines with a subtle center pip.
 * - Vertical dashed leader line stem extending straight UP to elevate the cluster label.
 */
export function drawClusterCenterCrosshair(ctx, size, dominantHazard = 'OTHER') {
  const cx = size / 2;
  const cy = size / 2;
  const norm = normalizeDisasterCategory(dominantHazard);
  const cfg = DISASTER_CONFIGS[norm] || DISASTER_CONFIGS.OTHER;
  const strokeColor = cfg.strokeColor || '#fbbf24';

  // 1. Thin translucent outer ring (reticle target)
  ctx.beginPath();
  ctx.arc(cx, cy, 7.5, 0, Math.PI * 2);
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // 2. Subtle "+" crosshair (clean crisp lines)
  ctx.beginPath();
  ctx.moveTo(cx - 5, cy);
  ctx.lineTo(cx + 5, cy);
  ctx.moveTo(cx, cy - 5);
  ctx.lineTo(cx, cy + 5);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.lineCap = 'round';
  ctx.stroke();

  // 3. Micro center pip
  ctx.beginPath();
  ctx.arc(cx, cy, 1.2, 0, Math.PI * 2);
  ctx.fillStyle = strokeColor;
  ctx.fill();

  // 4. Subtle dashed vertical leader line stem extending straight UP from cy - 8 to top
  // Connects centroid to the floating elevated cluster label
  ctx.beginPath();
  ctx.setLineDash([2, 2]);
  ctx.moveTo(cx, cy - 7.5);
  ctx.lineTo(cx, 4);
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1.3;
  ctx.stroke();
  ctx.setLineDash([]);
}

/**
 * Creates a static style image for the subtle cluster center "+" crosshair reticle.
 * MapLibre natively renders this texture quad with zero DOM overhead.
 */
export function createClusterCenterStyleImage(map, dominantHazard = 'OTHER') {
  const size = 56;
  let canvas = null;
  let ctx = null;

  return {
    width: size,
    height: size,
    data: new Uint8Array(size * size * 4),

    onAdd: function () {
      canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      ctx = canvas.getContext('2d', { willReadFrequently: true });
    },

    render: function () {
      if (!ctx || !canvas) return false;
      ctx.clearRect(0, 0, size, size);
      drawClusterCenterCrosshair(ctx, size, dominantHazard);
      const imgData = ctx.getImageData(0, 0, size, size);
      this.data.set(imgData.data);
      return true;
    },
  };
}

// ============================================================================
// PHASE 6: NEW SOS ATTENTION EFFECT ANIMATION (1–3 EXPANDING RINGS)
// ============================================================================

const ATTENTION_COLORS = {
  FLOOD: { primary: '#0284c7', ring: 'rgba(56, 189, 248, ALPHA)', pulse: 'rgba(2, 132, 199, 0.25)' },
  FIRE: { primary: '#ef4444', ring: 'rgba(239, 68, 68, ALPHA)', pulse: 'rgba(249, 115, 22, 0.30)' },
  CYCLONE_STORM: { primary: '#64748b', ring: 'rgba(203, 213, 225, ALPHA)', pulse: 'rgba(100, 116, 139, 0.25)' },
  CYCLONE: { primary: '#64748b', ring: 'rgba(203, 213, 225, ALPHA)', pulse: 'rgba(100, 116, 139, 0.25)' },
  EARTHQUAKE: { primary: '#d97706', ring: 'rgba(251, 191, 36, ALPHA)', pulse: 'rgba(245, 158, 11, 0.25)' },
  BUILDING_COLLAPSE: { primary: '#b45309', ring: 'rgba(251, 146, 60, ALPHA)', pulse: 'rgba(180, 83, 9, 0.25)' },
  LANDSLIDE: { primary: '#a16207', ring: 'rgba(217, 119, 6, ALPHA)', pulse: 'rgba(161, 98, 7, 0.25)' },
  MEDICAL: { primary: '#e11d48', ring: 'rgba(244, 63, 94, ALPHA)', pulse: 'rgba(225, 29, 72, 0.25)' },
  TSUNAMI: { primary: '#0891b2', ring: 'rgba(34, 211, 238, ALPHA)', pulse: 'rgba(8, 145, 178, 0.25)' },
  AVALANCHE: { primary: '#0284c7', ring: 'rgba(125, 211, 252, ALPHA)', pulse: 'rgba(2, 132, 199, 0.25)' },
  LIGHTNING: { primary: '#eab308', ring: 'rgba(250, 204, 21, ALPHA)', pulse: 'rgba(234, 179, 8, 0.25)' },
  THUNDERSTORM: { primary: '#6366f1', ring: 'rgba(129, 140, 248, ALPHA)', pulse: 'rgba(99, 102, 241, 0.25)' },
  DUSTSTORM: { primary: '#d97706', ring: 'rgba(245, 158, 11, ALPHA)', pulse: 'rgba(217, 119, 6, 0.25)' },
  SQUALL: { primary: '#06b6d4', ring: 'rgba(34, 211, 238, ALPHA)', pulse: 'rgba(6, 182, 212, 0.25)' },
  HEATWAVE: { primary: '#ea580c', ring: 'rgba(251, 146, 60, ALPHA)', pulse: 'rgba(234, 88, 12, 0.25)' },
  COLDWAVE: { primary: '#0284c7', ring: 'rgba(165, 243, 252, ALPHA)', pulse: 'rgba(2, 132, 199, 0.25)' },
  DROUGHT: { primary: '#ca8a04', ring: 'rgba(250, 204, 21, ALPHA)', pulse: 'rgba(202, 138, 4, 0.25)' },
  FOREST_FIRE: { primary: '#f97316', ring: 'rgba(249, 115, 22, ALPHA)', pulse: 'rgba(234, 88, 12, 0.25)' },
  URBAN_FLOOD: { primary: '#2563eb', ring: 'rgba(96, 165, 250, ALPHA)', pulse: 'rgba(37, 99, 235, 0.25)' },
  CHEMICAL_EMERGENCY: { primary: '#84cc16', ring: 'rgba(163, 230, 53, ALPHA)', pulse: 'rgba(132, 204, 22, 0.25)' },
  BIOLOGICAL_EMERGENCY: { primary: '#a855f7', ring: 'rgba(192, 132, 252, ALPHA)', pulse: 'rgba(168, 85, 247, 0.25)' },
  NUCLEAR_RADIOLOGICAL_EMERGENCY: { primary: '#eab308', ring: 'rgba(250, 204, 21, ALPHA)', pulse: 'rgba(234, 179, 8, 0.25)' },
  AIR_POLLUTION_SMOG: { primary: '#78716c', ring: 'rgba(168, 162, 158, ALPHA)', pulse: 'rgba(120, 113, 108, 0.25)' },
  OTHER: { primary: '#eab308', ring: 'rgba(250, 204, 21, ALPHA)', pulse: 'rgba(234, 179, 8, 0.25)' },
  RESOLVED: { primary: '#10b981', ring: 'rgba(52, 211, 153, ALPHA)', pulse: 'rgba(16, 185, 129, 0.15)' },
};

/**
 * Generates the standardized MapLibre StyleImage ID for a new SOS attention icon.
 */
export function getSosAttentionImageId(disasterType, priorityLevel) {
  const normType = normalizeDisasterCategory(disasterType).toLowerCase();
  const normPriority = String(priorityLevel || 'ATTENTION').toLowerCase();
  return `sos-attention-${normType}-${normPriority}`;
}

/**
 * Draws the short, non-intrusive attention animation (1–3 expanding rings + subtle pulse).
 * Modulates ring count, radius, and stroke intensity by priority:
 * - CRITICAL: 3 expanding rings, bold stroke, higher opacity, subtle core flare.
 * - ATTENTION / HIGH: 2 expanding rings, moderate stroke, moderate opacity.
 * - MONITORING / LOW: 1 expanding ring, subtle stroke, gentle opacity.
 * 
 * Respects prefers-reduced-motion with a clean static high-contrast double border.
 */
export function drawSosAttentionCanvas(ctx, size, disasterType, priorityLevel, t, reduced) {
  const cx = size / 2;
  const cy = size / 2;
  const normType = normalizeDisasterCategory(disasterType);
  const colorScheme = ATTENTION_COLORS[normType] || ATTENTION_COLORS.OTHER;
  const priority = String(priorityLevel || 'ATTENTION').toUpperCase();

  let ringCount = 2;
  let maxRadius = 38;
  let baseStroke = 1.8;
  let maxAlpha = 0.70;

  if (priority === 'CRITICAL' || priority === 'LEVEL_4' || priority === 'LEVEL_5') {
    ringCount = 3;
    maxRadius = 44;
    baseStroke = 2.4;
    maxAlpha = 0.85;
  } else if (priority === 'MONITORING' || priority === 'LOW') {
    ringCount = 1;
    maxRadius = 30;
    baseStroke = 1.3;
    maxAlpha = 0.45;
  }

  if (reduced) {
    // Accessible static double-ring indicator (no expansion, no pulsation)
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.strokeStyle = colorScheme.primary;
    ctx.lineWidth = 2.0;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, cy, 26, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    return;
  }

  // 1–3 Expanding Attention Rings
  const minRadius = 12;
  for (let i = 0; i < ringCount; i++) {
    const phase = (t + i * (1 / ringCount)) % 1;
    const r = minRadius + (maxRadius - minRadius) * phase;
    const alpha = Math.max(0, (1 - phase) * maxAlpha);
    const strokeColor = colorScheme.ring.replace('ALPHA', alpha.toFixed(3));

    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = baseStroke * (1 - phase * 0.3);
    ctx.stroke();
  }

  // Subtle Center Attention Pulse
  const pulseScale = 1 + 0.15 * Math.sin(t * Math.PI * 2);
  ctx.beginPath();
  ctx.arc(cx, cy, 14 * pulseScale, 0, Math.PI * 2);
  ctx.fillStyle = colorScheme.pulse;
  ctx.fill();
}

/**
 * Creates an animated attention image implementing MapLibre's StyleImageInterface.
 */
export function createSosAttentionStyleImage(map, disasterType, priorityLevel) {
  const size = 96; // 96x96 canvas accommodates maxRadius 44 + margin
  let canvas = null;
  let ctx = null;
  let hasRenderedStatic = false;
  let lastFrameTime = 0;
  const cycleDuration = 1000; // 1 second per ripple wave cycle

  return {
    width: size,
    height: size,
    data: new Uint8Array(size * size * 4),

    onAdd: function () {
      canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      ctx = canvas.getContext('2d', { willReadFrequently: true });
    },

    render: function () {
      if (!ctx || !canvas) return false;

      const reduced = isReducedMotion();
      if (reduced && hasRenderedStatic) {
        return false;
      }

      const now = performance.now();
      if (!reduced && now - lastFrameTime < RENDER_INTERVAL_MS) {
        return false;
      }
      lastFrameTime = now;

      const t = reduced ? 0 : (now % cycleDuration) / cycleDuration;

      ctx.clearRect(0, 0, size, size);
      drawSosAttentionCanvas(ctx, size, disasterType, priorityLevel, t, reduced);

      const imgData = ctx.getImageData(0, 0, size, size);
      this.data.set(imgData.data);

      if (reduced) {
        hasRenderedStatic = true;
        return true;
      }

      scheduleSharedRepaint(map);
      return true;
    },
  };
}
