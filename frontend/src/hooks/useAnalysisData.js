import { useFetch } from './useFetch';

/**
 * Loads one kind of analysis result. The key includes `analyzedAt`, so the
 * section refetches by itself when a new analysis finishes; before any
 * analysis nothing is requested and `data` is null.
 */
export function useAnalysisData(kind, project, fetcher) {
  return useFetch(`${kind}:${project.id}:${project.analyzedAt ?? 'none'}`, () =>
    project.analyzedAt ? fetcher() : Promise.resolve(null),
  );
}
