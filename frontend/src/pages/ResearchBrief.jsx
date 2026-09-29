import { Children, useState } from 'react';
import { useOutletContext } from 'react-router';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Check, Copy, Download, Loader2, ScrollText } from 'lucide-react';
import { toast } from 'sonner';
import { AnalysisBanner, NeedsAnalysis } from '../components/AnalysisState';
import DocumentViewer from '../components/DocumentViewer';
import ErrorState from '../components/ErrorState';
import SectionPage from '../components/SectionPage';
import { useAnalysisData } from '../hooks/useAnalysisData';
import { getErrorMessage, researchApi } from '../services/api';

const CITATION = /(\[S\d+(?:, p\. \d+)?(?:; S\d+(?:, p\. \d+)?)*\])/g;

/** "[S1, p. 4; S2]" → one button per cited source that opens it. */
function Citation({ text, sources, onOpen }) {
  const parts = text.slice(1, -1).split('; ');
  return (
    <span className="whitespace-nowrap">
      [
      {parts.map((part, i) => {
        const [, label, page] = /^(S\d+)(?:, p\. (\d+))?$/.exec(part) ?? [];
        const source = sources.find((s) => s.label === label);
        return (
          <span key={part}>
            {i > 0 && '; '}
            {source ? (
              <button
                type="button"
                onClick={() => onOpen(source, page)}
                title={`${source.filename}${page ? `, page ${page}` : ''}`}
                className="rounded font-medium text-brand-700 underline decoration-brand-300 underline-offset-2 hover:text-brand-900"
              >
                {part}
              </button>
            ) : (
              part
            )}
          </span>
        );
      })}
      ]
    </span>
  );
}

function withCitations(children, sources, onOpen) {
  return Children.map(children, (child) =>
    typeof child === 'string'
      ? child.split(CITATION).map((piece, i) =>
          i % 2 ? <Citation key={i} text={piece} sources={sources} onOpen={onOpen} /> : piece,
        )
      : child,
  );
}

function markdownComponents(sources, onOpen) {
  const cite = (children) => withCitations(children, sources, onOpen);
  return {
    h1: ({ children }) => (
      <h1 className="font-display text-2xl leading-tight font-semibold text-slate-900 sm:text-3xl">{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className="mt-9 border-b border-slate-200 pb-2 text-lg font-semibold text-slate-900">{children}</h2>
    ),
    h3: ({ children }) => <h3 className="mt-6 font-semibold text-slate-900">{children}</h3>,
    p: ({ children }) => <p className="mt-3 leading-relaxed text-slate-700">{cite(children)}</p>,
    ul: ({ children }) => <ul className="mt-3 list-disc space-y-2 pl-5 text-slate-700 marker:text-brand-500">{children}</ul>,
    li: ({ children }) => <li className="pl-1 leading-relaxed">{cite(children)}</li>,
    em: ({ children }) => <em className="text-sm text-slate-500">{children}</em>,
    strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
    table: ({ children }) => (
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full border-collapse text-sm">{children}</table>
      </div>
    ),
    th: ({ children, style }) => (
      <th style={style} className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-left font-semibold text-slate-700">
        {children}
      </th>
    ),
    td: ({ children, style }) => (
      <td style={style} className="border-b border-slate-100 px-3 py-2 align-top text-slate-700">
        {children}
      </td>
    ),
  };
}

export default function ResearchBrief() {
  const { project, analysis } = useOutletContext();
  const [viewing, setViewing] = useState(null); // { documentId, highlight, note }
  const [copied, setCopied] = useState(false);
  const { data, error, loading, reload } = useAnalysisData('brief', project, () => researchApi.brief(project.id));

  const description = 'A structured summary of findings, evidence, conflicts and gaps, with every claim cited.';
  const brief = data?.brief;

  async function copy() {
    try {
      await navigator.clipboard.writeText(brief.markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy. Use Download instead.');
    }
  }

  function download() {
    const url = URL.createObjectURL(new Blob([brief.markdown], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'research-brief.md';
    link.click();
    URL.revokeObjectURL(url);
  }

  const openCitation = (source, page) =>
    setViewing({
      documentId: source.documentId,
      highlight: page ? `--- Page ${page} ---` : '',
      note: page ? `Showing page ${page}, the page cited in the brief.` : '',
    });

  let body;
  if (!project.analyzedAt) {
    body = (
      <NeedsAnalysis icon={ScrollText} title="No research brief yet" description={description} project={project} analysis={analysis} />
    );
  } else if (loading && !data) {
    body = (
      <div role="status" className="card flex flex-col items-center px-6 py-14 text-center">
        <Loader2 className="size-6 animate-spin text-brand-600" aria-hidden="true" />
        <p className="mt-4 font-medium text-slate-900">Writing your research brief…</p>
        <p className="mt-1 text-sm text-slate-600">This takes 10–30 seconds the first time, then it opens instantly.</p>
      </div>
    );
  } else if (error) {
    body = <ErrorState title="Couldn’t write the research brief" message={getErrorMessage(error)} onRetry={reload} />;
  } else {
    body = (
      <>
        <AnalysisBanner analyzedAt={project.analyzedAt} outdated={data.outdated} analysis={analysis} />
        <article className="card px-5 py-7 sm:px-10 sm:py-10">
          <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents(brief.sources ?? [], openCitation)}>
            {brief.markdown}
          </Markdown>
        </article>
      </>
    );
  }

  return (
    <SectionPage
      title="Research Brief"
      description={description}
      actions={
        brief && (
          <>
            <button type="button" onClick={copy} className="btn-secondary">
              {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button type="button" onClick={download} className="btn-secondary">
              <Download className="size-4" aria-hidden="true" />
              Download .md
            </button>
          </>
        )
      }
    >
      {body}
      {viewing && (
        <DocumentViewer
          documentId={viewing.documentId}
          highlight={viewing.highlight}
          note={viewing.note}
          onClose={() => setViewing(null)}
        />
      )}
    </SectionPage>
  );
}
