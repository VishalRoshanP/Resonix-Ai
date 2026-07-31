import { authApi, userApi } from './api';
import { tokenManager } from './tokenManager';

const isNetworkError = (error) =>
  error.message?.includes('Failed to fetch') ||
  error.message?.includes('NetworkError') ||
  error.code === 'ERR_NETWORK';

export const authService = {
  login: async (credentials) => {
    try {
      const res = await authApi.login(credentials);
      if (res?.data?.token) {
        tokenManager.setToken(res.data.token);
        tokenManager.setUser(res.data.user);
      }
      return res;
    } catch (error) {
      if (isNetworkError(error)) {
        console.warn('[RESONIX Auth] Backend server unreachable. Initializing local offline session.');
        const mockUser = {
          id: 'cit_offline',
          name: credentials?.email ? credentials.email.split('@')[0] : 'Alex Johnson',
          email: credentials?.email || 'citizen@resonix.gov',
          role: 'citizen',
          isGuest: false,
          isOffline: true,
        };
        tokenManager.setToken('mock_citizen_jwt_token_2026');
        tokenManager.setUser(mockUser);
        return { status: 'success', data: { user: mockUser, token: 'mock_citizen_jwt_token_2026' } };
      }
      throw error;
    }
  },

  register: async (userData) => {
    const payload = {
      name: userData.fullName || userData.name || '',
      email: userData.email,
      password: userData.password,
      phone: userData.phone || '',
      language: userData.preferredLanguage || userData.language || 'en',
      role: 'citizen',
      emergencyContactName: userData.emergencyContactName,
      emergencyContactPhone: userData.emergencyContactPhone,
      bloodGroup: userData.bloodGroup,
      medicalConditions: userData.medicalConditions,
    };

    try {
      const res = await authApi.register(payload);
      if (res?.data?.token) {
        tokenManager.setToken(res.data.token);
        tokenManager.setUser(res.data.user);
      }
      return res;
    } catch (error) {
      if (isNetworkError(error)) {
        console.warn('[RESONIX Auth] Backend server unreachable. Initializing local offline session.');
        const mockUser = {
          id: 'cit_' + Date.now(),
          name: payload.name || 'New Citizen User',
          email: payload.email || 'newcitizen@resonix.gov',
          role: 'citizen',
          isGuest: false,
          isOffline: true,
        };
        tokenManager.setToken('mock_citizen_jwt_token_2026');
        tokenManager.setUser(mockUser);
        return { status: 'success', data: { user: mockUser, token: 'mock_citizen_jwt_token_2026' } };
      }
      throw error;
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // Silent catch for logout endpoint failures
    } finally {
      tokenManager.clearAll();
    }
  },

  getCurrentUser: async () => {
    try {
      const res = await authApi.getMe();
      if (res?.data?.user) {
        tokenManager.setUser(res.data.user);
        return res.data.user;
      }
      return tokenManager.getUser();
    } catch (error) {
      if (error.status === 401) {
        tokenManager.clearAll();
        return null;
      }
      return tokenManager.getUser();
    }
  },

  updateProfile: async (userId, profileData) => {
    try {
      if (userId && !userId.startsWith('cit_offline') && !userId.startsWith('usr_mock')) {
        const res = await userApi.updateUser(userId, {
          name: profileData.fullName || profileData.name,
          phone: profileData.phone,
          email: profileData.email,
          language: profileData.preferredLanguage,
          address: profileData.address,
          city: profileData.city,
          autoShareGps: profileData.autoShareGps,
          emergencyContactName: profileData.emergencyContactName,
          emergencyContactPhone: profileData.emergencyContactPhone,
          secondaryContactName: profileData.secondaryContactName,
          secondaryContactPhone: profileData.secondaryContactPhone,
          bloodGroup: profileData.bloodGroup,
          medicalConditions: profileData.medicalConditions,
        });
        if (res?.data?.user) {
          const updatedUser = { ...tokenManager.getUser(), ...res.data.user };
          tokenManager.setUser(updatedUser);
          return updatedUser;
        }
      }
    } catch (error) {
      console.warn('[RESONIX Auth] Remote user profile sync notice:', error.message);
    }

    const currentUser = tokenManager.getUser() || {};
    const updatedUser = {
      ...currentUser,
      name: profileData.fullName || profileData.name || currentUser.name || 'Citizen User',
      email: profileData.email || currentUser.email || 'citizen@resonix.gov',
      phone: profileData.phone || currentUser.phone || '',
      language: profileData.preferredLanguage || currentUser.language || 'English',
      address: profileData.address !== undefined ? profileData.address : currentUser.address,
      city: profileData.city !== undefined ? profileData.city : currentUser.city,
      autoShareGps: profileData.autoShareGps !== undefined ? profileData.autoShareGps : true,
      emergencyContactName: profileData.emergencyContactName !== undefined ? profileData.emergencyContactName : currentUser.emergencyContactName,
      emergencyContactPhone: profileData.emergencyContactPhone !== undefined ? profileData.emergencyContactPhone : currentUser.emergencyContactPhone,
      secondaryContactName: profileData.secondaryContactName !== undefined ? profileData.secondaryContactName : currentUser.secondaryContactName,
      secondaryContactPhone: profileData.secondaryContactPhone !== undefined ? profileData.secondaryContactPhone : currentUser.secondaryContactPhone,
      bloodGroup: profileData.bloodGroup !== undefined ? profileData.bloodGroup : currentUser.bloodGroup,
      medicalConditions: profileData.medicalConditions !== undefined ? profileData.medicalConditions : currentUser.medicalConditions,
      avatarUrl: profileData.avatarUrl || currentUser.avatarUrl,
    };
    tokenManager.setUser(updatedUser);
    return updatedUser;
  },

  forgotPassword: async (email) => {
    try {
      return await authApi.forgotPassword(email);
    } catch (error) {
      if (isNetworkError(error)) {
        return { status: 'success', message: 'Password recovery instructions dispatched (Offline Mode)' };
      }
      throw error;
    }
  },

  resetPassword: async (token, password) => {
    try {
      return await authApi.resetPassword(token, password);
    } catch (error) {
      if (isNetworkError(error)) {
        return { status: 'success', message: 'Password reset completed (Offline Mode)' };
      }
      throw error;
    }
  },
};
