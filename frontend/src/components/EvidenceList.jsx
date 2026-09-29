import { Quote } from 'lucide-react';
import EvidenceBadge from './EvidenceBadge';
import SourceButton from './SourceButton';

/**
 * Evidence rows: status, claim, cited file and page, and the verified quote
 * on expand. Items use { claim, documentId, filename, pageNumber, quote, support }.
 */
export default function EvidenceList({ items, onOpenSource }) {
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((e, i) => (
        <li key={`${e.documentId}-${i}`} className="py-2.5 first:pt-0 last:pb-0">
          <div className="flex items-start gap-2.5">
            <EvidenceBadge support={e.support} />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-slate-800">{e.claim}</p>
              <div className="mt-1">
                <SourceButton
                  name={e.filename}
                  page={e.pageNumber}
                  onClick={() => onOpenSource(e.documentId, e.quote)}
                />
              </div>
              {e.quote && (
                <details className="group mt-1.5">
                  <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-700">Show quote</summary>
                  <blockquote className="mt-1.5 flex gap-2 rounded-lg bg-slate-50 p-2.5 text-sm text-slate-700 italic">
                    <Quote className="mt-0.5 size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                    {e.quote}
                  </blockquote>
                </details>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
