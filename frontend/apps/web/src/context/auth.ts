import { createContext, useContext } from 'react';
import type { LoginRequest, RegisterRequest, User } from '@synapse/shared';

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous' | 'unreachable';

export interface AuthApi {
  status: AuthStatus;
  user: User | null;
  /** Set after a mid-session 401, shown on the login page. */
  notice: string | null;
  login: (body: LoginRequest) => Promise<User>;
  register: (body: RegisterRequest) => Promise<User>;
  logout: () => void;
  retry: () => void;
}

export const AuthContext = createContext<AuthApi | null>(null);

export function useAuth(): AuthApi {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
