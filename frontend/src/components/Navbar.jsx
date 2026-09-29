import { Link } from 'react-router';
import { LayoutDashboard, LogOut } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import Logo from './Logo';

function initials(name = '') {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');
}

export default function Navbar({ width = 'max-w-6xl' }) {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/80 backdrop-blur-md">
      <nav className={`mx-auto flex h-16 items-center justify-between px-4 sm:px-6 ${width}`}>
        <Logo to={isAuthenticated ? '/dashboard' : '/'} />

        {isAuthenticated ? (
          <div className="flex items-center gap-1 sm:gap-2">
            <Link to="/dashboard" className="btn-ghost hidden sm:inline-flex">
              <LayoutDashboard className="size-4" aria-hidden="true" />
              Dashboard
            </Link>
            <div className="ml-1 flex items-center gap-2.5 border-l border-slate-200 pl-3">
              <span
                className="flex size-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-800"
                aria-hidden="true"
              >
                {initials(user?.name)}
              </span>
              <span className="hidden max-w-40 truncate text-sm font-medium text-slate-700 md:block">
                {user?.name}
              </span>
              <button type="button" onClick={logout} className="btn-ghost px-2.5" aria-label="Log out">
                <LogOut className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">Log out</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link to="/login" className="btn-ghost">
              Log in
            </Link>
            <Link to="/register" className="btn-primary">
              Start research
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}
