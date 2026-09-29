import { FileText } from 'lucide-react';

/** A cited file (and page) that opens the source viewer when clicked. */
export default function SourceButton({ name, page, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex max-w-full items-center gap-1 rounded-md text-xs font-medium text-brand-700 hover:text-brand-900 hover:underline"
    >
      <FileText className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{name}</span>
      {page ? <span className="shrink-0 text-slate-500">· p. {page}</span> : null}
    </button>
  );
}
