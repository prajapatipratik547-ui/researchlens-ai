import { Loader2 } from 'lucide-react';

export default function LoadingState({ label = 'Loading…', fullScreen = false }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-3 text-slate-500 ${
        fullScreen ? 'min-h-screen' : 'py-16'
      }`}
    >
      <Loader2 className="size-6 animate-spin text-brand-600" aria-hidden="true" />
      <span className="text-sm">{label}</span>
    </div>
  );
}
