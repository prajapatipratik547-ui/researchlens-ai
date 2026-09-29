import type { ProjectStatus } from '@synapse/shared';

const META: Record<ProjectStatus, { label: string; className: string; hint: string }> = {
  draft: { label: 'Draft', className: 'bg-white/8 text-white/70 ring-white/15', hint: 'No ready sources yet' },
  active: { label: 'Active', className: 'bg-violet-500/15 text-violet-200 ring-violet-300/30', hint: 'Sources ready' },
  analyzed: { label: 'Analyzed', className: 'bg-support/15 text-[#7ee2bd] ring-support/40', hint: 'Analysis is current' },
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  const m = META[status];
  return (
    <span title={m.hint} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-medium ring-1 ${m.className}`}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {m.label}
    </span>
  );
}
