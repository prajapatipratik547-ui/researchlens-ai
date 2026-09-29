import { useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useBrief } from '../../hooks/useResearch';
import { useToast } from '../../context/toast';
import { ApiError } from '../../lib/errors';
import { formatDateTime } from '../../lib/format';
import { AnalysisMeta, NeedsAnalysis } from '../../components/workspace/AnalysisStatus';
import { useWorkspace } from '../../components/workspace/context';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { ErrorState } from '../../components/ui/States';

function Generating() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div role="status" className="flex flex-col items-center rounded-2xl border border-white/8 bg-white/[0.03] px-6 py-16 text-center">
      <Spinner className="size-6 text-violet-300" />
      <p className="mt-4 text-[15px] text-white">Loading the research brief… {seconds}s</p>
      <p className="mt-1 text-[13px] text-white/45">The first brief after an analysis takes 10–30 seconds to write.</p>
    </div>
  );
}

export function BriefTab() {
  const { project } = useWorkspace();
  const brief = useBrief(project.id);
  const toast = useToast();

  if (brief.isPending) return <Generating />;
  if (brief.isError) {
    if (brief.error instanceof ApiError && brief.error.code === 'ANALYSIS_REQUIRED') return <NeedsAnalysis what="research brief" />;
    return <ErrorState error={brief.error} onRetry={() => void brief.refetch()} />;
  }

  const { brief: b, outdated } = brief.data;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(b.markdown);
      toast.show('Brief copied as Markdown.', 'success');
    } catch {
      toast.show('Couldn’t access the clipboard. Use Download instead.', 'error');
    }
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([b.markdown], { type: 'text/markdown;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'research-brief.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <AnalysisMeta analyzedAt={project.analyzedAt ?? null} outdated={outdated} />
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[12.5px] text-white/40">Generated {formatDateTime(b.generatedAt)}</p>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => void copy()}>
            Copy Markdown
          </Button>
          <Button size="sm" onClick={download}>
            Download .md
          </Button>
        </div>
      </div>
      <article className="brief rounded-2xl border border-white/8 bg-white/[0.03] px-5 py-8 sm:px-10">
        <Markdown remarkPlugins={[remarkGfm]}>{b.markdown}</Markdown>
      </article>
    </div>
  );
}
