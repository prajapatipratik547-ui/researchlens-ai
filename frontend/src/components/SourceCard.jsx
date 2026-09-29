import { Eye, Trash2 } from 'lucide-react';
import DocumentStatus from './DocumentStatus';
import { formatBytes } from '../utils/files';
import { plural } from '../utils/format';

const typeStyles = {
  pdf: 'bg-rose-50 text-rose-700 ring-rose-200',
  docx: 'bg-brand-50 text-brand-800 ring-brand-200',
  txt: 'bg-slate-100 text-slate-700 ring-slate-200',
};

export default function SourceCard({ document, onView, onDelete }) {
  const { filename, fileType, fileSize, processingStatus, processingError, summary, metadata, createdAt } =
    document;
  const ready = processingStatus === 'ready';

  const details = [
    formatBytes(fileSize),
    metadata?.pageCount ? plural(metadata.pageCount, 'page') : null,
    metadata?.wordCount ? `${metadata.wordCount.toLocaleString()} words` : null,
    new Date(createdAt).toLocaleDateString('en', { day: 'numeric', month: 'short' }),
  ].filter(Boolean);

  return (
    <li className="card flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:p-5">
      <span
        className={`flex h-10 w-12 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold tracking-wide uppercase ring-1 ring-inset ${typeStyles[fileType] ?? typeStyles.txt}`}
        aria-hidden="true"
      >
        {fileType}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <h3 className="min-w-0 truncate font-medium text-slate-900" title={filename}>
            {filename}
          </h3>
          <DocumentStatus status={processingStatus} />
        </div>
        <p className="mt-1 text-xs text-slate-500">{details.join(' · ')}</p>
        {processingStatus === 'failed' && processingError && (
          <p className="mt-2 text-sm text-rose-700">{processingError}</p>
        )}
        {ready && summary && (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-600">{summary}</p>
        )}
      </div>

      <div className="flex shrink-0 gap-1 self-end sm:self-start">
        <button
          type="button"
          onClick={() => onView(document)}
          disabled={!ready}
          className="btn-ghost px-3 py-2"
          aria-label={`View ${filename}`}
        >
          <Eye className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">View</span>
        </button>
        <button
          type="button"
          onClick={() => onDelete(document)}
          className="btn-ghost px-3 py-2 hover:bg-rose-50 hover:text-rose-700"
          aria-label={`Delete ${filename}`}
        >
          <Trash2 className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Delete</span>
        </button>
      </div>
    </li>
  );
}
