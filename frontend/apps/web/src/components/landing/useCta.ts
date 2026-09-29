import { useAuth } from '../../context/auth';

/** Signed-in visitors go straight to their dashboard instead of sign-up. */
export function useCta() {
  const { status } = useAuth();
  const signedIn = status === 'authenticated';
  return {
    signedIn,
    to: signedIn ? '/dashboard' : '/register',
    label: signedIn ? 'Go to dashboard' : 'Get started',
  };
}
