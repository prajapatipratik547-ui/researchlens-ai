import { useCallback, useEffect, useState } from 'react';
import { Link, Outlet, useParams } from 'react-router';
import { ArrowLeft, FileText } from 'lucide-react';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import StatusBadge from '../components/StatusBadge';
import LoadingState from '../components/LoadingState';
import ErrorState from '../components/ErrorState';
import { AnalysisProgress, RunAnalysisButton } from '../components/AnalysisState';
import { useFetch } from '../hooks/useFetch';
import { aiApi, getErrorMessage, projectsApi, researchApi } from '../services/api';
import { plural } from '../utils/format';

// While an analysis started elsewhere (another tab, or before a page reload)
// is running, refresh the project this often to notice when it finishes.
const POLL_MS = 4000;

/**
 * Layout for one research project: top bar + section navigation. Loads the
 * project once and shares it, plus the Run analysis state, with every
 * section via the outlet context.
 */
export default function ResearchWorkspace() {
  const { projectId } = useParams();
  const { data: project, error, loading, reload } = useFetch(`project:${projectId}`, () =>
    projectsApi.get(projectId),
  );
  const ai = useFetch('ai-status', aiApi.status);
  const [running, setRunning] = useState(false);

  const runningElsewhere = Boolean(project?.analysisInProgress) && !running;
  useEffect(() => {
    if (!runningElsewhere) return undefined;
    const timer = setTimeout(reload, POLL_MS);
    return () => clearTimeout(timer);
  }, [runningElsewhere, project, reload]);

  const run = useCallback(async () => {
    setRunning(true);
    try {
      const { counts } = await researchApi.analyze(projectId);
      const insights = counts.key_finding + counts.theme + counts.contradiction;
      toast.success(`Analysis complete: ${plural(insights, 'insight')} and ${plural(counts.research_gap, 'research gap')}.`);
    } catch (err) {
      if (err.response?.data?.error?.code === 'ANALYSIS_IN_PROGRESS') {
        toast.info('An analysis is already running. Results will appear when it finishes.');
      } else {
        toast.error(getErrorMessage(err, 'The analysis failed. Please try again.'));
      }
    } finally {
      setRunning(false);
      reload();
    }
  }, [projectId, reload]);

  if (loading && !project) return <LoadingState label="Opening workspace…" fullScreen />;

  if (error) {
    const missing = [400, 404].includes(error.response?.status);
    return (
      <div className="min-h-screen">
        <Navbar />
        <main className="mx-auto max-w-2xl px-4 py-16">
          <ErrorState
            title={missing ? 'Research project not found' : 'Couldn’t open this project'}
            message={
              missing
                ? 'It may have been deleted, or it belongs to a different account.'
                : getErrorMessage(error)
            }
            onRetry={missing ? undefined : reload}
            action={
              <Link to="/dashboard" className="btn-primary">
                Back to dashboard
              </Link>
            }
          />
        </main>
      </div>
    );
  }

  const { sourceCount } = project.stats;
  const busy = running || runningElsewhere;
  let blockedReason = '';
  if (!sourceCount) blockedReason = 'Upload at least one source to run an analysis.';
  else if (ai.data?.configured === false) blockedReason = 'The AI service is not configured on the server.';
  const analysis = { run, busy, blockedReason };

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar width="max-w-none" />
      <div className="flex flex-1 flex-col lg:flex-row">
        <Sidebar projectId={project.id} />

        <div className="min-w-0 flex-1">
          <header className="border-b border-slate-200 bg-white">
            <div className="flex flex-col gap-4 px-4 py-5 sm:px-8 md:flex-row md:items-center md:justify-between">
              <div className="min-w-0">
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800"
                >
                  <ArrowLeft className="size-3.5" aria-hidden="true" />
                  All projects
                </Link>
                <h1 className="mt-1 line-clamp-2 font-display text-2xl font-semibold tracking-tight text-slate-900">
                  {project.title}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                  <StatusBadge status={project.status} />
                  <span className="flex items-center gap-1.5">
                    <FileText className="size-4 text-slate-400" aria-hidden="true" />
                    {plural(sourceCount, 'source')}
                  </span>
                </div>
              </div>
              <div className="self-start md:self-auto">
                <RunAnalysisButton analysis={analysis} rerun={Boolean(project.analyzedAt)} />
              </div>
            </div>
            {busy && <AnalysisProgress sourceCount={sourceCount} />}
          </header>

          <main className="px-4 py-8 sm:px-8">
            <Outlet context={{ project, reload, analysis }} />
          </main>
        </div>
      </div>
    </div>
  );
}
