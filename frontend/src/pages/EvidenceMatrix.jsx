import { useState } from 'react';
import { useOutletContext } from 'react-router';
import { FileText, Table2 } from 'lucide-react';
import { AnalysisBanner, NeedsAnalysis } from '../components/AnalysisState';
import DocumentViewer from '../components/DocumentViewer';
import ErrorState from '../components/ErrorState';
import EvidenceBadge from '../components/EvidenceBadge';
import LoadingState from '../components/LoadingState';
import SectionPage from '../components/SectionPage';
import { useAnalysisData } from '../hooks/useAnalysisData';
import { getErrorMessage, researchApi } from '../services/api';

const LEGEND = [
  ['supporting', 'The source backs the claim'],
  ['contradicting', 'The source points the other way'],
  ['unclear', 'Mixed, indirect or ambiguous'],
  ['no_evidence', 'The source doesn’t address it'],
];

const STATUS_WORDS = { supporting: 'supports', contradicting: 'contradicts', unclear: 'is unclear on' };

function Cell({ cell, claim, filename, onOpen }) {
  if (cell.status === 'no_evidence') {
    return (
      <span className="inline-flex" title={`${filename} doesn’t address this claim`}>
        <EvidenceBadge support="no_evidence" compact />
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${filename} ${STATUS_WORDS[cell.status]} “${claim}”${cell.pageNumber ? `, page ${cell.pageNumber}` : ''}. Open source`}
      className="block w-full rounded-lg p-1.5 text-left transition hover:bg-slate-100 focus-visible:bg-slate-100"
    >
      <span className="flex flex-wrap items-center gap-1.5">
        <EvidenceBadge support={cell.status} compact />
        {cell.pageNumber ? <span className="text-[11px] text-slate-500">p. {cell.pageNumber}</span> : null}
      </span>
      {cell.note && <span className="mt-1 line-clamp-3 block text-xs leading-snug text-slate-600">{cell.note}</span>}
    </button>
  );
}

export default function EvidenceMatrix() {
  const { project, analysis } = useOutletContext();
  const [viewing, setViewing] = useState(null);
  const { data, error, loading, reload } = useAnalysisData('evidence', project, () => researchApi.evidence(project.id));

  const description = 'The central claims of your research, checked against every source.';

  let body;
  if (!project.analyzedAt) {
    body = (
      <NeedsAnalysis icon={Table2} title="No evidence matrix yet" description={description} project={project} analysis={analysis} />
    );
  } else if (loading && !data) {
    body = <LoadingState label="Loading the evidence matrix…" />;
  } else if (error) {
    body = <ErrorState title="Couldn’t load the evidence matrix" message={getErrorMessage(error)} onRetry={reload} />;
  } else if (!data.matrix?.rows.length) {
    body = (
      <>
        <AnalysisBanner analyzedAt={data.analyzedAt} outdated={data.outdated} analysis={analysis} />
        <p className="rounded-xl border border-dashed border-slate-300 bg-white/60 px-5 py-8 text-center text-sm text-slate-600">
          The analysis found no claims that could be checked against the sources. Try re-running it.
        </p>
      </>
    );
  } else {
    const { sources, rows } = data.matrix;
    const filenames = new Map(sources.map((s) => [s.documentId, s.filename]));

    body = (
      <>
        <AnalysisBanner analyzedAt={data.analyzedAt} outdated={data.outdated} analysis={analysis} />

        <ul className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Legend">
          {LEGEND.map(([status, meaning]) => (
            <li key={status} className="flex items-center gap-2 text-xs text-slate-600">
              <EvidenceBadge support={status} compact />
              {meaning}
            </li>
          ))}
        </ul>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">
                Evidence matrix: {rows.length} claims checked against {sources.length} sources
              </caption>
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th
                    scope="col"
                    className="sticky left-0 z-10 min-w-48 bg-slate-50 px-4 py-3 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase sm:min-w-64"
                  >
                    Claim
                  </th>
                  {sources.map((s) => (
                    <th key={s.documentId} scope="col" className="min-w-36 px-3 py-3 text-left align-bottom font-medium">
                      <button
                        type="button"
                        onClick={() => setViewing({ documentId: s.documentId, quote: '' })}
                        title={s.filename}
                        className="inline-flex max-w-44 items-center gap-1.5 text-xs text-brand-700 hover:text-brand-900 hover:underline"
                      >
                        <FileText className="size-3.5 shrink-0" aria-hidden="true" />
                        <span className="truncate">{s.filename}</span>
                      </button>
                    </th>
                  ))}
                  <th scope="col" className="px-4 py-3 text-right text-xs font-semibold tracking-wider text-slate-500 uppercase">
                    Coverage
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => {
                  const covered = row.cells.filter((c) => c.status !== 'no_evidence').length;
                  return (
                    <tr key={row.id} className="align-top">
                      <th scope="row" className="sticky left-0 z-10 bg-white px-4 py-3 text-left font-medium text-slate-900">
                        {row.claim}
                      </th>
                      {row.cells.map((cell) => (
                        <td key={cell.documentId} className="px-2 py-2">
                          <Cell
                            cell={cell}
                            claim={row.claim}
                            filename={filenames.get(cell.documentId)}
                            onOpen={() => setViewing({ documentId: cell.documentId, quote: cell.quote })}
                          />
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right text-xs whitespace-nowrap text-slate-600 tabular-nums">
                        {covered} of {sources.length}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Select a cell to open the source at the cited passage. “No evidence” means the analysis found nothing on that
          claim in that source.
        </p>
      </>
    );
  }

  return (
    <SectionPage title="Evidence Matrix" description={description} wide>
      {body}
      {viewing && (
        <DocumentViewer documentId={viewing.documentId} highlight={viewing.quote} onClose={() => setViewing(null)} />
      )}
    </SectionPage>
  );
}
