import { useState } from 'react';
import { useOutletContext } from 'react-router';
import { Lightbulb } from 'lucide-react';
import { AnalysisBanner, NeedsAnalysis } from '../components/AnalysisState';
import DocumentViewer from '../components/DocumentViewer';
import ErrorState from '../components/ErrorState';
import InsightCard from '../components/InsightCard';
import LoadingState from '../components/LoadingState';
import SectionPage from '../components/SectionPage';
import { useAnalysisData } from '../hooks/useAnalysisData';
import { getErrorMessage, researchApi } from '../services/api';
import { INSIGHT_TYPES } from '../utils/insightTypes';

// Gaps and unanswered questions live on the Research Gaps page.
const SHOWN_TYPES = ['key_finding', 'theme', 'contradiction'];

export default function Insights() {
  const { project, analysis } = useOutletContext();
  const [filter, setFilter] = useState('all');
  const [viewing, setViewing] = useState(null); // { documentId, quote }
  const { data, error, loading, reload } = useAnalysisData('insights', project, () =>
    researchApi.insights(project.id),
  );

  const description = 'Key findings, recurring themes and potential contradictions across your sources.';

  let body;
  if (!project.analyzedAt) {
    body = (
      <NeedsAnalysis icon={Lightbulb} title="No insights yet" description={description} project={project} analysis={analysis} />
    );
  } else if (loading && !data) {
    body = <LoadingState label="Loading insights…" />;
  } else if (error) {
    body = <ErrorState title="Couldn’t load insights" message={getErrorMessage(error)} onRetry={reload} />;
  } else {
    const insights = data.insights.filter((i) => SHOWN_TYPES.includes(i.type));
    const count = (type) => insights.filter((i) => i.type === type).length;
    const shown = filter === 'all' ? insights : insights.filter((i) => i.type === filter);

    body = (
      <>
        <AnalysisBanner analyzedAt={data.analyzedAt} outdated={data.outdated} analysis={analysis} />
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter insights by type">
          {[['all', 'All', insights.length], ...SHOWN_TYPES.map((t) => [t, INSIGHT_TYPES[t].plural, count(t)])].map(
            ([value, label, n]) => (
              <button
                key={value}
                type="button"
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
                className={`rounded-full px-3.5 py-1.5 text-sm font-medium ring-1 ring-inset transition ${
                  filter === value
                    ? 'bg-brand-700 text-white ring-brand-700'
                    : 'bg-white text-slate-700 ring-slate-200 hover:ring-brand-300'
                }`}
              >
                {label} <span className={filter === value ? 'text-brand-100' : 'text-slate-400'}>{n}</span>
              </button>
            ),
          )}
        </div>

        {shown.length ? (
          <div className="space-y-4">
            {shown.map((insight) => (
              <InsightCard
                key={insight.id}
                insight={insight}
                onOpenSource={(documentId, quote) => setViewing({ documentId, quote })}
              />
            ))}
          </div>
        ) : (
          <p className="rounded-xl border border-dashed border-slate-300 bg-white/60 px-5 py-8 text-center text-sm text-slate-600">
            {filter === 'contradiction'
              ? 'No potential contradictions were found: the sources don’t disagree on anything they both cover.'
              : 'Nothing of this type was found in your sources.'}
          </p>
        )}
      </>
    );
  }

  return (
    <SectionPage title="Insights" description={description}>
      {body}
      {viewing && (
        <DocumentViewer documentId={viewing.documentId} highlight={viewing.quote} onClose={() => setViewing(null)} />
      )}
    </SectionPage>
  );
}
