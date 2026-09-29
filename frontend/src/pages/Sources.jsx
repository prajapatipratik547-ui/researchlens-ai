import { useEffect, useRef, useState } from 'react';
import { useOutletContext } from 'react-router';
import { FileText, X } from 'lucide-react';
import { toast } from 'sonner';
import UploadZone from '../components/UploadZone';
import SourceCard from '../components/SourceCard';
import DocumentViewer from '../components/DocumentViewer';
import ConfirmDialog from '../components/ConfirmDialog';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import LoadingState from '../components/LoadingState';
import { useFetch } from '../hooks/useFetch';
import { documentsApi, getErrorMessage } from '../services/api';
import { checkFiles, inBatches, PENDING_STATUSES } from '../utils/files';
import { plural } from '../utils/format';

const POLL_MS = 2500;

export default function Sources() {
  const { project, reload: reloadProject } = useOutletContext();
  const { data: documents, error, loading, reload } = useFetch(`documents:${project.id}`, () =>
    documentsApi.list(project.id),
  );

  const [uploads, setUploads] = useState([]); // in-flight batches: { id, names, progress }
  const [rejected, setRejected] = useState([]); // { name, reason }
  const [viewing, setViewing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const pending = documents?.filter((d) => PENDING_STATUSES.includes(d.processingStatus)).length ?? 0;

  // Poll while files are processing.
  useEffect(() => {
    if (!pending) return undefined;
    const timer = setTimeout(reload, POLL_MS);
    return () => clearTimeout(timer);
  }, [documents, pending, reload]);

  // When the last file finishes, refresh the project (its status and source
  // count in the top bar change).
  const wasPending = useRef(0);
  useEffect(() => {
    if (wasPending.current && !pending) {
      reloadProject();
      const failed = documents.filter((d) => d.processingStatus === 'failed').length;
      if (!failed) toast.success('Sources are ready for research');
    }
    wasPending.current = pending;
  }, [pending, documents, reloadProject]);

  async function handleFiles(files) {
    const { accepted, rejected: bad } = checkFiles(files);
    setRejected(bad);
    if (!accepted.length) return;

    for (const batch of inBatches(accepted)) {
      const id = crypto.randomUUID();
      setUploads((u) => [...u, { id, names: batch.map((f) => f.name), progress: 0 }]);
      try {
        await documentsApi.upload(project.id, batch, (progress) =>
          setUploads((u) => u.map((item) => (item.id === id ? { ...item, progress } : item))),
        );
        reload();
      } catch (err) {
        const details = err.response?.data?.error?.details;
        if (Array.isArray(details) && details.length) {
          setRejected((r) => [...r, ...details.map((d) => ({ name: d.field, reason: d.message }))]);
        }
        toast.error(getErrorMessage(err, 'Upload failed'));
      } finally {
        setUploads((u) => u.filter((item) => item.id !== id));
      }
    }
  }

  async function confirmDelete() {
    setDeleteBusy(true);
    try {
      await documentsApi.remove(deleting.id);
      toast.success(`Removed ${deleting.filename}`);
      setDeleting(null);
      reload();
      reloadProject();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not delete this source.'));
    } finally {
      setDeleteBusy(false);
    }
  }

  let list;
  if (loading && !documents) {
    list = <LoadingState label="Loading sources…" />;
  } else if (error) {
    list = <ErrorState title="Couldn’t load sources" message={getErrorMessage(error)} onRetry={reload} />;
  } else if (!documents.length && !uploads.length) {
    list = (
      <EmptyState
        icon={FileText}
        title="No sources yet"
        description="Add the studies, reports and articles you want to research. Every AI answer will cite them."
      />
    );
  } else {
    list = (
      <ul className="space-y-3" aria-label="Sources">
        {uploads.map((item) => (
          <li key={item.id} className="card p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium text-slate-900">
                Uploading {item.names.length === 1 ? item.names[0] : plural(item.names.length, 'file')}
              </span>
              <span className="text-slate-500 tabular-nums">{item.progress}%</span>
            </div>
            <div
              className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-valuenow={item.progress}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Upload progress"
            >
              <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${item.progress}%` }} />
            </div>
          </li>
        ))}
        {documents.map((doc) => (
          <SourceCard key={doc.id} document={doc} onView={(d) => setViewing(d.id)} onDelete={setDeleting} />
        ))}
      </ul>
    );
  }

  const readyCount = documents?.filter((d) => d.processingStatus === 'ready').length ?? 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Sources</h2>
          <p className="mt-1 text-sm text-slate-600">
            {documents
              ? `${plural(readyCount, 'source')} ready${pending ? ` · ${pending} processing` : ''}`
              : 'Your research corpus'}
          </p>
        </div>
      </div>

      <UploadZone onFiles={handleFiles} />

      {rejected.length > 0 && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <div className="flex items-start justify-between gap-3">
            <p className="font-medium">
              {rejected.length === 1 ? 'This file wasn’t uploaded' : `${rejected.length} files weren’t uploaded`}
            </p>
            <button type="button" onClick={() => setRejected([])} className="-m-1 p-1" aria-label="Dismiss">
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
          <ul className="mt-2 space-y-1">
            {rejected.map((r, i) => (
              <li key={`${r.name}-${i}`}>
                <span className="font-medium">{r.name}</span>: {r.reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {list}

      {viewing && <DocumentViewer documentId={viewing} onClose={() => setViewing(null)} />}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Remove this source?"
        message={
          <>
            <strong className="font-medium text-slate-800">{deleting?.filename}</strong> will be removed from
            this project. If you have run an analysis, you’ll need to run it again.
          </>
        }
        confirmLabel={deleteBusy ? 'Removing…' : 'Remove source'}
        busy={deleteBusy}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
    </div>
  );
}
