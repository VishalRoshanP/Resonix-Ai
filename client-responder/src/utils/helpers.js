import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Single source of truth predicate to determine if an incident is active/live
 * for operational mapping, clustering, queueing, and counters.
 * 
 * @param {Object} incident
 * @returns {boolean} true if incident is active, false if resolved/closed/completed/cancelled
 */
export function isIncidentActive(incident) {
  if (!incident) return false;
  const rawStatus = String(
    incident.status ||
    incident.packetStatus ||
    incident.operationalStatus ||
    'ACTIVE'
  ).toUpperCase().trim();

  // Completed / inactive statuses
  const INACTIVE_STATUSES = ['RESOLVED', 'CLOSED', 'COMPLETED', 'CANCELLED', 'RESCUE COMPLETED'];
  return !INACTIVE_STATUSES.includes(rawStatus);
}
