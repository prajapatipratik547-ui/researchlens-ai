import { Link } from 'react-router';
import { Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="mb-6 flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
        <Compass className="size-7" aria-hidden="true" />
      </div>
      <p className="text-sm font-medium text-brand-700">404</p>
      <h1 className="mt-2 font-display text-3xl font-semibold text-slate-900">Page not found</h1>
      <p className="mt-2 max-w-sm text-slate-600">
        The page you are looking for doesn’t exist or has moved.
      </p>
      <Link to="/" className="btn-primary mt-8">
        Back to home
      </Link>
    </main>
  );
}
