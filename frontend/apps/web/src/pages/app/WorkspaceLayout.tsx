import { useCallback, useState } from 'react';
import { Link, NavLink, Outlet, useParams } from 'react-router';
import { useProject } from '../../hooks/useProjects';
import { useAnalyze } from '../../hooks/useResearch';
import { useToast } from '../../context/toast';
import { ApiError } from '../../lib/errors';
import { plural } from '../../lib/format';
import { ProjectStatusBadge } from '../../components/app/ProjectStatus';
import { DocumentViewer } from '../../components/workspace/DocumentViewer';
import type { WorkspaceContext } from '../../components/workspace/context';
import { Button, ButtonLink } from '../../components/ui/Button';
import { ErrorState, Skeleton } from '../../components/ui/States';
import { Sparkle } from '../../components/ui/Sparkle';
import { Elapsed } from '../../components/ui/Elapsed';

const TABS = [
  { to: '', label: 'Overview', end: true },
  { to: 'sources', label: 'Sources' },
  { to: 'assistant', label: 'AI Assistant' },
  { to: 'evidence', label: 'Evidence Matrix' },
  { to: 'insights', label: 'Insights' },
  { to: 'gaps', label: 'Research Gaps' },
  { to: 'brief', label: 'Research Brief' },
] as const;

function NotFound() {
  return (
    <main className="mx-auto grid max-w-lg place-items-center px-4 py-24 text-center">
      <Sparkle className="size-8 text-violet-300" />
      <h1 className="display mt-6 text-4xl">Project not found</h1>
      <p className="mt-3 text-sm text-white/55">It may have been deleted, or it belongs to another account.</p>
      <ButtonLink to="/dashboard" variant="secondary" className="mt-8">
        Back to dashboard
      </ButtonLink>
    </main>
  );
}

export function WorkspaceLayout() {
  const { id = '' } = useParams();
  const project = useProject(id);
  const analyze = useAnalyze(id);
  const toast = useToast();
  const [viewing, setViewing] = useState<string | null>(null);

  const runAnalysis = useCallback(() => {
    analyze.mutate(undefined, {
      onSuccess: (a) => toast.show(`Analysis complete — ${plural(a.sourceCount, 'source')} analyzed.`, 'success'),
      onError: (err) => toast.show(err instanceof ApiError ? err.message : 'Analysis failed. Try again.', 'error'),
    });
  }, [analyze, toast]);

  if (project.isPending) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6" role="status">
        <span className="sr-only">Loading project</span>
        <Skeleton className="h-4 w-24" />
        <Skeleton className="mt-5 h-10 w-2/3" />
        <Skeleton className="mt-8 h-10 w-full" />
        <Skeleton className="mt-8 h-64 w-full" />
      </main>
    );
  }
  if (project.isError) {
    const e = project.error;
    if (e instanceof ApiError && (e.status === 404 || e.status === 400)) return <NotFound />;
    return (
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <ErrorState error={e} onRetry={() => void project.refetch()} />
      </main>
    );
  }

  const p = project.data;
  const canAnalyze = p.status !== 'draft';
  const ctx: WorkspaceContext = {
    project: p,
    openDocument: setViewing,
    runAnalysis,
    analyzing: analyze.isPending,
  };

  return (
    <main className="mx-auto max-w-7xl px-4 pt-8 pb-20 sm:px-6">
      <Link to="/dashboard" className="text-[13px] text-white/50 hover:text-white">
        ← Dashboard
      </Link>
      <div className="mt-5 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <ProjectStatusBadge status={p.status} />
            <span className="text-[12.5px] text-white/40">
              {plural(p.stats.sourceCount, 'ready source')} · {plural(p.stats.insightCount, 'insight')} ·{' '}
              {plural(p.stats.gapCount, 'gap')}
            </span>
          </div>
          <h1 className="display mt-3 text-[clamp(28px,3.4vw,44px)] leading-[1.02] text-balance">{p.title}</h1>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-1.5 lg:items-end">
          <Button onClick={runAnalysis} loading={analyze.isPending} disabled={!canAnalyze} icon={<Sparkle className="size-3.5" />}>
            {analyze.isPending ? (
              <>
                Analyzing… <Elapsed />s
              </>
            ) : p.status === 'analyzed' ? (
              'Re-run analysis'
            ) : (
              'Run analysis'
            )}
          </Button>
          <p className="text-[12px] text-white/40" aria-live="polite">
            {analyze.isPending
              ? 'A full analysis usually takes 20–60 seconds.'
              : canAnalyze
                ? 'Reads every ready source.'
                : 'Upload a source and wait until it’s ready.'}
          </p>
        </div>
      </div>

      <nav aria-label="Workspace" className="no-scrollbar -mx-4 mt-8 overflow-x-auto overflow-y-hidden border-b border-white/8 px-4 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-1">
          {TABS.map((t) => (
            <li key={t.label}>
              <NavLink
                to={t.to}
                end={'end' in t}
                className={({ isActive }) =>
                  `relative block px-3 py-3 text-[13.5px] ${
                    isActive
                      ? 'text-white after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-violet-300'
                      : 'text-white/50 hover:text-white/80'
                  }`
                }
              >
                {t.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-8">
        <Outlet context={ctx} />
      </div>

      <DocumentViewer documentId={viewing} onClose={() => setViewing(null)} />
    </main>
  );
}
