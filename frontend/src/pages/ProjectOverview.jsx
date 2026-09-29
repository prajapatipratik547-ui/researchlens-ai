import { useState } from 'react';
import { Link, useNavigate, useOutletContext } from 'react-router';
import { Check, FileText, Lightbulb, SearchX, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import ConfirmDialog from '../components/ConfirmDialog';
import { getErrorMessage, projectsApi } from '../services/api';
import { formatDate, timeAgo } from '../utils/format';

export default function ProjectOverview() {
  const { project } = useOutletContext();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { sourceCount, insightCount, gapCount } = project.stats;
  const base = `/research/${project.id}`;

  const steps = [
    { label: 'Define your research question', done: true },
    { label: 'Upload your sources', done: sourceCount > 0, to: `${base}/sources` },
    {
      label:
        project.analyzedAt && project.status !== 'analyzed'
          ? 'Re-run the analysis (your sources changed)'
          : 'Run corpus analysis',
      done: project.status === 'analyzed',
      to: `${base}/insights`,
    },
    { label: 'Ask the AI research assistant', to: `${base}/assistant` },
    { label: 'Generate your research brief', to: `${base}/brief` },
  ];

  const stats = [
    { label: 'Sources', value: sourceCount, icon: FileText },
    { label: 'Insights', value: insightCount, icon: Lightbulb },
    { label: 'Research gaps', value: gapCount, icon: SearchX },
  ];

  async function handleDelete() {
    setDeleting(true);
    try {
      await projectsApi.remove(project.id);
      toast.success('Research project deleted');
      navigate('/dashboard', { replace: true });
    } catch (error) {
      toast.error(getErrorMessage(error, 'Could not delete the project.'));
      setDeleting(false);
      setConfirming(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <section className="card relative overflow-hidden p-6 sm:p-8">
        <div className="absolute inset-y-0 left-0 w-1 bg-brand-600" aria-hidden="true" />
        <p className="text-xs font-semibold tracking-wider text-brand-700 uppercase">
          Research question
        </p>
        <p className="mt-3 font-display text-xl leading-relaxed text-slate-900 sm:text-2xl">
          {project.researchQuestion}
        </p>
        {project.description && (
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-600">
            {project.description}
          </p>
        )}
        <p className="mt-6 text-xs text-slate-500">
          Created {formatDate(project.createdAt)}
          {project.analyzedAt && ` · Last analyzed ${timeAgo(project.analyzedAt)}`}
        </p>
      </section>

      <dl className="grid grid-cols-3 gap-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <div key={label} className="card p-4 sm:p-5">
            <dt className="flex items-center gap-2 text-xs text-slate-600 sm:text-sm">
              <Icon className="size-4 shrink-0 text-brand-600" aria-hidden="true" />
              {label}
            </dt>
            <dd className="mt-2 text-2xl font-semibold tabular-nums text-slate-900 sm:text-3xl">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      <section className="card p-6 sm:p-8" aria-labelledby="workflow-heading">
        <h2 id="workflow-heading" className="font-semibold text-slate-900">
          Research workflow
        </h2>
        <ol className="mt-5 space-y-3">
          {steps.map(({ label, done, to }, index) => (
            <li key={label} className="flex items-center gap-3">
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {done ? <Check className="size-4" aria-label="Done" /> : index + 1}
              </span>
              {to && !done ? (
                <Link to={to} className="text-sm font-medium text-brand-700 hover:text-brand-800">
                  {label}
                </Link>
              ) : (
                <span className={`text-sm ${done ? 'text-slate-500 line-through' : 'text-slate-700'}`}>
                  {label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </section>

      <section
        className="flex flex-col gap-4 rounded-2xl border border-rose-200 bg-white p-6 sm:flex-row sm:items-center sm:justify-between"
        aria-labelledby="danger-heading"
      >
        <div>
          <h2 id="danger-heading" className="font-semibold text-slate-900">
            Delete this project
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Permanently removes the project, its sources, insights and conversations.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="btn shrink-0 border border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
        >
          <Trash2 className="size-4" aria-hidden="true" />
          Delete project
        </button>
      </section>

      <ConfirmDialog
        open={confirming}
        title="Delete this research project?"
        message={
          <>
            <strong className="font-medium text-slate-800">{project.title}</strong> and all of its
            sources, insights and conversations will be permanently deleted. This can’t be undone.
          </>
        }
        confirmLabel={deleting ? 'Deleting…' : 'Delete project'}
        busy={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirming(false)}
      />
    </div>
  );
}
