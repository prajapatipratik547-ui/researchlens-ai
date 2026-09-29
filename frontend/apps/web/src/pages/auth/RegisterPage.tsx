import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router';
import { LIMITS, registerRequestSchema, type RegisterRequest } from '@synapse/shared';
import { useAuth } from '../../context/auth';
import { applyServerErrors } from '../../lib/formErrors';
import { Button } from '../../components/ui/Button';
import { FormError, Input } from '../../components/ui/Field';
import { AuthLayout } from './AuthLayout';

export function RegisterPage() {
  const { register: signUp } = useAuth();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterRequest>({
    resolver: zodResolver(registerRequestSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await signUp(values);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setFormError(applyServerErrors(err, setError, ['name', 'email', 'password']));
    }
  });

  return (
    <AuthLayout
      title="Create your account"
      subtitle={
        <>
          Already have one?{' '}
          <Link to="/login" className="text-violet-200 underline underline-offset-2">
            Log in
          </Link>
        </>
      }
    >
      <form noValidate onSubmit={onSubmit} className="space-y-5">
        {formError && <FormError>{formError}</FormError>}
        <Input label="Name" autoComplete="name" maxLength={LIMITS.name.max} error={errors.name?.message} {...register('name')} />
        <Input label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
        <Input
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 8 characters, with a letter and a number."
          error={errors.password?.message}
          {...register('password')}
        />
        <Button type="submit" loading={isSubmitting} className="w-full">
          {isSubmitting ? 'Creating account…' : 'Create account'}
        </Button>
        <p className="text-center text-[12px] text-white/35">Sessions last {LIMITS.sessionDays} days.</p>
      </form>
    </AuthLayout>
  );
}
