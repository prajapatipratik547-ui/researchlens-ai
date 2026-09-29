import { CheckCircle2, CircleHelp, Minus, XCircle } from 'lucide-react';

// One visual language for evidence everywhere (chat, matrix, insights):
// colour + icon + word, so it never relies on colour alone.
const variants = {
  supporting: { label: 'Supports', icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  contradicting: { label: 'Contradicts', icon: XCircle, className: 'bg-rose-50 text-rose-700 ring-rose-200' },
  unclear: { label: 'Unclear', icon: CircleHelp, className: 'bg-amber-50 text-amber-800 ring-amber-200' },
  no_evidence: { label: 'No evidence', icon: Minus, className: 'bg-slate-100 text-slate-600 ring-slate-200' },
};

export default function EvidenceBadge({ support, compact = false }) {
  const { label, icon: Icon, className } = variants[support] ?? variants.unclear;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full font-medium ring-1 ring-inset ${className} ${
        compact ? 'px-1.5 py-0.5 text-[11px]' : 'px-2 py-0.5 text-xs'
      }`}
    >
      <Icon className={compact ? 'size-3' : 'size-3.5'} aria-hidden="true" />
      {label}
    </span>
  );
}
