import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, Clock, Loader2, Play, RotateCw, Upload } from 'lucide-react';
import EmptyState from './EmptyState';
import { plural, timeAgo } from '../utils/format';

/** The Run analysis button, wired to the workspace's shared analysis state. */
export function RunAnalysisButton({ analysis, variant = 'primary', rerun = false }) {
  const { run, busy, blockedReason } = analysis;
  return (
    <button
      type="button"
      onClick={run}
      disabled={busy || Boolean(blockedReason)}
      title={blockedReason || undefined}
      className={`${variant === 'primary' ? 'btn-primary' : 'btn-secondary'} shrink-0`}
    >
      {busy ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : rerun ? (
        <RotateCw className="size-4" aria-hidden="true" />
      ) : (
        <Play className="size-4" aria-hidden="true" />
      )}
      {busy ? 'Analyzing…' : rerun ? 'Re-run analysis' : 'Run analysis'}
    </button>
  );
}

const STEPS = [
  'Reading your sources…',
  'Extracting key findings and themes…',
  'Looking for disagreements between sources…',
  'Checking each claim against every source…',
  'Verifying quotes and page numbers…',
];

/** Shown while an analysis runs (usually 5–60 seconds). */
export function AnalysisProgress({ sourceCount }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 4000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div role="status" className="flex items-center gap-3 border-b border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-900 sm:px-8">
      <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden="true" />
      <span>
        <span className="font-medium">Analyzing {plural(sourceCount, 'source')}.</span> {STEPS[step]}
        <span className="text-brand-700"> This usually takes under a minute.</span>
      </span>
    </div>
  );
}

/** "Analyzed 5 minutes ago", or a warning with Re-run when sources changed. */
export function AnalysisBanner({ analyzedAt, outdated, analysis }) {
  if (!analyzedAt) return null;
  if (outdated) {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            <span className="font-medium">This analysis is outdated.</span> Your sources changed after it ran{' '}
            {timeAgo(analyzedAt)}. Re-run it to include the current sources.
          </span>
        </p>
        <RunAnalysisButton analysis={analysis} variant="secondary" rerun />
      </div>
    );
  }
  return (
    <p className="flex items-center gap-1.5 text-xs text-slate-500">
      <Clock className="size-3.5" aria-hidden="true" />
      Analyzed {timeAgo(analyzedAt)} · AI-generated from your sources; every citation was checked against the source text.
    </p>
  );
}

/** Empty state for sections that need a completed analysis. */
export function NeedsAnalysis({ icon, title, description, project, analysis }) {
  const hasSources = project.stats.sourceCount > 0;
  return (
    <EmptyState
      icon={icon}
      title={title}
      description={
        hasSources
          ? `${description} Run an analysis of your sources to create it.`
          : `${description} Add sources to your project, then run an analysis.`
      }
      action={
        hasSources ? (
          <RunAnalysisButton analysis={analysis} />
        ) : (
          <Link to={`/research/${project.id}/sources`} className="btn-primary">
            <Upload className="size-4" aria-hidden="true" />
            Go to sources
          </Link>
        )
      }
    />
  );
}
