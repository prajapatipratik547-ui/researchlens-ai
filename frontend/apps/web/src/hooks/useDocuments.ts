import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TIMING, type SourceDocument } from '@synapse/shared';
import { documentsApi } from '../lib/endpoints';
import { qk } from '../lib/queryKeys';

export const isSettled = (d: SourceDocument) => d.processingStatus === 'ready' || d.processingStatus === 'failed';

/**
 * Lists a project's sources. Polls every ~2.5 s while any file is processing/analyzing and
 * refetches the project once they all settle (its status and sourceCount change).
 */
export function useDocuments(projectId: string) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: qk.documents(projectId),
    queryFn: () => documentsApi.list(projectId),
    refetchInterval: (q) => (q.state.data?.some((d) => !isSettled(d)) ? TIMING.documentPollMs : false),
    refetchIntervalInBackground: false,
  });

  const pending = query.data?.some((d) => !isSettled(d)) ?? false;
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending) {
      void qc.invalidateQueries({ queryKey: qk.project(projectId), exact: true });
      void qc.invalidateQueries({ queryKey: qk.projects, exact: true });
    }
    wasPending.current = pending;
  }, [pending, projectId, qc]);

  return query;
}

export function useDocument(id: string | null) {
  return useQuery({
    queryKey: qk.document(id ?? ''),
    queryFn: () => documentsApi.get(id!),
    enabled: Boolean(id),
  });
}

/** Upload with client-side progress (0–100) for the "Uploading" state. */
export function useUploadDocuments(projectId: string) {
  const qc = useQueryClient();
  const [progress, setProgress] = useState<number | null>(null);
  const mutation = useMutation({
    mutationFn: (files: File[]) => documentsApi.upload(projectId, files, setProgress),
    onMutate: () => setProgress(0),
    onSuccess: (docs) => {
      qc.setQueryData<SourceDocument[]>(qk.documents(projectId), (old) => [...docs, ...(old ?? [])]);
      void qc.invalidateQueries({ queryKey: qk.documents(projectId) });
    },
    onSettled: () => setProgress(null),
  });
  return { ...mutation, progress };
}

export function useDeleteDocument(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => documentsApi.remove(id),
    onSuccess: (_, id) => {
      qc.setQueryData<SourceDocument[]>(qk.documents(projectId), (old) => old?.filter((d) => d.id !== id));
      qc.removeQueries({ queryKey: qk.document(id) });
      // Project status/stats change, and any analysis is now outdated.
      void qc.invalidateQueries({ queryKey: qk.project(projectId), exact: true });
      void qc.invalidateQueries({ queryKey: qk.projects, exact: true });
      for (const key of qk.analysis(projectId)) void qc.invalidateQueries({ queryKey: key });
    },
  });
}
