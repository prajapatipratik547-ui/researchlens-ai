import { Link, NavLink, Outlet, useNavigate } from 'react-router';
import { useAuth } from '../../context/auth';
import { useToast } from '../../context/toast';
import { Sparkle } from '../ui/Sparkle';

export function BrandMark({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="flex items-center gap-2 text-white" aria-label="ResearchLens home">
      <span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-violet-800 shadow-[0_6px_20px_-6px_rgb(122_47_240/0.8)]">
        <Sparkle className="size-3.5" />
      </span>
      <span className="text-[15px] font-medium tracking-tight">ResearchLens</span>
    </Link>
  );
}

const navClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-1.5 text-[13px] ${isActive ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white'}`;

export function AppShell() {
  const { user, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const initials = (user?.name ?? '?')
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div className="min-h-svh bg-ink text-white">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-80 bg-[radial-gradient(60%_100%_at_20%_0%,rgb(122_47_240/0.22),transparent)]" />
      <header className="sticky top-0 z-40 border-b border-white/6 bg-ink/75 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
          <BrandMark to="/dashboard" />
          <nav aria-label="App" className="ml-2 hidden items-center gap-1 sm:flex">
            <NavLink to="/dashboard" className={navClass}>
              Dashboard
            </NavLink>
            <NavLink to="/research/new" className={navClass}>
              New project
            </NavLink>
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-right text-[12.5px] leading-tight md:block">
              <span className="block text-white/85">{user?.name}</span>
              <span className="block text-white/40">{user?.email}</span>
            </span>
            <span
              aria-hidden="true"
              className="grid size-8 place-items-center rounded-full bg-white/10 text-[11px] font-medium text-white/80"
            >
              {initials}
            </span>
            <button
              type="button"
              onClick={() => {
                logout();
                toast.show('You’ve been logged out.');
                navigate('/login');
              }}
              className="rounded-lg px-3 py-1.5 text-[13px] text-white/60 hover:bg-white/8 hover:text-white"
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <div className="relative">
        <Outlet />
      </div>
    </div>
  );
}
