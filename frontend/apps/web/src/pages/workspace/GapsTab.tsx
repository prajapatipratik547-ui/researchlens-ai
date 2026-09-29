import { useGaps } from '../../hooks/useResearch';
import { AnalysisMeta, NeedsAnalysis } from '../../components/workspace/AnalysisStatus';
import { InsightCard } from '../../components/workspace/InsightCard';
import { useWorkspace } from '../../components/workspace/context';
import { ErrorState, LoadingRegion, Skeleton } from '../../components/ui/States';

export function GapsTab() {
  const { project, openDocument } = useWorkspace();
  const gaps = useGaps(project.id);

  if (gaps.isPending) {
    return (
      <LoadingRegion label="Loading research gaps">
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      </LoadingRegion>
    );
  }
  if (gaps.isError) return <ErrorState error={gaps.error} onRetry={() => void gaps.refetch()} />;
  if (!gaps.data.analyzedAt) return <NeedsAnalysis what="research gaps view" />;

  return (
    <div>
      <AnalysisMeta analyzedAt={gaps.data.analyzedAt} outdated={gaps.data.outdated} />
      <p className="mb-5 max-w-2xl text-[13.5px] text-white/55">
        What your sources don’t cover — useful for scoping further reading or your own study.
      </p>
      {gaps.data.gaps.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/12 px-6 py-10 text-center text-sm text-white/50">
          The analysis didn’t find any research gaps in these sources.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {gaps.data.gaps.map((g) => (
            <InsightCard key={g.id} insight={g} openDocument={openDocument} />
          ))}
        </div>
      )}
    </div>
  );
}
