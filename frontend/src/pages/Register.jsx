import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import AuthLayout from '../components/AuthLayout';
import FormAlert from '../components/FormAlert';
import FormField from '../components/FormField';
import { useAuth } from '../hooks/useAuth';
import { getErrorMessage, getFieldErrors } from '../services/api';
import { validateRegister } from '../utils/validation';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const update = (field) => (event) => {
    setForm((f) => ({ ...f, [field]: event.target.value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setFormError('');
    const clientErrors = validateRegister(form);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) return;

    setSubmitting(true);
    try {
      const user = await register(form.name.trim(), form.email.trim(), form.password);
      toast.success(`Welcome to ResearchLens, ${user.name.split(' ')[0]}`);
      navigate('/dashboard', { replace: true });
    } catch (error) {
      const fieldErrors = getFieldErrors(error);
      setErrors(fieldErrors);
      // A field error already explains itself inline; only show the banner
      // for errors with nowhere else to go (network, server, rate limit).
      setFormError(Object.keys(fieldErrors).length ? '' : getErrorMessage(error));
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start turning your sources into evidence-backed insights."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-brand-700 hover:text-brand-800">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <FormAlert>{formError}</FormAlert>
        <FormField
          label="Full name"
          name="name"
          autoComplete="name"
          placeholder="Ada Lovelace"
          value={form.name}
          onChange={update('name')}
          error={errors.name}
          autoFocus
        />
        <FormField
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@university.edu"
          value={form.email}
          onChange={update('email')}
          error={errors.email}
        />
        <FormField
          label="Password"
          type="password"
          name="password"
          autoComplete="new-password"
          value={form.password}
          onChange={update('password')}
          error={errors.password}
          hint="At least 8 characters, with a letter and a number."
        />
        <button type="submit" className="btn-primary w-full py-3" disabled={submitting}>
          {submitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthLayout>
  );
}
