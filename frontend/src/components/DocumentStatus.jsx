import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

const states = {
  uploading: { label: 'Uploading', className: 'bg-brand-50 text-brand-800', spin: true },
  processing: { label: 'Processing', className: 'bg-brand-50 text-brand-800', spin: true },
  analyzing: { label: 'Analyzing', className: 'bg-amber-50 text-amber-800', spin: true },
  ready: { label: 'Ready', className: 'bg-emerald-50 text-emerald-800', icon: CheckCircle2 },
  failed: { label: 'Failed', className: 'bg-rose-50 text-rose-700', icon: AlertCircle },
};

export default function DocumentStatus({ status }) {
  const { label, className, spin, icon: Icon } = states[status] ?? states.processing;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      {spin ? (
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
      ) : (
        <Icon className="size-3.5" aria-hidden="true" />
      )}
      {label}
    </span>
  );
}
