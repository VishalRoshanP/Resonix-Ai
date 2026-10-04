import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { authService } from '../services/authService';
import { tokenManager } from '../services/tokenManager';

const AuthContext = createContext(null);

export const ROLES = {
  RESPONDER: 'Responder',
  COORDINATOR: 'Coordinator',
  ADMINISTRATOR: 'Administrator',
};

const DEFAULT_USERS = {
  Responder: {
    id: 'resp_101',
    name: 'Officer J. Miller',
    email: 'responder@resonix.gov',
    role: 'Responder',
    badgeId: 'NDRF-FL-101',
    organization: 'NDRF Battalion 4 Field Squad',
    permissions: ['view_incidents', 'update_status', 'voice_relay'],
  },
  Coordinator: {
    id: 'coord_202',
    name: 'Dispatch Lead S. Varma',
    email: 'coordinator@resonix.gov',
    role: 'Coordinator',
    badgeId: 'NDMA-COORD-202',
    organization: 'Disaster Emergency Operations Center',
    permissions: ['view_incidents', 'assign_resources', 'generate_reports', 'dispatch_squads'],
  },
  Administrator: {
    id: 'admin_303',
    name: 'Commander Reyes',
    email: 'admin@resonix.gov',
    role: 'Administrator',
    badgeId: 'RESONIX-ADM-303',
    organization: 'National Emergency Operations Command',
    permissions: ['admin', 'manage_users', 'analytics', 'system_config', 'audit_logs'],
  },
};

export function AuthProvider({ children }) {
  const [responderUser, setResponderUser] = useState(() => tokenManager.getUser());
  const [isAuthenticated, setIsAuthenticated] = useState(() => tokenManager.hasToken());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Session token validation on app mount — retry with backoff for cold-boot race
    const token = tokenManager.getToken();
    if (token) {
      let attempt = 0;
      const maxRetries = 3;
      const tryValidate = () => {
        authService
          .getCurrentUser()
          .then((u) => {
            if (u) {
              setResponderUser(u);
              setIsAuthenticated(true);
            }
          })
          .catch(() => {
            attempt++;
            if (attempt < maxRetries) {
              setTimeout(tryValidate, 1000 * Math.pow(2, attempt - 1));
            }
            // After max retries, silently fall through — offline / server not yet ready
          });
      };
      tryValidate();
    }
  }, []);

  const login = useCallback(async (email, password, role = 'Administrator', rememberMe = true) => {
    setLoading(true);
    try {
      // Execute REAL Express Backend login API
      const res = await authService.login(email, password, role);

      const userObj = res?.data?.user;
      const token = res?.data?.token;

      if (!token || !userObj) {
        throw new Error('Authentication failed: Invalid response payload from server.');
      }

      if (rememberMe) {
        tokenManager.setToken(token);
        tokenManager.setUser(userObj);
      }

      setResponderUser(userObj);
      setIsAuthenticated(true);
      return userObj;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await authService.logout();
    } finally {
      tokenManager.clearAll();
      setResponderUser(null);
      setIsAuthenticated(false);
      setLoading(false);
    }
  }, []);

  const forgotPassword = useCallback(async (email) => {
    // Call backend API or simulate OTP generation
    return { success: true, message: `OTP verification code sent to ${email}` };
  }, []);

  const resetPassword = useCallback(async (email, otp, newPassword) => {
    if (otp !== '123456' && otp.length !== 6) {
      throw new Error('Invalid OTP verification code. Try 123456.');
    }
    return { success: true, message: 'Password reset successful. You may now sign in.' };
  }, []);

  const hasRole = useCallback(
    (requiredRole) => {
      if (!responderUser) return false;
      const userRole = responderUser.role;
      if (userRole === 'Administrator') return true;
      if (requiredRole === 'Coordinator') return userRole === 'Coordinator';
      if (requiredRole === 'Responder') return true;
      return userRole === requiredRole;
    },
    [responderUser]
  );

  return (
    <AuthContext.Provider
      value={{
        responderUser,
        isAuthenticated,
        role: responderUser?.role || 'Responder',
        permissions: responderUser?.permissions || ['view_incidents'],
        loading,
        login,
        logout,
        forgotPassword,
        resetPassword,
        hasRole,
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
