/**
 * RESONIX AI — Canonical Device Identity Service
 * 
 * Provides a persistent, stable application-level device identifier per physical installation.
 * Avoids regenerating IDs per hop or relying solely on randomized BLE MAC addresses.
 */

const storage = require('./storage');
const ENV = require('../config/env');

let cachedDeviceId = null;

function generateStableId() {
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `DEV_${rand}`;
}

async function getCanonicalDeviceId() {
  if (cachedDeviceId) {
    return cachedDeviceId;
  }

  try {
    const persisted = await storage.getItem(ENV.STORAGE_KEYS.DEVICE_ID);
    if (persisted && typeof persisted === 'string' && persisted.trim().length > 0) {
      cachedDeviceId = persisted.trim();
      return cachedDeviceId;
    }
  } catch (_) {}

  cachedDeviceId = generateStableId();
  try {
    await storage.setItem(ENV.STORAGE_KEYS.DEVICE_ID, cachedDeviceId);
  } catch (_) {}

  return cachedDeviceId;
}

function setCanonicalDeviceId(id) {
  if (!id) return;
  cachedDeviceId = String(id).trim();
  try {
    storage.setItem(ENV.STORAGE_KEYS.DEVICE_ID, cachedDeviceId);
  } catch (_) {}
}

module.exports = {
  getCanonicalDeviceId,
  setCanonicalDeviceId,
};
