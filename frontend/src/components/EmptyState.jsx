export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-14 text-center">
      {Icon && (
        <div className="flex size-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <Icon className="size-6" aria-hidden="true" />
        </div>
      )}
      <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-sm text-slate-600">{description}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
