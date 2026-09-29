import { useEffect, useRef } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';

/**
 * Modal confirmation built on the native <dialog>, which provides focus
 * trapping, Escape-to-close and the backdrop for free.
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  busy = false,
  onConfirm,
  onCancel,
}) {
  const ref = useRef(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
      aria-labelledby="confirm-title"
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-slate-200 bg-white p-0 shadow-2xl backdrop:bg-slate-900/40 backdrop:backdrop-blur-[2px]"
    >
      <div className="p-6">
        <div className="flex gap-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
            <AlertTriangle className="size-5" aria-hidden="true" />
          </div>
          <div>
            <h2 id="confirm-title" className="font-semibold text-slate-900">
              {title}
            </h2>
            <div className="mt-1.5 text-sm text-slate-600">{message}</div>
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className="btn bg-rose-600 text-white shadow-sm hover:bg-rose-700"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
