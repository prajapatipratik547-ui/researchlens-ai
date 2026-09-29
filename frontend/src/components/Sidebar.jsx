import { NavLink } from 'react-router';
import { workspaceSections } from '../utils/workspaceSections';

const linkClass = ({ isActive }) =>
  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
    isActive
      ? 'bg-brand-50 font-medium text-brand-800'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  }`;

const tabClass = ({ isActive }) =>
  `flex shrink-0 items-center gap-2 rounded-full px-3.5 py-1.5 text-sm whitespace-nowrap transition-colors ${
    isActive
      ? 'bg-brand-700 font-medium text-white'
      : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-900'
  }`;

/** Workspace navigation: a sidebar on desktop, a scrollable tab row on mobile. */
export default function Sidebar({ projectId }) {
  const items = workspaceSections.map(({ path, label, icon: Icon }) => ({
    to: path ? `/research/${projectId}/${path}` : `/research/${projectId}`,
    end: !path,
    label,
    Icon,
  }));

  return (
    <>
      <aside className="hidden w-60 shrink-0 border-r border-slate-200 bg-white lg:block">
        <nav aria-label="Research workspace" className="sticky top-16 space-y-1 p-4">
          <p className="px-3 pb-2 text-xs font-semibold tracking-wider text-slate-400 uppercase">
            Workspace
          </p>
          {items.map(({ to, end, label, Icon }) => (
            <NavLink key={to} to={to} end={end} className={linkClass}>
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <nav
        aria-label="Research workspace sections"
        className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-slate-50 px-4 py-3 lg:hidden"
      >
        {items.map(({ to, end, label, Icon }) => (
          <NavLink key={to} to={to} end={end} className={tabClass}>
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
