import axios from 'axios';
import { storage } from '../utils/storage';

export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/$/, '');

const api = axios.create({
  baseURL: API_URL,
  timeout: 30_000,
});

api.interceptors.request.use((config) => {
  const token = storage.getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Listeners notified when the server rejects our token, so the auth layer
// can log out without every call site handling 401s itself.
const unauthorizedListeners = new Set();
export function onUnauthorized(listener) {
  unauthorizedListeners.add(listener);
  return () => unauthorizedListeners.delete(listener);
}

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const hadToken = Boolean(error.config?.headers?.Authorization);
    if (status === 401 && hadToken) unauthorizedListeners.forEach((fn) => fn());
    return Promise.reject(error);
  },
);

/** Human-readable message from any API/network error. */
export function getErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (error?.response?.data?.error?.message) return error.response.data.error.message;
  if (error?.code === 'ECONNABORTED') return 'The request timed out. Please try again.';
  if (error?.request && !error.response) return 'Cannot reach the server. Check your connection.';
  return fallback;
}

/** Field-level validation errors from the API, keyed by field name. */
export function getFieldErrors(error) {
  const details = error?.response?.data?.error?.details;
  if (!Array.isArray(details)) return {};
  return Object.fromEntries(details.map((d) => [d.field, d.message]));
}

export const projectsApi = {
  list: () => api.get('/projects').then((r) => r.data.projects),
  get: (id) => api.get(`/projects/${id}`).then((r) => r.data.project),
  create: (data) => api.post('/projects', data).then((r) => r.data.project),
  remove: (id) => api.delete(`/projects/${id}`),
};

export const documentsApi = {
  list: (projectId) => api.get(`/projects/${projectId}/documents`).then((r) => r.data.documents),
  get: (id) => api.get(`/documents/${id}`).then((r) => r.data.document),
  remove: (id) => api.delete(`/documents/${id}`),
  /** Uploads up to 5 files; `onProgress` receives 0–100. */
  upload: (projectId, files, onProgress) => {
    const form = new FormData();
    files.forEach((file) => form.append('files', file));
    return api
      .post(`/projects/${projectId}/documents`, form, {
        // Large files on slow connections need longer than the default.
        timeout: 120_000,
        onUploadProgress: (event) => {
          if (event.total) onProgress?.(Math.round((event.loaded / event.total) * 100));
        },
      })
      .then((r) => r.data.documents);
  },
};

export const researchApi = {
  conversations: (projectId) =>
    api.get(`/research/${projectId}/conversations`).then((r) => r.data.conversations),
  // AI answers take 3-15 s, occasionally longer on a busy free tier.
  ask: (projectId, question) =>
    api
      .post(`/research/${projectId}/ask`, { question }, { timeout: 90_000 })
      .then((r) => r.data.conversation),

  // Corpus analysis: usually 5-60 s; a busy free tier can take longer.
  analyze: (projectId) =>
    api.post(`/research/${projectId}/analyze`, null, { timeout: 180_000 }).then((r) => r.data.analysis),
  /** { insights, analyzedAt, outdated }; `type` optionally filters. */
  insights: (projectId, type) =>
    api.get(`/research/${projectId}/insights`, { params: type ? { type } : undefined }).then((r) => r.data),
  /** { matrix | null, analyzedAt, outdated } */
  evidence: (projectId) => api.get(`/research/${projectId}/evidence`).then((r) => r.data),
  /** { gaps, analyzedAt, outdated } */
  gaps: (projectId) => api.get(`/research/${projectId}/gaps`).then((r) => r.data),
  /** { brief, outdated }; written on first request after an analysis. */
  brief: (projectId) => api.get(`/research/${projectId}/brief`, { timeout: 120_000 }).then((r) => r.data),
};

export const aiApi = {
  status: () => api.get('/ai/status').then((r) => r.data.ai),
};

export default api;
