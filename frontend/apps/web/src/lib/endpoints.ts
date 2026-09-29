import type { AxiosProgressEvent } from 'axios';
import type { z } from 'zod';
import {
  analysisResponseSchema,
  authResponseSchema,
  briefResponseSchema,
  conversationResponseSchema,
  conversationsResponseSchema,
  documentResponseSchema,
  documentsResponseSchema,
  evidenceResponseSchema,
  gapsResponseSchema,
  insightsResponseSchema,
  LIMITS,
  meResponseSchema,
  projectResponseSchema,
  projectsResponseSchema,
  type CreateProjectRequest,
  type InsightType,
  type LoginRequest,
  type RegisterRequest,
} from '@synapse/shared';
import { api, LONG_REQUEST } from './api';

/**
 * Check a response against the contract. A mismatch is logged in development rather than thrown,
 * so a harmless extra/renamed field on the backend doesn't take a screen down.
 */
function read<S extends z.ZodType>(schema: S, data: unknown, label: string): z.infer<S> {
  const result = schema.safeParse(data);
  if (result.success) return result.data;
  if (import.meta.env.DEV) console.warn(`[contract] ${label} response does not match schema`, result.error.issues);
  return data as z.infer<S>;
}

/* ------------------------------------------------------------------ auth */

export const authApi = {
  register: async (body: RegisterRequest) =>
    read(authResponseSchema, (await api.post('/auth/register', body)).data, 'register'),
  login: async (body: LoginRequest) => read(authResponseSchema, (await api.post('/auth/login', body)).data, 'login'),
  me: async () => read(meResponseSchema, (await api.get('/auth/me')).data, 'me').user,
};

/* ------------------------------------------------------------------ projects */

export const projectsApi = {
  list: async () => read(projectsResponseSchema, (await api.get('/projects')).data, 'projects').projects,
  get: async (id: string) => read(projectResponseSchema, (await api.get(`/projects/${id}`)).data, 'project').project,
  create: async (body: CreateProjectRequest) =>
    read(projectResponseSchema, (await api.post('/projects', body)).data, 'create project').project,
  remove: async (id: string) => {
    await api.delete(`/projects/${id}`);
  },
};

/* ------------------------------------------------------------------ documents */

export const documentsApi = {
  list: async (projectId: string) =>
    read(documentsResponseSchema, (await api.get(`/projects/${projectId}/documents`)).data, 'documents').documents,
  get: async (id: string) =>
    read(documentResponseSchema, (await api.get(`/documents/${id}`)).data, 'document').document,
  upload: async (projectId: string, files: File[], onProgress?: (percent: number) => void) => {
    const form = new FormData();
    files.forEach((f) => form.append(LIMITS.upload.fieldName, f));
    const res = await api.post(`/projects/${projectId}/documents`, form, {
      // Uploads of 5 × 10 MB can outlast the default timeout on slow links.
      ...LONG_REQUEST,
      onUploadProgress: (e: AxiosProgressEvent) => {
        if (e.total) onProgress?.(Math.round((e.loaded / e.total) * 100));
      },
    });
    return read(documentsResponseSchema, res.data, 'upload').documents;
  },
  remove: async (id: string) => {
    await api.delete(`/documents/${id}`);
  },
};

/* ------------------------------------------------------------------ research */

export const researchApi = {
  ask: async (projectId: string, question: string) =>
    read(conversationResponseSchema, (await api.post(`/research/${projectId}/ask`, { question })).data, 'ask')
      .conversation,
  conversations: async (projectId: string) =>
    read(conversationsResponseSchema, (await api.get(`/research/${projectId}/conversations`)).data, 'conversations')
      .conversations,
  analyze: async (projectId: string) =>
    read(analysisResponseSchema, (await api.post(`/research/${projectId}/analyze`, undefined, LONG_REQUEST)).data, 'analyze')
      .analysis,
  insights: async (projectId: string, type?: InsightType) =>
    read(
      insightsResponseSchema,
      (await api.get(`/research/${projectId}/insights`, { params: type ? { type } : undefined })).data,
      'insights',
    ),
  evidence: async (projectId: string) =>
    read(evidenceResponseSchema, (await api.get(`/research/${projectId}/evidence`)).data, 'evidence'),
  gaps: async (projectId: string) => read(gapsResponseSchema, (await api.get(`/research/${projectId}/gaps`)).data, 'gaps'),
  brief: async (projectId: string) =>
    read(briefResponseSchema, (await api.get(`/research/${projectId}/brief`, LONG_REQUEST)).data, 'brief'),
};
