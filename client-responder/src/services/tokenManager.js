const RESPONDER_TOKEN_KEY = 'resonix_responder_token';
const RESPONDER_USER_KEY = 'resonix_responder_user';

export const tokenManager = {
  getToken: () => localStorage.getItem(RESPONDER_TOKEN_KEY),
  hasToken: () => Boolean(localStorage.getItem(RESPONDER_TOKEN_KEY)),
  setToken: (token) => {
    if (token) {
      localStorage.setItem(RESPONDER_TOKEN_KEY, token);
    } else {
      localStorage.removeItem(RESPONDER_TOKEN_KEY);
    }
  },
  removeToken: () => localStorage.removeItem(RESPONDER_TOKEN_KEY),

  getUser: () => {
    try {
      const u = localStorage.getItem(RESPONDER_USER_KEY);
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  },
  setUser: (user) => {
    if (user) {
      localStorage.setItem(RESPONDER_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(RESPONDER_USER_KEY);
    }
  },
  clearAll: () => {
    localStorage.removeItem(RESPONDER_TOKEN_KEY);
    localStorage.removeItem(RESPONDER_USER_KEY);
  },
};
