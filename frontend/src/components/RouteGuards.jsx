import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from '../hooks/useAuth';
import LoadingState from './LoadingState';

/**
 * Only signed-in users. Others go to /login and come back afterwards,
 * except after a deliberate logout, which goes to the landing page.
 */
export function ProtectedRoute() {
  const { status, endReason } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <LoadingState label="Checking your session…" fullScreen />;
  if (status === 'unauthenticated') {
    if (endReason === 'logout') return <Navigate to="/" replace />;
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  return <Outlet />;
}

/** Login/register pages; signed-in users are sent to the dashboard. */
export function GuestRoute() {
  const { status } = useAuth();

  if (status === 'loading') return <LoadingState label="Checking your session…" fullScreen />;
  if (status === 'authenticated') return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
