import { useOutletContext } from 'react-router';
import type { Project } from '@synapse/shared';

export interface WorkspaceContext {
  project: Project;
  /** Open the "View" panel for a source (from any citation). */
  openDocument: (documentId: string) => void;
  runAnalysis: () => void;
  analyzing: boolean;
}

export function useWorkspace(): WorkspaceContext {
  return useOutletContext<WorkspaceContext>();
}
