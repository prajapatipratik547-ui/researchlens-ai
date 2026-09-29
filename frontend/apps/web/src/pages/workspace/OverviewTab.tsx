import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useDeleteProject } from '../../hooks/useProjects';
import { useToast } from '../../context/toast';
import { ApiError } from '../../lib/errors';
import { formatDateTime } from '../../lib/format';
import { useWorkspace } from '../../components/workspace/context';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Dialog } from '../../components/ui/Dialog';

const STEPS = [
  { key: 'sources', title: 'Upload sources', body: 'PDF, DOCX or TXT — up to 5 files at a time, 10 MB each.' },
  { key: 'assistant', title: 'Ask the assistant', body: 'Works as soon as one source is ready. Every claim is cited.' },
  { key: 'analysis', title: 'Run analysis', body: 'Builds the evidence matrix, insights, contradictions and gaps.' },
  { key: 'brief', title: 'Export the brief', body: 'A cited Markdown brief you can copy or download.' },
] as const;

export function OverviewTab() {
  const { project } = useWorkspace();
  const del = useDeleteProject();
  const toast = useToast();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);

  const done = {
    sources: project.stats.sourceCount > 0,
    assistant: project.stats.sourceCount > 0,
    analysis: project.status === 'analyzed',
    brief: false,
  };

  const onDelete = () =>
    del.mutate(project.id, {
      onSuccess: () => {
        toast.show('Project deleted.', 'success');
        navigate('/dashboard', { replace: true });
      },
      onError: (err) => toast.show(err instanceof ApiError ? err.message : 'Couldn’t delete the project.', 'error'),
    });

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
        <p className="font-mono text-[10px] tracking-[0.2em] text-white/40 uppercase">Research question</p>
        <p className="mt-3 text-[19px] leading-snug text-white">{project.researchQuestion}</p>
        {project.description && (
          <>
            <p className="mt-6 font-mono text-[10px] tracking-[0.2em] text-white/40 uppercase">Description</p>
            <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-white/65">{project.description}</p>
          </>
        )}
        <dl className="mt-8 grid grid-cols-2 gap-4 border-t border-white/8 pt-6 text-[13px] sm:grid-cols-3">
          <div>
            <dt className="text-white/40">Created</dt>
            <dd className="mt-1 text-white/80">{formatDateTime(project.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-white/40">Last updated</dt>
            <dd className="mt-1 text-white/80">{formatDateTime(project.updatedAt)}</dd>
          </div>
          <div>
            <dt className="text-white/40">Last analysis</dt>
            <dd className="mt-1 text-white/80">{project.analyzedAt ? formatDateTime(project.analyzedAt) : 'Not yet'}</dd>
          </div>
        </dl>
      </section>

      <div className="space-y-6">
        <section className="rounded-2xl border border-white/8 bg-white/[0.03] p-6">
          <h2 className="text-[15px] font-medium">Next steps</h2>
          <ol className="mt-4 space-y-4">
            {STEPS.map((s, i) => (
              <li key={s.key} className="flex gap-3">
                <span
                  className={`grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-medium ${
                    done[s.key] ? 'bg-support text-white' : 'bg-white/8 text-white/60'
                  }`}
                >
                  {done[s.key] ? <span aria-label="Done">✓</span> : i + 1}
                </span>
                <div>
                  <p className="text-[14px] text-white/90">{s.title}</p>
                  <p className="mt-0.5 text-[12.5px] leading-relaxed text-white/45">{s.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <ButtonLink to={project.stats.sourceCount ? 'assistant' : 'sources'} size="sm" className="mt-6">
            {project.stats.sourceCount ? 'Ask a question' : 'Upload sources'}
          </ButtonLink>
        </section>

        <section className="rounded-2xl border border-contradict/20 p-6">
          <h2 className="text-[15px] font-medium">Delete project</h2>
          <p className="mt-2 text-[13px] text-white/50">
            Permanently removes the project with all its sources, conversations and insights.
          </p>
          <Button variant="secondary" size="sm" className="mt-4 !text-[#ff8aa3]" onClick={() => setConfirming(true)}>
            Delete project…
          </Button>
        </section>
      </div>

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Delete this project?"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" loading={del.isPending} onClick={onDelete}>
              Delete permanently
            </Button>
          </>
        }
      >
        <p>
          <strong className="font-medium text-white">{project.title}</strong> and all of its sources, conversations and
          insights will be deleted. This can’t be undone.
        </p>
      </Dialog>
    </div>
  );
}
