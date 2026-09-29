import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import AuthLayout from '../components/AuthLayout';
import FormAlert from '../components/FormAlert';
import FormField from '../components/FormField';
import { useAuth } from '../hooks/useAuth';
import { getErrorMessage, getFieldErrors } from '../services/api';
import { validateLogin } from '../utils/validation';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
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
    const clientErrors = validateLogin(form);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) return;

    setSubmitting(true);
    try {
      const user = await login(form.email.trim(), form.password);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}`);
      const from = location.state?.from;
      navigate(from ? `${from.pathname}${from.search ?? ''}` : '/dashboard', { replace: true });
    } catch (error) {
      setErrors(getFieldErrors(error));
      setFormError(getErrorMessage(error));
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to continue your research."
      footer={
        <>
          New to ResearchLens?{' '}
          <Link to="/register" className="font-medium text-brand-700 hover:text-brand-800">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <FormAlert>{formError}</FormAlert>
        <FormField
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          placeholder="you@university.edu"
          value={form.email}
          onChange={update('email')}
          error={errors.email}
          autoFocus
        />
        <FormField
          label="Password"
          type="password"
          name="password"
          autoComplete="current-password"
          value={form.password}
          onChange={update('password')}
          error={errors.password}
        />
        <button type="submit" className="btn-primary w-full py-3" disabled={submitting}>
          {submitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {submitting ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </AuthLayout>
  );
}
