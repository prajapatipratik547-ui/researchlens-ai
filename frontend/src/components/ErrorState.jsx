import { AlertTriangle, RotateCw } from 'lucide-react';

export default function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  action,
}) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center rounded-2xl border border-rose-200 bg-rose-50/60 px-6 py-12 text-center"
    >
      <div className="flex size-12 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
        <AlertTriangle className="size-6" aria-hidden="true" />
      </div>
      <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
      {message && <p className="mt-1.5 max-w-md text-sm text-slate-600">{message}</p>}
      {(onRetry || action) && (
        <div className="mt-6 flex gap-3">
          {onRetry && (
            <button type="button" onClick={onRetry} className="btn-secondary">
              <RotateCw className="size-4" aria-hidden="true" />
              Try again
            </button>
          )}
          {action}
        </div>
      )}
    </div>
  );
}
