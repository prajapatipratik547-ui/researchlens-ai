import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Conversation, InsightType } from '@synapse/shared';
import { researchApi } from '../lib/endpoints';
import { qk } from '../lib/queryKeys';

export function useConversations(projectId: string) {
  return useQuery({ queryKey: qk.conversations(projectId), queryFn: () => researchApi.conversations(projectId) });
}

export function useAsk(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (question: string) => researchApi.ask(projectId, question),
    onSuccess: (conversation) => {
      qc.setQueryData<Conversation[]>(qk.conversations(projectId), (old) => [...(old ?? []), conversation]);
    },
  });
}

export function useAnalyze(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationKey: ['analyze', projectId],
    mutationFn: () => researchApi.analyze(projectId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.project(projectId), exact: true });
      void qc.invalidateQueries({ queryKey: qk.projects, exact: true });
      for (const key of qk.analysis(projectId)) void qc.invalidateQueries({ queryKey: key });
    },
  });
}

export function useInsights(projectId: string, type?: InsightType) {
  return useQuery({ queryKey: qk.insights(projectId, type), queryFn: () => researchApi.insights(projectId, type) });
}

export function useEvidence(projectId: string) {
  return useQuery({ queryKey: qk.evidence(projectId), queryFn: () => researchApi.evidence(projectId) });
}

export function useGaps(projectId: string) {
  return useQuery({ queryKey: qk.gaps(projectId), queryFn: () => researchApi.gaps(projectId) });
}

export function useBrief(projectId: string) {
  // The first request after an analysis generates the brief (10–30 s), then it is cached server-side.
  return useQuery({ queryKey: qk.brief(projectId), queryFn: () => researchApi.brief(projectId), staleTime: Infinity });
}
