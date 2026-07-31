const CITIZEN_TOKEN_KEY = 'resonix_citizen_token';
const CITIZEN_USER_KEY = 'resonix_citizen_user';

export const tokenManager = {
  getToken: () => localStorage.getItem(CITIZEN_TOKEN_KEY),
  setToken: (token) => {
    if (token) {
      localStorage.setItem(CITIZEN_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(CITIZEN_TOKEN_KEY);
    }
  },
  removeToken: () => localStorage.removeItem(CITIZEN_TOKEN_KEY),

  getUser: () => {
    try {
      const u = localStorage.getItem(CITIZEN_USER_KEY);
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  },
  setUser: (user) => {
    if (user) {
      localStorage.setItem(CITIZEN_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(CITIZEN_USER_KEY);
    }
  },
  clearAll: () => {
    localStorage.removeItem(CITIZEN_TOKEN_KEY);
    localStorage.removeItem(CITIZEN_USER_KEY);
  },
};
