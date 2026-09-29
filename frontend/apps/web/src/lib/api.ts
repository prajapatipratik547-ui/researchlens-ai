import axios from 'axios';
import { TIMING } from '@synapse/shared';
import { toApiError } from './errors';
import { clearToken, getToken } from './token';

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api';

/** The single Axios instance. Components never import this — use the hooks in src/hooks. */
export const api = axios.create({
  baseURL: API_URL,
  timeout: TIMING.requestTimeoutMs,
  headers: { Accept: 'application/json' },
});

/** Options for the slow AI endpoints (/analyze, /brief). */
export const LONG_REQUEST = { timeout: TIMING.longRequestTimeoutMs } as const;

type Listener = () => void;
const sessionListeners = new Set<Listener>();

/** Called when a protected request returns 401 (token expired or revoked). */
export function onSessionExpired(listener: Listener): () => void {
  sessionListeners.add(listener);
  return () => sessionListeners.delete(listener);
}

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.set('Authorization', `Bearer ${token}`);
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err: unknown) => {
    const error = toApiError(err);
    const hadToken = axios.isAxiosError(err) && Boolean(err.config?.headers?.Authorization);
    const isLogin = axios.isAxiosError(err) && /\/auth\/(login|register)$/.test(err.config?.url ?? '');
    if (error.status === 401 && hadToken && !isLogin) {
      clearToken();
      sessionListeners.forEach((l) => l());
    }
    return Promise.reject(error);
  },
);
