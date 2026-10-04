/**
 * Authentication Context Provider for RESONIX AI Citizen Mobile (React Native)
 * 
 * Supports:
 * - Citizen Login, Registration, JWT storage, profile hydration
 * - 1-Tap Guest Session Bypass (Emergency SOS NEVER requires sign in)
 * - Session persistence across app restarts
 */

const React = require('react');
const { createContext, useState, useEffect } = React;
const apiService = require('../services/apiService');
const storage = require('../utils/storage');
const ENV = require('../config/env');
const errorHandler = require('../utils/errorHandler');

const AuthContext = createContext({
  user: null,
  token: null,
  isAuthenticated: false,
  isCitizenGuest: true,
  guestId: null,
  isLoading: true,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  continueAsGuest: () => {},
  refreshProfile: async () => {},
});

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [guestId, setGuestId] = useState(null);
  const [isCitizenGuest, setIsCitizenGuest] = useState(true);
  const [isLoading, setIsLoading] = useState(true);

  // Generate or retrieve persistent guestId
  const initGuestSession = async () => {
    try {
      let gId = await storage.getItem(ENV.STORAGE_KEYS.GUEST_SESSION);
      if (!gId) {
        gId = `usr_guest_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        await storage.setItem(ENV.STORAGE_KEYS.GUEST_SESSION, gId);
      }
      setGuestId(gId);
      return gId;
    } catch (_) {
      const fallbackGId = `usr_guest_${Date.now()}`;
      setGuestId(fallbackGId);
      return fallbackGId;
    }
  };

  // Hydrate auth state from local storage on launch
  useEffect(() => {
    async function hydrate() {
      try {
        const [storedToken, storedUser] = await Promise.all([
          storage.getItem(ENV.STORAGE_KEYS.AUTH_TOKEN),
          storage.getItem(ENV.STORAGE_KEYS.USER_PROFILE),
        ]);

        await initGuestSession();

        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(storedUser);
          setIsCitizenGuest(false);

          // Refresh profile in background
          try {
            const profileData = await apiService.getProfile();
            if (profileData && profileData.user) {
              setUser(profileData.user);
              await storage.setItem(ENV.STORAGE_KEYS.USER_PROFILE, profileData.user);
            }
          } catch (_) {
            // Offline fallback: keep cached profile
          }
        } else {
          setIsCitizenGuest(true);
        }
      } catch (err) {
        console.warn('[AuthContext] Hydration note:', err.message);
        setIsCitizenGuest(true);
      } finally {
        setIsLoading(false);
      }
    }
    hydrate();
  }, []);

  const continueAsGuest = () => {
    setIsCitizenGuest(true);
  };

  const login = async (email, password) => {
    try {
      const res = await apiService.login(email, password);
      if (res.token) setToken(res.token);
      if (res.user) {
        setUser(res.user);
        setIsCitizenGuest(false);
      }
      return { success: true, user: res.user };
    } catch (err) {
      return { success: false, error: errorHandler.formatError(err) };
    }
  };

  const register = async (name, email, password, phone = '') => {
    try {
      const res = await apiService.register(name, email, password, phone);
      if (res.token) setToken(res.token);
      if (res.user) {
        setUser(res.user);
        setIsCitizenGuest(false);
      }
      return { success: true, user: res.user };
    } catch (err) {
      return { success: false, error: errorHandler.formatError(err) };
    }
  };

  const logout = async () => {
    try {
      await storage.removeItem(ENV.STORAGE_KEYS.AUTH_TOKEN);
      await storage.removeItem(ENV.STORAGE_KEYS.USER_PROFILE);
      await storage.removeItem(ENV.STORAGE_KEYS.ACTIVE_INCIDENT);
    } catch (_) {}
    setToken(null);
    setUser(null);
    setIsCitizenGuest(true);
    await initGuestSession();
  };

  const refreshProfile = async () => {
    if (!token) return;
    try {
      const res = await apiService.getProfile();
      if (res && res.user) {
        setUser(res.user);
        await storage.setItem(ENV.STORAGE_KEYS.USER_PROFILE, res.user);
      }
    } catch (_) {}
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: Boolean(token && user),
        isCitizenGuest,
        guestId,
        isLoading,
        login,
        register,
        logout,
        continueAsGuest,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

module.exports = {
  AuthContext,
  AuthProvider,
};
