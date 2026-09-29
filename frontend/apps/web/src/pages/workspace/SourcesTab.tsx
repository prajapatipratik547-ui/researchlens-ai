import { useRef, useState, type DragEvent } from 'react';
import { LIMITS, type ProcessingStatus, type SourceDocument } from '@synapse/shared';
import { isSettled, useDeleteDocument, useDocuments, useUploadDocuments } from '../../hooks/useDocuments';
import { useToast } from '../../context/toast';
import { toApiError } from '../../lib/errors';
import { formatBytes, plural, timeAgo } from '../../lib/format';
import { useWorkspace } from '../../components/workspace/context';
import { Button } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';
import { FormError } from '../../components/ui/Field';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState, ErrorState, LoadingRegion, Skeleton } from '../../components/ui/States';

const ACCEPT = LIMITS.upload.extensions.join(',');

/** Client-side check mirroring the backend, so obvious mistakes never leave the browser. */
function validate(files: File[]): string[] {
  const problems: string[] = [];
  if (files.length > LIMITS.upload.maxFiles) problems.push(`Upload at most ${LIMITS.upload.maxFiles} files at a time.`);
  for (const f of files) {
    if (!LIMITS.upload.extensions.some((ext) => f.name.toLowerCase().endsWith(ext))) {
      problems.push(`${f.name}: only PDF, DOCX and TXT files are supported.`);
    } else if (f.size > LIMITS.upload.maxBytes) {
      problems.push(`${f.name}: larger than 10 MB (${formatBytes(f.size)}).`);
    }
  }
  return problems;
}

const STATUS: Record<ProcessingStatus, { label: string; className: string; busy?: boolean }> = {
  processing: { label: 'Processing', className: 'text-violet-200 bg-violet-500/15 ring-violet-300/30', busy: true },
  analyzing: { label: 'Analyzing', className: 'text-violet-200 bg-violet-500/15 ring-violet-300/30', busy: true },
  ready: { label: 'Ready', className: 'text-[#7ee2bd] bg-support/15 ring-support/40' },
  failed: { label: 'Failed', className: 'text-[#ff8aa3] bg-contradict/15 ring-contradict/40' },
};

const STATUS_HINT: Partial<Record<ProcessingStatus, string>> = {
  processing: 'Extracting text and splitting it into passages…',
  analyzing: 'Writing a short summary…',
};

function StatusBadge({ status }: { status: ProcessingStatus }) {
  const s = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-medium ring-1 ${s.className}`}>
      {s.busy ? <Spinner className="size-3" /> : <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />}
      {s.label}
    </span>
  );
}

function FileIcon({ type }: { type: SourceDocument['fileType'] }) {
  return (
    <span className="grid h-11 w-9 shrink-0 place-items-center rounded-md bg-white/[0.07] font-mono text-[9px] font-medium text-white/60 uppercase ring-1 ring-white/10">
      {type}
    </span>
  );
}

function DocumentRow({
  doc,
  onView,
  onDelete,
}: {
  doc: SourceDocument;
  onView: () => void;
  onDelete: () => void;
}) {
  return (
    <li className="flex flex-col gap-4 rounded-2xl border border-white/8 bg-white/[0.03] p-4 sm:flex-row sm:items-start">
      <FileIcon type={doc.fileType} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <p className="truncate text-[14.5px] font-medium text-white">{doc.filename}</p>
          <StatusBadge status={doc.processingStatus} />
        </div>
        <p className="mt-1 flex flex-wrap gap-x-3 text-[12px] text-white/40">
          <span>{formatBytes(doc.fileSize)}</span>
          {doc.processingStatus === 'ready' && doc.metadata.pageCount != null && <span>{plural(doc.metadata.pageCount, 'page')}</span>}
          {doc.processingStatus === 'ready' && <span>{doc.metadata.wordCount.toLocaleString()} words</span>}
          <span>Added {timeAgo(doc.createdAt)}</span>
        </p>
        {doc.processingStatus === 'failed' ? (
          <p className="mt-2 text-[13px] text-[#ff8aa3]">{doc.processingError || 'This file couldn’t be processed.'}</p>
        ) : doc.processingStatus === 'ready' ? (
          doc.summary ? (
            <p className="mt-2 text-[13px] leading-relaxed text-white/60">{doc.summary}</p>
          ) : (
            <p className="mt-2 text-[12.5px] text-white/35">No summary available — the source is still searchable.</p>
          )
        ) : (
          <p className="mt-2 text-[12.5px] text-white/45">{STATUS_HINT[doc.processingStatus]}</p>
        )}
      </div>
      <div className="flex gap-2 sm:flex-col">
        <Button variant="secondary" size="sm" onClick={onView} disabled={doc.processingStatus !== 'ready'}>
          View
        </Button>
        <Button variant="ghost" size="sm" onClick={onDelete} disabled={!isSettled(doc)}>
          Delete
        </Button>
      </div>
    </li>
  );
}

export function SourcesTab() {
  const { project, openDocument } = useWorkspace();
  const docs = useDocuments(project.id);
  const upload = useUploadDocuments(project.id);
  const del = useDeleteDocument(project.id);
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [toDelete, setToDelete] = useState<SourceDocument | null>(null);

  const start = (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (files.length === 0) return;
    const issues = validate(files);
    setProblems(issues);
    if (issues.length) return;
    upload.mutate(files, {
      onSuccess: (created) => toast.show(`${plural(created.length, 'file')} uploaded — processing now.`, 'success'),
      onError: (err) => {
        const e = toApiError(err);
        setProblems(e.details.length ? e.details.map((d) => `${d.field}: ${d.message}`) : [e.message]);
      },
    });
    if (input.current) input.current.value = '';
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (!upload.isPending) start(e.dataTransfer.files);
  };

  const confirmDelete = () => {
    if (!toDelete) return;
    del.mutate(toDelete.id, {
      onSuccess: () => {
        toast.show(
          project.status === 'analyzed' ? 'Source deleted. Re-run the analysis to update results.' : 'Source deleted.',
          'success',
        );
        setToDelete(null);
      },
      onError: (err) => toast.show(toApiError(err).message, 'error'),
    });
  };

  const pending = docs.data?.filter((d) => !isSettled(d)).length ?? 0;

  return (
    <div className="space-y-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`relative flex flex-col items-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
          dragging ? 'border-violet-300 bg-violet-500/10' : 'border-white/12 bg-white/[0.02]'
        }`}
      >
        {upload.isPending ? (
          <div className="w-full max-w-sm" role="status" aria-live="polite">
            <p className="text-sm text-white/80">Uploading… {upload.progress ?? 0}%</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full origin-left rounded-full bg-violet-300 transition-transform duration-200"
                style={{ transform: `scaleX(${(upload.progress ?? 0) / 100})` }}
              />
            </div>
          </div>
        ) : (
          <>
            <p className="text-[15px] text-white">Drop files here, or</p>
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => input.current?.click()}>
              Choose files
            </Button>
            <p className="mt-4 text-[12.5px] text-white/40">
              PDF, DOCX or TXT · up to {LIMITS.upload.maxFiles} files at a time · 10 MB each. Scanned PDFs without text aren’t
              supported.
            </p>
          </>
        )}
        <input
          ref={input}
          type="file"
          multiple
          accept={ACCEPT}
          className="sr-only"
          aria-label="Choose files to upload"
          onChange={(e) => start(e.target.files)}
        />
      </div>

      {problems.length > 0 && (
        <FormError>
          <p className="font-medium">Nothing was uploaded.</p>
          <ul className="mt-1 list-disc pl-5">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </FormError>
      )}

      {docs.isPending ? (
        <LoadingRegion label="Loading sources">
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        </LoadingRegion>
      ) : docs.isError ? (
        <ErrorState error={docs.error} onRetry={() => void docs.refetch()} />
      ) : docs.data.length === 0 ? (
        <EmptyState
          title="No sources yet"
          body="Upload the papers, reports or notes this project should draw from. The AI will only ever answer from these files."
        />
      ) : (
        <section aria-labelledby="sources-heading">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 id="sources-heading" className="text-[15px] font-medium">
              {plural(docs.data.length, 'source')}
            </h2>
            {pending > 0 && (
              <p className="text-[12.5px] text-white/45" aria-live="polite">
                {plural(pending, 'file')} still processing — this page updates automatically.
              </p>
            )}
          </div>
          <ul className="space-y-3">
            {docs.data.map((d) => (
              <DocumentRow key={d.id} doc={d} onView={() => openDocument(d.id)} onDelete={() => setToDelete(d)} />
            ))}
          </ul>
        </section>
      )}

      <Dialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        title="Delete this source?"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setToDelete(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" loading={del.isPending} onClick={confirmDelete}>
              Delete source
            </Button>
          </>
        }
      >
        <p>
          <strong className="font-medium text-white">{toDelete?.filename}</strong> will be removed from this project.
          {project.status === 'analyzed' && ' The current analysis will be marked outdated.'}
        </p>
      </Dialog>
    </div>
  );
}
