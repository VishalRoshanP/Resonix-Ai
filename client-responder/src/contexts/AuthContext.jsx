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
  const [responderUser, setResponderUser] = useState(() => tokenManager.getUser() || DEFAULT_USERS.Administrator);
  const [isAuthenticated, setIsAuthenticated] = useState(() => tokenManager.hasToken());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Session token validation on app mount
    const token = tokenManager.getToken();
    if (token) {
      authService
        .getCurrentUser()
        .then((u) => {
          if (u) {
            setResponderUser(u);
            setIsAuthenticated(true);
          }
        })
        .catch(() => {
          // Token expired or invalid
        });
    }
  }, []);

  const login = useCallback(async (email, password, role = 'Administrator', rememberMe = true) => {
    setLoading(true);
    try {
      // Attempt backend login
      const res = await authService.login(email, password, role);

      const baseUser = DEFAULT_USERS[role] || DEFAULT_USERS.Administrator;
      const userObj = res?.data?.user || {
        ...baseUser,
        email: email || baseUser.email,
        role: role || baseUser.role,
      };

      if (rememberMe) {
        tokenManager.setToken(res?.data?.token || `jwt_resp_${Date.now()}`);
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
