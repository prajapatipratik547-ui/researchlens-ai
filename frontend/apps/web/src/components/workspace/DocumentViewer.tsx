import { useDocument } from '../../hooks/useDocuments';
import { formatBytes } from '../../lib/format';
import { Dialog } from '../ui/Dialog';
import { ErrorState, LoadingRegion, Skeleton } from '../ui/States';

/** "View" panel: GET /documents/:id — the only call that returns extractedText. */
export function DocumentViewer({ documentId, onClose }: { documentId: string | null; onClose: () => void }) {
  const doc = useDocument(documentId);
  const d = doc.data;

  return (
    <Dialog open={Boolean(documentId)} onClose={onClose} title={d?.filename ?? 'Source'} size="lg">
      {doc.isPending ? (
        <LoadingRegion label="Loading source">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="mt-4 h-40" />
        </LoadingRegion>
      ) : doc.isError ? (
        <ErrorState error={doc.error} onRetry={() => void doc.refetch()} />
      ) : d ? (
        <div>
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-white/45">
            <span className="uppercase">{d.fileType}</span>
            <span>{formatBytes(d.fileSize)}</span>
            {d.metadata.pageCount != null && <span>{d.metadata.pageCount} pages</span>}
            <span>{d.metadata.wordCount.toLocaleString()} words</span>
          </p>
          {d.summary && (
            <div className="mt-4 rounded-xl border border-violet-300/15 bg-violet-500/[0.07] p-4">
              <p className="font-mono text-[10px] tracking-[0.18em] text-violet-200/70 uppercase">AI summary</p>
              <p className="mt-2 text-[13.5px] leading-relaxed text-white/80">{d.summary}</p>
            </div>
          )}
          <p className="mt-5 font-mono text-[10px] tracking-[0.18em] text-white/40 uppercase">Extracted text</p>
          <pre className="mt-2 max-h-[50svh] overflow-auto rounded-xl bg-black/30 p-4 font-sans text-[13px] leading-relaxed whitespace-pre-wrap text-white/75">
            {d.extractedText || 'No text available for this source.'}
          </pre>
        </div>
      ) : null}
    </Dialog>
  );
}
