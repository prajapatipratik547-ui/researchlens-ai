import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateProjectRequest } from '@synapse/shared';
import { projectsApi } from '../lib/endpoints';
import { qk } from '../lib/queryKeys';

export function useProjects() {
  return useQuery({ queryKey: qk.projects, queryFn: projectsApi.list });
}

export function useProject(id: string) {
  return useQuery({ queryKey: qk.project(id), queryFn: () => projectsApi.get(id) });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateProjectRequest) => projectsApi.create(body),
    onSuccess: (project) => {
      qc.setQueryData(qk.project(project.id), project);
      void qc.invalidateQueries({ queryKey: qk.projects, exact: true });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => projectsApi.remove(id),
    onSuccess: (_, id) => {
      qc.removeQueries({ queryKey: qk.project(id) });
      void qc.invalidateQueries({ queryKey: qk.projects, exact: true });
    },
  });
}
