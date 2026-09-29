import { useEffect, useRef } from 'react';
import { Quote, X } from 'lucide-react';
import LoadingState from './LoadingState';
import ErrorState from './ErrorState';
import { useFetch } from '../hooks/useFetch';
import { documentsApi, getErrorMessage } from '../services/api';
import { formatBytes } from '../utils/files';
import { plural } from '../utils/format';
import { locateQuote } from '../utils/quotes';

/**
 * Modal showing a source's summary and full text, optionally highlighting a
 * cited quote. `note` replaces the default "passage is highlighted" message.
 */
export default function DocumentViewer({ documentId, highlight = '', note = '', onClose }) {
  const ref = useRef(null);
  const markRef = useRef(null);
  const { data: doc, error, loading, reload } = useFetch(`document:${documentId}`, () =>
    documentsApi.get(documentId),
  );

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const range = doc ? locateQuote(doc.extractedText, highlight) : null;
  const highlightStart = range ? range[0] : null;

  // Bring the cited passage into view once the text has loaded.
  useEffect(() => {
    markRef.current?.scrollIntoView?.({ block: 'center' });
  }, [highlightStart]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      aria-label="Source text"
      className="m-auto flex max-h-[85vh] w-[calc(100%-2rem)] max-w-3xl flex-col rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-900/40"
    >
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
        <div className="min-w-0">
          <h2 className="truncate font-semibold text-slate-900">{doc?.filename ?? 'Source'}</h2>
          {doc && (
            <p className="mt-0.5 text-xs text-slate-500">
              {doc.fileType.toUpperCase()} · {formatBytes(doc.fileSize)}
              {doc.metadata?.pageCount ? ` · ${doc.metadata.pageCount} pages` : ''}
              {doc.metadata?.chunkCount ? ` · ${plural(doc.metadata.chunkCount, 'searchable section')}` : ''}
            </p>
          )}
        </div>
        <button type="button" onClick={onClose} className="btn-ghost -mr-2 px-2" aria-label="Close">
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {loading && !doc ? (
          <LoadingState label="Loading text…" />
        ) : error ? (
          <ErrorState title="Couldn’t load this source" message={getErrorMessage(error)} onRetry={reload} />
        ) : (
          <>
            {highlight && (
              <p className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <Quote className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                {range
                  ? note || 'The cited passage is highlighted below.'
                  : 'The exact cited passage could not be located in this text; it may span a page break.'}
              </p>
            )}
            {doc.summary && (
              <section className="mb-5 rounded-xl bg-brand-50 p-4">
                <h3 className="text-xs font-semibold tracking-wider text-brand-800 uppercase">Summary</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-700">{doc.summary}</p>
              </section>
            )}
            <h3 className="text-xs font-semibold tracking-wider text-slate-500 uppercase">Extracted text</h3>
            <pre className="mt-2 font-sans text-sm leading-relaxed whitespace-pre-wrap text-slate-700">
              {range ? (
                <>
                  {doc.extractedText.slice(0, range[0])}
                  <mark ref={markRef} className="rounded bg-amber-200 px-0.5 text-slate-900">
                    {doc.extractedText.slice(range[0], range[1])}
                  </mark>
                  {doc.extractedText.slice(range[1])}
                </>
              ) : (
                doc.extractedText
              )}
            </pre>
          </>
        )}
      </div>
    </dialog>
  );
}
