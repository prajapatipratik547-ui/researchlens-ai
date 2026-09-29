import { Link } from 'react-router';

export default function Logo({ to = '/' }) {
  return (
    <Link to={to} className="flex items-center gap-2.5 font-semibold tracking-tight text-slate-900">
      <svg viewBox="0 0 32 32" className="size-8" aria-hidden="true">
        <rect width="32" height="32" rx="8" className="fill-brand-700" />
        <circle cx="14" cy="14" r="6.5" fill="none" stroke="#fff" strokeWidth="2.5" />
        <path d="M19 19l5.5 5.5" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="14" cy="14" r="2" className="fill-brand-300" />
      </svg>
      <span>
        ResearchLens <span className="text-brand-700">AI</span>
      </span>
    </Link>
  );
}
