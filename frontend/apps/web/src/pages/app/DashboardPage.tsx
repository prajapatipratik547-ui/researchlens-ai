import { Link } from 'react-router';
import { motion, useReducedMotion } from 'motion/react';
import type { Project } from '@synapse/shared';
import { useAuth } from '../../context/auth';
import { useProjects } from '../../hooks/useProjects';
import { plural, timeAgo } from '../../lib/format';
import { ProjectStatusBadge } from '../../components/app/ProjectStatus';
import { ButtonLink } from '../../components/ui/Button';
import { EmptyState, ErrorState, LoadingRegion, Skeleton } from '../../components/ui/States';

function Totals({ projects }: { projects: Project[] }) {
  // The dashboard needs only GET /projects — totals are summed client-side.
  const sum = (k: keyof Project['stats']) => projects.reduce((n, p) => n + p.stats[k], 0);
  const items = [
    { label: 'Projects', value: projects.length },
    { label: 'Sources', value: sum('sourceCount') },
    { label: 'Insights', value: sum('insightCount') },
    { label: 'Research gaps', value: sum('gapCount') },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map((i) => (
        <div key={i.label} className="rounded-2xl border border-white/8 bg-white/[0.03] px-5 py-4">
          <dt className="font-mono text-[10px] tracking-[0.18em] text-white/40 uppercase">{i.label}</dt>
          <dd className="display mt-2 text-3xl tabular-nums">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ProjectCard({ project, index }: { project: Project; index: number }) {
  const reduce = useReducedMotion();
  return (
    <motion.li
      initial={{ opacity: 0, y: reduce ? 0 : 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: Math.min(index, 8) * 0.04, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        to={`/research/${project.id}`}
        className="group flex h-full flex-col rounded-2xl border border-white/8 bg-white/[0.03] p-5 transition-colors hover:border-violet-300/30 hover:bg-white/[0.05]"
      >
        <div className="flex items-center justify-between gap-3">
          <ProjectStatusBadge status={project.status} />
          <span className="text-[12px] text-white/35">Updated {timeAgo(project.updatedAt)}</span>
        </div>
        <h3 className="mt-4 text-[17px] leading-snug font-medium text-white group-hover:text-violet-100">{project.title}</h3>
        <p className="mt-2 line-clamp-2 text-[13.5px] leading-relaxed text-white/50">{project.researchQuestion}</p>
        <p className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-5 text-[12.5px] text-white/45">
          <span>{plural(project.stats.sourceCount, 'source')}</span>
          <span>{plural(project.stats.insightCount, 'insight')}</span>
          <span>{plural(project.stats.gapCount, 'gap')}</span>
        </p>
      </Link>
    </motion.li>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const projects = useProjects();
  const first = user?.name.split(/\s+/)[0];

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] tracking-[0.22em] text-white/40 uppercase">Dashboard</p>
          <h1 className="display mt-3 text-[clamp(34px,4vw,52px)]">{first ? `Hi ${first}, your research` : 'Your research'}</h1>
        </div>
        <ButtonLink to="/research/new">New project</ButtonLink>
      </div>

      <div className="mt-10">
        {projects.isPending ? (
          <LoadingRegion label="Loading projects">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[0, 1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-[86px] rounded-2xl" />
              ))}
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-48 rounded-2xl" />
              ))}
            </div>
          </LoadingRegion>
        ) : projects.isError ? (
          <ErrorState error={projects.error} onRetry={() => void projects.refetch()} />
        ) : projects.data.length === 0 ? (
          <EmptyState
            title="No projects yet"
            body="Start a project around one research question, then upload the papers, reports or notes you want the AI to work from."
            action={<ButtonLink to="/research/new">Create your first project</ButtonLink>}
          />
        ) : (
          <>
            <Totals projects={projects.data} />
            <ul className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {projects.data.map((p, i) => (
                <ProjectCard key={p.id} project={p} index={i} />
              ))}
            </ul>
          </>
        )}
      </div>
    </main>
  );
}
