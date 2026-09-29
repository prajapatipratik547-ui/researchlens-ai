import { formatDateTime } from '../../lib/format';
import { Button, ButtonLink } from '../ui/Button';
import { EmptyState } from '../ui/States';
import { useWorkspace } from './context';

/** Shown by Evidence / Insights / Gaps / Brief before any analysis exists. */
export function NeedsAnalysis({ what }: { what: string }) {
  const { project, runAnalysis, analyzing } = useWorkspace();
  const noSources = project.status === 'draft';
  return (
    <EmptyState
      title={noSources ? 'Add a source first' : 'Run an analysis to see this'}
      body={
        noSources
          ? `The ${what} is built from your sources. Upload at least one and wait until it’s ready.`
          : `The ${what} comes from a full analysis of your ready sources. It usually takes 20–60 seconds.`
      }
      action={
        noSources ? (
          <ButtonLink to={`/research/${project.id}/sources`}>Upload sources</ButtonLink>
        ) : (
          <Button onClick={runAnalysis} loading={analyzing}>
            {analyzing ? 'Analyzing…' : 'Run analysis'}
          </Button>
        )
      }
    />
  );
}

/** When the analysis ran, and a Re-run banner when sources changed since. */
export function AnalysisMeta({ analyzedAt, outdated }: { analyzedAt: string | null; outdated: boolean }) {
  const { runAnalysis, analyzing, project } = useWorkspace();
  if (outdated) {
    return (
      <div
        role="status"
        className="mb-6 flex flex-col gap-3 rounded-xl border border-unclear/40 bg-unclear/10 px-4 py-3 text-[13.5px] sm:flex-row sm:items-center"
      >
        <span aria-hidden="true" className="grid size-5 shrink-0 place-items-center rounded-full bg-unclear text-[11px] font-bold">
          !
        </span>
        <p className="flex-1 text-white/80">
          <strong className="font-medium text-white">Outdated analysis.</strong> Sources changed after the last analysis
          {analyzedAt ? ` (${formatDateTime(analyzedAt)})` : ''}. Re-run it to include them.
        </p>
        <Button size="sm" onClick={runAnalysis} loading={analyzing} disabled={project.status === 'draft'}>
          {analyzing ? 'Analyzing…' : 'Re-run analysis'}
        </Button>
      </div>
    );
  }
  return analyzedAt ? (
    <p className="mb-6 text-[12.5px] text-white/40">Analysis ran {formatDateTime(analyzedAt)}.</p>
  ) : null;
}
