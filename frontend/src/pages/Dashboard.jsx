import { Link } from 'react-router';
import { FileText, FolderSearch, Lightbulb, Plus, SearchX } from 'lucide-react';
import Navbar from '../components/Navbar';
import EmptyState from '../components/EmptyState';
import ErrorState from '../components/ErrorState';
import ProjectCard, { ProjectCardSkeleton } from '../components/ProjectCard';
import { useAuth } from '../hooks/useAuth';
import { useFetch } from '../hooks/useFetch';
import { getErrorMessage, projectsApi } from '../services/api';

function totals(projects = []) {
  return projects.reduce(
    (sum, { stats }) => ({
      projects: sum.projects + 1,
      sources: sum.sources + stats.sourceCount,
      insights: sum.insights + stats.insightCount,
      gaps: sum.gaps + stats.gapCount,
    }),
    { projects: 0, sources: 0, insights: 0, gaps: 0 },
  );
}

function NewProjectButton() {
  return (
    <Link to="/research/new" className="btn-primary">
      <Plus className="size-4" aria-hidden="true" />
      New research
    </Link>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data: projects, error, loading, reload } = useFetch('projects', projectsApi.list);
  const sum = totals(projects ?? []);

  const stats = [
    { label: 'Research projects', value: sum.projects, icon: FolderSearch },
    { label: 'Sources', value: sum.sources, icon: FileText },
    { label: 'Insights discovered', value: sum.insights, icon: Lightbulb },
    { label: 'Research gaps', value: sum.gaps, icon: SearchX },
  ];

  let content;
  if (loading && !projects) {
    content = (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <ProjectCardSkeleton key={i} />
        ))}
      </div>
    );
  } else if (error) {
    content = (
      <ErrorState
        title="Couldn’t load your projects"
        message={getErrorMessage(error)}
        onRetry={reload}
      />
    );
  } else if (!projects.length) {
    content = (
      <EmptyState
        icon={FolderSearch}
        title="No research projects yet"
        description="A research project holds your question, your sources and everything ResearchLens discovers across them."
        action={<NewProjectButton />}
      />
    );
  } else {
    content = (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium text-brand-700">Dashboard</p>
            <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-slate-900">
              Welcome, {user?.name?.split(' ')[0]}
            </h1>
            <p className="mt-2 text-slate-600">Your research workspaces and discoveries at a glance.</p>
          </div>
          <NewProjectButton />
        </div>

        <dl className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map(({ label, value, icon: Icon }) => (
            <div key={label} className="card p-5">
              <dt className="flex items-center gap-2 text-sm text-slate-600">
                <Icon className="size-4 shrink-0 text-brand-600" aria-hidden="true" />
                {label}
              </dt>
              <dd className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 tabular-nums">
                {projects ? value : '–'}
              </dd>
            </div>
          ))}
        </dl>

        <section className="mt-10" aria-labelledby="projects-heading">
          <h2 id="projects-heading" className="text-lg font-semibold text-slate-900">
            Research projects
          </h2>
          <div className="mt-4">{content}</div>
        </section>
      </main>
    </div>
  );
}
