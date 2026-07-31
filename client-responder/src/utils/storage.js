export const storage = {
  get: (key, fallback = null) => {
    try {
      const val = localStorage.getItem(key);
      return val !== null ? val : fallback;
    } catch {
      return fallback;
    }
  },
  getJson: (key, fallback = null) => {
    try {
      const val = localStorage.getItem(key);
      return val ? JSON.parse(val) : fallback;
    } catch {
      return fallback;
    }
  },
  set: (key, val) => {
    try {
      localStorage.setItem(key, String(val));
    } catch (e) {
      console.warn(`[Storage] Failed to set item for key: ${key}`, e);
    }
  },
  setJson: (key, val) => {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {
      console.warn(`[Storage] Failed to set JSON for key: ${key}`, e);
    }
  },
  remove: (key) => {
    try {
      localStorage.removeItem(key);
    } catch {}
  },
  clear: () => {
    try {
      localStorage.clear();
    } catch {}
  },
};
