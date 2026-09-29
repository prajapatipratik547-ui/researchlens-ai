import { useState } from 'react';
import type { InsightType } from '@synapse/shared';
import { useInsights } from '../../hooks/useResearch';
import { AnalysisMeta, NeedsAnalysis } from '../../components/workspace/AnalysisStatus';
import { InsightCard } from '../../components/workspace/InsightCard';
import { INSIGHT_LABEL } from '../../components/workspace/insightLabels';
import { useWorkspace } from '../../components/workspace/context';
import { ErrorState, LoadingRegion, Skeleton } from '../../components/ui/States';

// Research gaps have their own tab.
const FILTERS: Array<{ value: InsightType | undefined; label: string }> = [
  { value: undefined, label: 'All' },
  { value: 'key_finding', label: 'Key findings' },
  { value: 'theme', label: 'Themes' },
  { value: 'contradiction', label: 'Contradictions' },
  { value: 'unanswered_question', label: 'Unanswered questions' },
];

export function InsightsTab() {
  const { project, openDocument } = useWorkspace();
  const [type, setType] = useState<InsightType | undefined>(undefined);
  const insights = useInsights(project.id, type);

  const list = insights.data?.insights.filter((i) => type || i.type !== 'research_gap') ?? [];

  return (
    <div>
      <div role="group" aria-label="Filter insights" className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.label}
            type="button"
            aria-pressed={type === f.value}
            onClick={() => setType(f.value)}
            className={`rounded-full px-3.5 py-1.5 text-[13px] ring-1 ${
              type === f.value ? 'bg-white text-ink ring-white' : 'text-white/60 ring-white/12 hover:text-white'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {insights.isPending ? (
        <LoadingRegion label="Loading insights">
          <div className="grid gap-4 md:grid-cols-2">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 rounded-2xl" />
            ))}
          </div>
        </LoadingRegion>
      ) : insights.isError ? (
        <ErrorState error={insights.error} onRetry={() => void insights.refetch()} />
      ) : !insights.data.analyzedAt ? (
        <NeedsAnalysis what="insights view" />
      ) : (
        <>
          <AnalysisMeta analyzedAt={insights.data.analyzedAt} outdated={insights.data.outdated} />
          {list.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/12 px-6 py-10 text-center text-sm text-white/50">
              No {type ? INSIGHT_LABEL[type].toLowerCase() + 's' : 'insights'} in this analysis.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {list.map((i) => (
                <InsightCard key={i.id} insight={i} openDocument={openDocument} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
