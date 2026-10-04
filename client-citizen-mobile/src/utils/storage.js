/**
 * Storage Utility for RESONIX AI Citizen Mobile (React Native)
 * 
 * Provides unified async storage wrapper for authentication tokens, citizen profile,
 * and offline emergency queue persistence.
 * Uses @react-native-async-storage/async-storage if available, otherwise falls back to memory/file storage.
 */

let asyncStorageModule = null;
try {
  const mod = require('@react-native-async-storage/async-storage');
  asyncStorageModule = mod.default || mod;
  console.log('[Storage] ✅ Persistent AsyncStorage initialized successfully.');
} catch (e) {
  console.warn('[Storage] ⚠️ AsyncStorage native module unlinked or unavailable. Falling back to memory store:', e.message);
  const memoryStore = new Map();
  asyncStorageModule = {
    getItem: async (key) => memoryStore.get(key) || null,
    setItem: async (key, val) => { memoryStore.set(key, String(val)); },
    removeItem: async (key) => { memoryStore.delete(key); },
    clear: async () => { memoryStore.clear(); },
  };
}

const memoryStore = new Map();
let useMemoryFallback = false;

const storage = {
  /**
   * Retrieves item from storage and parses JSON
   */
  getItem: async (key) => {
    if (!useMemoryFallback && asyncStorageModule) {
      try {
        const val = await asyncStorageModule.getItem(key);
        if (!val) return null;
        try {
          return JSON.parse(val);
        } catch (_) {
          return val;
        }
      } catch (err) {
        if (err.message?.includes('window is not defined') || err.message?.includes('NativeModule')) {
          useMemoryFallback = true;
        } else {
          console.warn(`[Storage] Failed to read key '${key}':`, err.message);
          return null;
        }
      }
    }
    const memVal = memoryStore.get(key) || null;
    if (!memVal) return null;
    try {
      return JSON.parse(memVal);
    } catch (_) {
      return memVal;
    }
  },

  /**
   * Serializes value to JSON and saves to storage
   */
  setItem: async (key, value) => {
    const valStr = typeof value === 'string' ? value : JSON.stringify(value);
    if (!useMemoryFallback && asyncStorageModule) {
      try {
        await asyncStorageModule.setItem(key, valStr);
        return true;
      } catch (err) {
        if (err.message?.includes('window is not defined') || err.message?.includes('NativeModule')) {
          useMemoryFallback = true;
        } else {
          console.warn(`[Storage] Failed to write key '${key}':`, err.message);
          return false;
        }
      }
    }
    memoryStore.set(key, valStr);
    return true;
  },

  /**
   * Removes item from storage
   */
  removeItem: async (key) => {
    if (!useMemoryFallback && asyncStorageModule) {
      try {
        await asyncStorageModule.removeItem(key);
        return true;
      } catch (err) {
        if (err.message?.includes('window is not defined') || err.message?.includes('NativeModule')) {
          useMemoryFallback = true;
        } else {
          console.warn(`[Storage] Failed to remove key '${key}':`, err.message);
          return false;
        }
      }
    }
    memoryStore.delete(key);
    return true;
  },

  /**
   * Clears all items
   */
  clear: async () => {
    if (!useMemoryFallback && asyncStorageModule) {
      try {
        await asyncStorageModule.clear();
        return true;
      } catch (err) {
        if (err.message?.includes('window is not defined') || err.message?.includes('NativeModule')) {
          useMemoryFallback = true;
        } else {
          console.warn('[Storage] Failed to clear storage:', err.message);
          return false;
        }
      }
    }
    memoryStore.clear();
    return true;
  },
};

module.exports = storage;
