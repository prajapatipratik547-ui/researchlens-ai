import { Link } from 'react-router';
import { ArrowRight, Clock, FileText, Lightbulb } from 'lucide-react';
import StatusBadge from './StatusBadge';
import { plural, timeAgo } from '../utils/format';

export default function ProjectCard({ project }) {
  const { id, title, researchQuestion, status, stats, updatedAt } = project;

  return (
    <Link
      to={`/research/${id}`}
      className="group card flex flex-col p-5 transition hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lg"
    >
      <div className="flex items-start justify-between gap-3">
        <StatusBadge status={status} />
        <span className="flex items-center gap-1 text-xs text-slate-500">
          <Clock className="size-3.5" aria-hidden="true" />
          {timeAgo(updatedAt)}
        </span>
      </div>

      <h3 className="mt-4 line-clamp-2 font-semibold text-slate-900 group-hover:text-brand-800">
        {title}
      </h3>
      <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600">{researchQuestion}</p>

      <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-4 text-sm">
        <div className="flex items-center gap-4 text-slate-600">
          <span className="flex items-center gap-1.5">
            <FileText className="size-4 text-slate-400" aria-hidden="true" />
            {plural(stats.sourceCount, 'source')}
          </span>
          <span className="flex items-center gap-1.5">
            <Lightbulb className="size-4 text-slate-400" aria-hidden="true" />
            {plural(stats.insightCount, 'insight')}
          </span>
        </div>
        <span className="flex items-center gap-1 font-medium text-brand-700">
          Open
          <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}

export function ProjectCardSkeleton() {
  return (
    <div className="card animate-pulse p-5" aria-hidden="true">
      <div className="h-5 w-20 rounded-full bg-slate-100" />
      <div className="mt-5 h-4 w-3/4 rounded bg-slate-200" />
      <div className="mt-3 h-3 w-full rounded bg-slate-100" />
      <div className="mt-2 h-3 w-5/6 rounded bg-slate-100" />
      <div className="mt-8 h-4 w-1/2 rounded bg-slate-100" />
    </div>
  );
}
