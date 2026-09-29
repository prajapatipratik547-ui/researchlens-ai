import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';
import FormAlert from '../components/FormAlert';
import FormField from '../components/FormField';
import { getErrorMessage, getFieldErrors, projectsApi } from '../services/api';

const LIMITS = { title: 150, researchQuestion: 600, description: 2000 };

// The hackathon's demo topic, offered as a one-click starting point.
const EXAMPLE = {
  title: 'Impact of Generative AI on Software Developer Productivity',
  researchQuestion:
    'How does generative AI affect developer productivity, code quality, and developer satisfaction?',
  description:
    'Compare evidence across studies and industry reports to understand where AI coding assistants help, where they fall short, and what remains unknown.',
};

function validate({ title, researchQuestion, description }) {
  const errors = {};
  if (title.trim().length < 3) errors.title = 'Title must be at least 3 characters';
  if (researchQuestion.trim().length < 10) {
    errors.researchQuestion = 'Research question must be at least 10 characters';
  }
  if (description.length > LIMITS.description) {
    errors.description = `Description must be at most ${LIMITS.description} characters`;
  }
  return errors;
}

export default function CreateResearch() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ title: '', researchQuestion: '', description: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (event) => {
    setForm((f) => ({ ...f, [field]: event.target.value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  function fillExample() {
    setForm(EXAMPLE);
    setErrors({});
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');
    const clientErrors = validate(form);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) return;

    setSubmitting(true);
    try {
      const project = await projectsApi.create({
        title: form.title.trim(),
        researchQuestion: form.researchQuestion.trim(),
        description: form.description.trim(),
      });
      toast.success('Research project created');
      navigate(`/research/${project.id}`, { replace: true });
    } catch (error) {
      const fieldErrors = getFieldErrors(error);
      setErrors(fieldErrors);
      setFormError(Object.keys(fieldErrors).length ? '' : getErrorMessage(error));
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to dashboard
        </Link>

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900">
              New research project
            </h1>
            <p className="mt-2 text-slate-600">
              Start with the question you want your sources to answer.
            </p>
          </div>
          <button type="button" onClick={fillExample} className="btn-secondary shrink-0">
            <Sparkles className="size-4 text-brand-600" aria-hidden="true" />
            Use example
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="card mt-8 space-y-6 p-6 sm:p-8">
          <FormAlert>{formError}</FormAlert>
          <FormField
            label="Project title"
            name="title"
            placeholder="e.g. Remote work and team performance"
            value={form.title}
            onChange={update('title')}
            error={errors.title}
            maxLength={LIMITS.title}
            autoFocus
          />
          <FormField
            multiline
            rows={3}
            label="Research question"
            name="researchQuestion"
            placeholder="What exactly do you want to find out?"
            value={form.researchQuestion}
            onChange={update('researchQuestion')}
            error={errors.researchQuestion}
            maxLength={LIMITS.researchQuestion}
            hint="A focused question gives sharper findings. Every analysis is framed around it."
          />
          <FormField
            multiline
            rows={4}
            optional
            label="Description"
            name="description"
            placeholder="Context, scope, or what a good answer would help you decide."
            value={form.description}
            onChange={update('description')}
            error={errors.description}
            maxLength={LIMITS.description}
          />
          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-6 sm:flex-row sm:justify-end">
            <Link to="/dashboard" className="btn-secondary">
              Cancel
            </Link>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {submitting ? 'Creating…' : 'Create project'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
