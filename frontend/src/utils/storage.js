// localStorage can throw (private mode, blocked site data), so every access
// is guarded; the app degrades to "logged out" rather than crashing.
const TOKEN_KEY = 'researchlens.token';

export const storage = {
  getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  setToken(token) {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* ignore: session will simply not persist */
    }
  },
  clearToken() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ignore */
    }
  },
};
