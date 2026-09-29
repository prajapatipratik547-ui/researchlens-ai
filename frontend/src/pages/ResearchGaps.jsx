import { useState } from 'react';
import { useOutletContext } from 'react-router';
import { Info, SearchX } from 'lucide-react';
import { AnalysisBanner, NeedsAnalysis } from '../components/AnalysisState';
import DocumentViewer from '../components/DocumentViewer';
import ErrorState from '../components/ErrorState';
import InsightCard from '../components/InsightCard';
import LoadingState from '../components/LoadingState';
import SectionPage from '../components/SectionPage';
import { useAnalysisData } from '../hooks/useAnalysisData';
import { getErrorMessage, researchApi } from '../services/api';

export default function ResearchGaps() {
  const { project, analysis } = useOutletContext();
  const [viewing, setViewing] = useState(null);
  const { data, error, loading, reload } = useAnalysisData('gaps', project, async () => {
    const [gaps, questions] = await Promise.all([
      researchApi.gaps(project.id),
      researchApi.insights(project.id, 'unanswered_question'),
    ]);
    return { ...gaps, questions: questions.insights };
  });

  const description = 'What your sources don’t cover yet, and the parts of your research question they can’t answer.';
  const open = (documentId, quote) => setViewing({ documentId, quote });

  let body;
  if (!project.analyzedAt) {
    body = (
      <NeedsAnalysis icon={SearchX} title="No research gaps yet" description={description} project={project} analysis={analysis} />
    );
  } else if (loading && !data) {
    body = <LoadingState label="Loading research gaps…" />;
  } else if (error) {
    body = <ErrorState title="Couldn’t load research gaps" message={getErrorMessage(error)} onRetry={reload} />;
  } else {
    body = (
      <>
        <AnalysisBanner analyzedAt={data.analyzedAt} outdated={data.outdated} analysis={analysis} />
        <p className="flex gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
          <Info className="mt-0.5 size-4 shrink-0 text-slate-400" aria-hidden="true" />
          Gaps are the AI’s interpretation of what is missing, based on what your sources do cover. A gap without
          cited evidence is never rated above Medium confidence.
        </p>

        <section aria-labelledby="gaps-heading" className="space-y-4">
          <h3 id="gaps-heading" className="font-semibold text-slate-900">
            Research gaps <span className="font-normal text-slate-400">{data.gaps.length}</span>
          </h3>
          {data.gaps.length ? (
            data.gaps.map((gap) => <InsightCard key={gap.id} insight={gap} onOpenSource={open} />)
          ) : (
            <p className="text-sm text-slate-600">No research gaps were identified.</p>
          )}
        </section>

        {data.questions.length > 0 && (
          <section aria-labelledby="questions-heading" className="space-y-4">
            <h3 id="questions-heading" className="font-semibold text-slate-900">
              Unanswered questions <span className="font-normal text-slate-400">{data.questions.length}</span>
            </h3>
            {data.questions.map((q) => (
              <InsightCard key={q.id} insight={q} onOpenSource={open} />
            ))}
          </section>
        )}
      </>
    );
  }

  return (
    <SectionPage title="Research Gaps" description={description}>
      {body}
      {viewing && (
        <DocumentViewer documentId={viewing.documentId} highlight={viewing.quote} onClose={() => setViewing(null)} />
      )}
    </SectionPage>
  );
}
