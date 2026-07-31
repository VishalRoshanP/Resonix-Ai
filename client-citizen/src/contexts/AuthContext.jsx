import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { authService } from '../services/authService';
import { tokenManager } from '../services/tokenManager';

const AuthContext = createContext(null);

const createGuestSession = () => ({
  guestId: `guest_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
  isGuest: true,
  createdAt: new Date().toISOString(),
  permissions: ['send_sos', 'voice_report', 'upload_images', 'share_gps', 'view_status'],
  restricted: ['profile_history'],
});

export function AuthProvider({ children }) {
  const [citizenUser, setCitizenUser] = useState(() => tokenManager.getUser());
  const [isCitizenGuest, setIsCitizenGuest] = useState(() => !tokenManager.getToken());
  const [guestSession, setGuestSession] = useState(() => createGuestSession());
  const [loading, setLoading] = useState(() => Boolean(tokenManager.getToken()));

  useEffect(() => {
    let isMounted = true;
    const existingToken = tokenManager.getToken();

    if (existingToken) {
      setIsCitizenGuest(false);
      authService
        .getCurrentUser()
        .then((user) => {
          if (isMounted) {
            if (user) {
              setCitizenUser(user);
              setIsCitizenGuest(false);
            } else {
              tokenManager.clearAll();
              setCitizenUser(null);
              setIsCitizenGuest(true);
            }
          }
        })
        .catch(() => {
          if (isMounted) {
            tokenManager.clearAll();
            setCitizenUser(null);
            setIsCitizenGuest(true);
            setGuestSession(createGuestSession());
          }
        })
        .finally(() => {
          if (isMounted) setLoading(false);
        });
    } else {
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, []);

  const loginCitizen = useCallback(async (credentials) => {
    setLoading(true);
    try {
      const res = await authService.login(credentials);
      const userObj = res?.data?.user || tokenManager.getUser();
      setCitizenUser(userObj);
      setIsCitizenGuest(false);
      return userObj;
    } finally {
      setLoading(false);
    }
  }, []);

  const registerCitizen = useCallback(async (userData) => {
    setLoading(true);
    try {
      const res = await authService.register(userData);
      const userObj = res?.data?.user || tokenManager.getUser();
      setCitizenUser(userObj);
      setIsCitizenGuest(false);
      return userObj;
    } finally {
      setLoading(false);
    }
  }, []);

  const continueAsGuest = useCallback(() => {
    tokenManager.clearAll();
    setCitizenUser(null);
    setIsCitizenGuest(true);
    const newGuest = createGuestSession();
    setGuestSession(newGuest);
    return newGuest;
  }, []);

  const logoutCitizen = useCallback(async () => {
    setLoading(true);
    try {
      await authService.logout();
    } finally {
      tokenManager.clearAll();
      setCitizenUser(null);
      setIsCitizenGuest(true);
      setGuestSession(createGuestSession());
      setLoading(false);
    }
  }, []);

  const forgotPassword = useCallback(async (email) => {
    return await authService.forgotPassword(email);
  }, []);

  const resetPassword = useCallback(async (token, password) => {
    return await authService.resetPassword(token, password);
  }, []);

  const updateUserProfile = useCallback(async (profileData) => {
    if (!citizenUser) return null;
    setLoading(true);
    try {
      const updatedUser = await authService.updateProfile(citizenUser.id, profileData);
      setCitizenUser(updatedUser);
      return updatedUser;
    } finally {
      setLoading(false);
    }
  }, [citizenUser]);

  return (
    <AuthContext.Provider
      value={{
        citizenUser,
        isCitizenGuest,
        guestId: isCitizenGuest ? guestSession.guestId : null,
        guestSession: isCitizenGuest ? guestSession : null,
        loading,
        loginCitizen,
        registerCitizen,
        continueAsGuest,
        logoutCitizen,
        forgotPassword,
        resetPassword,
        updateUserProfile,
        // Compatibility aliases
        user: citizenUser,
        isAuthenticated: !isCitizenGuest,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
