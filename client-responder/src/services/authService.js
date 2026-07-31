import { authApi } from './api';
import { tokenManager } from './tokenManager';

export const authService = {
  login: async (email, password, role = 'Administrator') => {
    try {
      const res = await authApi.login({ email, password, role });
      if (res?.data?.token) {
        tokenManager.setToken(res.data.token);
        tokenManager.setUser(res.data.user);
      }
      return res;
    } catch (error) {
      console.error('[RESONIX Auth] Login failed:', error.message);
      throw error;
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // Silent catch
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
    } catch {
      return tokenManager.getUser();
    }
  },
};
