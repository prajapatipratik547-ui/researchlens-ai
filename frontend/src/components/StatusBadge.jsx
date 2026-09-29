const styles = {
  draft: { label: 'Draft', className: 'bg-slate-100 text-slate-700 ring-slate-200' },
  active: { label: 'In progress', className: 'bg-brand-50 text-brand-800 ring-brand-200' },
  analyzed: { label: 'Analyzed', className: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
};

export default function StatusBadge({ status }) {
  const { label, className } = styles[status] ?? styles.draft;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}
    >
      <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden="true" />
      {label}
    </span>
  );
}
