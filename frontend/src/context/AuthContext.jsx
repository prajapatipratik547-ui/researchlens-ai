import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import api, { onUnauthorized } from '../services/api';
import { storage } from '../utils/storage';
import { AuthContext } from './auth-context';

// status: 'loading' while a stored token is being checked against /auth/me,
// then 'authenticated' or 'unauthenticated'.
// endReason records why a session ended ('logout' | 'expired'), so route
// guards can send a deliberate logout home but an expiry back to login.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState(() => (storage.getToken() ? 'loading' : 'unauthenticated'));
  const [endReason, setEndReason] = useState(null);

  const endSession = useCallback((reason) => {
    storage.clearToken();
    setUser(null);
    setStatus('unauthenticated');
    setEndReason(reason);
  }, []);

  const startSession = useCallback(({ user: nextUser, token }) => {
    storage.setToken(token);
    setUser(nextUser);
    setStatus('authenticated');
    setEndReason(null);
    return nextUser;
  }, []);

  // Restore the session on first load.
  useEffect(() => {
    if (!storage.getToken()) return;
    let cancelled = false;

    api
      .get('/auth/me')
      .then(({ data }) => {
        if (cancelled) return;
        setUser(data.user);
        setStatus('authenticated');
      })
      .catch((error) => {
        if (cancelled) return;
        // A network error is not proof the token is bad; only drop it on 401.
        if (error.response?.status === 401) storage.clearToken();
        setUser(null);
        setStatus('unauthenticated');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Any API call rejected with 401 mid-session means the token expired or
  // the account is gone.
  useEffect(
    () =>
      onUnauthorized(() => {
        if (!storage.getToken()) return;
        endSession('expired');
        toast.error('Your session has ended. Please log in again.');
      }),
    [endSession],
  );

  const login = useCallback(
    async (email, password) => {
      const { data } = await api.post('/auth/login', { email, password });
      return startSession(data);
    },
    [startSession],
  );

  const register = useCallback(
    async (name, email, password) => {
      const { data } = await api.post('/auth/register', { name, email, password });
      return startSession(data);
    },
    [startSession],
  );

  const logout = useCallback(() => {
    endSession('logout');
    toast.success('Logged out');
  }, [endSession]);

  const value = useMemo(
    () => ({
      user,
      status,
      isAuthenticated: status === 'authenticated',
      endReason,
      login,
      register,
      logout,
    }),
    [user, status, endReason, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
