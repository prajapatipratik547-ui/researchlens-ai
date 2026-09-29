import type { InsightType } from '@synapse/shared';

export const qk = {
  me: ['auth', 'me'] as const,
  projects: ['projects'] as const,
  project: (id: string) => ['projects', id] as const,
  documents: (projectId: string) => ['projects', projectId, 'documents'] as const,
  document: (id: string) => ['documents', id] as const,
  conversations: (projectId: string) => ['projects', projectId, 'conversations'] as const,
  insights: (projectId: string, type?: InsightType) => ['projects', projectId, 'insights', type ?? 'all'] as const,
  evidence: (projectId: string) => ['projects', projectId, 'evidence'] as const,
  gaps: (projectId: string) => ['projects', projectId, 'gaps'] as const,
  brief: (projectId: string) => ['projects', projectId, 'brief'] as const,
  /** Everything derived from an analysis, for invalidation. */
  analysis: (projectId: string) =>
    [
      ['projects', projectId, 'insights'],
      ['projects', projectId, 'evidence'],
      ['projects', projectId, 'gaps'],
      ['projects', projectId, 'brief'],
    ] as const,
};
