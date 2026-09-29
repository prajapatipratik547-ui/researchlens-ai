import { useEvidence } from '../../hooks/useResearch';
import { AnalysisMeta, NeedsAnalysis } from '../../components/workspace/AnalysisStatus';
import { useWorkspace } from '../../components/workspace/context';
import { StatusPill } from '../../components/ui/Evidence';
import { ErrorState, LoadingRegion, Skeleton } from '../../components/ui/States';

export function EvidenceTab() {
  const { project, openDocument } = useWorkspace();
  const evidence = useEvidence(project.id);

  if (evidence.isPending) {
    return (
      <LoadingRegion label="Loading evidence matrix">
        <Skeleton className="h-80 rounded-2xl" />
      </LoadingRegion>
    );
  }
  if (evidence.isError) return <ErrorState error={evidence.error} onRetry={() => void evidence.refetch()} />;

  const { matrix, analyzedAt, outdated } = evidence.data;
  if (!matrix || !analyzedAt) return <NeedsAnalysis what="evidence matrix" />;

  return (
    <div>
      <AnalysisMeta analyzedAt={analyzedAt} outdated={outdated} />
      <p className="mb-4 max-w-2xl text-[13.5px] text-white/55">
        Each row is a claim; each column is a source. Cells show whether that source supports, contradicts or is unclear on the
        claim — with the page to check.
      </p>
      {matrix.rows.length === 0 ? (
        <p className="text-sm text-white/50">The analysis didn’t produce any claims to compare.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/8">
          <table className="w-full min-w-[640px] border-collapse text-left text-[13px]">
            <caption className="sr-only">Evidence matrix: claims by source</caption>
            <thead>
              <tr className="bg-white/[0.04]">
                <th scope="col" className="sticky left-0 z-10 w-[240px] bg-ink-2 px-4 py-3 font-medium text-white/60">
                  Claim
                </th>
                {matrix.sources.map((s) => (
                  <th key={s.documentId} scope="col" className="min-w-[200px] px-4 py-3 font-medium">
                    <button
                      type="button"
                      onClick={() => openDocument(s.documentId)}
                      className="max-w-[220px] truncate text-left text-violet-200 underline decoration-violet-300/30 underline-offset-2 hover:decoration-violet-200"
                    >
                      {s.filename}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.rows.map((row) => (
                <tr key={row.id} className="border-t border-white/6 align-top">
                  <th scope="row" className="sticky left-0 z-10 bg-ink-2 px-4 py-4 font-medium text-white/90">
                    {row.claim}
                  </th>
                  {row.cells.map((cell, c) => (
                    <td key={`${row.id}-${c}`} className="px-4 py-4">
                      <StatusPill status={cell.status} compact />
                      {cell.note && <p className="mt-2 leading-snug text-white/60">{cell.note}</p>}
                      {cell.pageNumber != null && <p className="mt-1 text-[12px] text-white/35">p. {cell.pageNumber}</p>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
