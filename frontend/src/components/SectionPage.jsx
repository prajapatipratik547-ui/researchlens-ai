/** Heading + intro shared by the workspace's analysis sections. `wide` suits tables. */
export default function SectionPage({ title, description, actions, wide = false, children }) {
  return (
    <div className={`mx-auto space-y-6 ${wide ? 'max-w-7xl' : 'max-w-5xl'}`}>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
          {description && <p className="mt-1 max-w-2xl text-sm text-slate-600">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </header>
      {children}
    </div>
  );
}
