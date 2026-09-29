import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuthResponse, LoginRequest, RegisterRequest } from '@synapse/shared';
import { onSessionExpired } from '../lib/api';
import { authApi } from '../lib/endpoints';
import { ApiError } from '../lib/errors';
import { qk } from '../lib/queryKeys';
import { clearToken, getToken, setToken } from '../lib/token';
import { AuthContext, type AuthStatus } from './auth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [notice, setNotice] = useState<string | null>(null);

  // Restore the session on load. A 401 means the token is bad; a network error does not.
  const me = useQuery({
    queryKey: qk.me,
    queryFn: authApi.me,
    enabled: Boolean(token),
    staleTime: Infinity,
    retry: (count, err) => !(err instanceof ApiError && err.status === 401) && count < 2,
  });

  const logout = useCallback(() => {
    clearToken();
    setTokenState(null);
    queryClient.clear();
  }, [queryClient]);

  useEffect(
    () =>
      onSessionExpired(() => {
        setNotice('Your session ended. Please log in again.');
        logout();
      }),
    [logout],
  );

  const signIn = useCallback(
    (res: AuthResponse) => {
      setToken(res.token);
      queryClient.setQueryData(qk.me, res.user);
      setTokenState(res.token);
      setNotice(null);
      return res.user;
    },
    [queryClient],
  );

  const login = useCallback(async (body: LoginRequest) => signIn(await authApi.login(body)), [signIn]);
  const register = useCallback(async (body: RegisterRequest) => signIn(await authApi.register(body)), [signIn]);

  let status: AuthStatus = 'anonymous';
  if (token) {
    if (me.data) status = 'authenticated';
    else if (me.isError) status = me.error instanceof ApiError && me.error.status === 401 ? 'anonymous' : 'unreachable';
    else status = 'loading';
  }

  const { refetch } = me;
  const value = useMemo(
    () => ({
      status,
      user: status === 'authenticated' ? (me.data ?? null) : null,
      notice,
      login,
      register,
      logout,
      retry: () => void refetch(),
    }),
    [status, me.data, notice, login, register, logout, refetch],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
