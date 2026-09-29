import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router';
import { createProjectRequestSchema, LIMITS, type CreateProjectRequest } from '@synapse/shared';
import { useCreateProject } from '../../hooks/useProjects';
import { applyServerErrors } from '../../lib/formErrors';
import { Button } from '../../components/ui/Button';
import { FormError, Input, Textarea } from '../../components/ui/Field';

const EXAMPLE: CreateProjectRequest = {
  title: 'Impact of Generative AI on Software Developer Productivity',
  researchQuestion: 'How does generative AI affect developer productivity, code quality, and developer satisfaction?',
  description: 'Comparing field studies, surveys and lab experiments published since 2022.',
};

export function NewProjectPage() {
  const navigate = useNavigate();
  const create = useCreateProject();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CreateProjectRequest>({
    resolver: zodResolver(createProjectRequestSchema),
    defaultValues: { title: '', researchQuestion: '', description: '' },
  });

  const [title = '', question = '', description = ''] = useWatch({ control, name: ['title', 'researchQuestion', 'description'] });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const project = await create.mutateAsync(values);
      navigate(`/research/${project.id}/sources`);
    } catch (err) {
      setFormError(applyServerErrors(err, setError, ['title', 'researchQuestion', 'description']));
    }
  });

  const fillExample = () => {
    (Object.keys(EXAMPLE) as Array<keyof CreateProjectRequest>).forEach((k) =>
      setValue(k, EXAMPLE[k] ?? '', { shouldValidate: true, shouldDirty: true }),
    );
  };

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <Link to="/dashboard" className="text-[13px] text-white/50 hover:text-white">
        ← Dashboard
      </Link>
      <div className="mt-6 flex items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] tracking-[0.22em] text-white/40 uppercase">New project</p>
          <h1 className="display mt-3 text-[clamp(32px,4vw,46px)]">What are you researching?</h1>
        </div>
      </div>
      <p className="mt-3 text-sm text-white/55">
        One project, one question. You’ll upload sources next — the AI answers only from them.
      </p>

      <form noValidate onSubmit={onSubmit} className="mt-10 space-y-6 rounded-2xl border border-white/8 bg-white/[0.03] p-5 sm:p-7">
        {formError && <FormError>{formError}</FormError>}
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={fillExample}>
            Use example
          </Button>
        </div>
        <Input
          label="Project title"
          placeholder="e.g. Impact of remote work on team communication"
          error={errors.title?.message}
          count={{ value: title.length, max: LIMITS.project.title.max }}
          {...register('title')}
        />
        <Textarea
          label="Research question"
          rows={3}
          placeholder="The single question the sources should answer"
          error={errors.researchQuestion?.message}
          count={{ value: question.length, max: LIMITS.project.researchQuestion.max }}
          {...register('researchQuestion')}
        />
        <Textarea
          label="Description (optional)"
          rows={4}
          placeholder="Scope, inclusion criteria, anything that helps you later"
          error={errors.description?.message}
          count={{ value: description.length, max: LIMITS.project.description.max }}
          {...register('description')}
        />
        <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={() => navigate('/dashboard')}>
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {isSubmitting ? 'Creating…' : 'Create project'}
          </Button>
        </div>
      </form>
    </main>
  );
}
