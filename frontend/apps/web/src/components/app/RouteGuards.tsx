import type { ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../../context/auth';
import { Button } from '../ui/Button';
import { Spinner } from '../ui/Spinner';

function FullScreen({ children }: { children: ReactNode }) {
  return <main className="grid min-h-svh place-items-center bg-ink px-4 text-center text-white">{children}</main>;
}

/** Signed-in users only. Anonymous users go to /login and come back afterwards. */
export function RequireAuth() {
  const { status, retry } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <FullScreen>
        <div role="status" className="flex items-center gap-3 text-sm text-white/60">
          <Spinner /> Restoring your session…
        </div>
      </FullScreen>
    );
  }
  if (status === 'unreachable') {
    return (
      <FullScreen>
        <div>
          <h1 className="text-lg font-medium">Can’t reach ResearchLens</h1>
          <p className="mt-2 text-sm text-white/55">Check your connection. You’re still signed in.</p>
          <Button variant="secondary" size="sm" className="mt-5" onClick={retry}>
            Try again
          </Button>
        </div>
      </FullScreen>
    );
  }
  if (status === 'anonymous') {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <Outlet />;
}

/** Login/register: signed-in users skip straight to their dashboard. */
export function GuestOnly() {
  const { status } = useAuth();
  if (status === 'authenticated') return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
