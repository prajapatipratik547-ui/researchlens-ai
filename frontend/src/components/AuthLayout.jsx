import { CheckCircle2, AlertTriangle, CircleHelp } from 'lucide-react';
import Logo from './Logo';

// Sample of the kind of output ResearchLens produces, shown beside the
// auth forms so the product's value is visible before signing in.
const preview = [
  { icon: CheckCircle2, tone: 'text-support', label: 'Supported by 3 sources', text: 'Task completion time improves for routine coding work.' },
  { icon: AlertTriangle, tone: 'text-contradict', label: 'Potential contradiction', text: 'Gains narrow on complex, unfamiliar tasks.' },
  { icon: CircleHelp, tone: 'text-unclear', label: 'Research gap', text: 'Long-term effects on code quality remain unexplored.' },
];

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      <main className="flex flex-col px-4 py-8 sm:px-10">
        <Logo />
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <h1 className="font-display text-3xl font-semibold tracking-tight text-slate-900">
            {title}
          </h1>
          <p className="mt-2 text-slate-600">{subtitle}</p>
          <div className="mt-8">{children}</div>
          {footer && <p className="mt-8 text-center text-sm text-slate-600">{footer}</p>}
        </div>
      </main>

      <aside
        aria-hidden="true"
        className="relative hidden overflow-hidden bg-brand-950 lg:flex lg:flex-col lg:justify-center lg:px-16"
      >
        <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_80%_0%,rgb(59_110_245/0.35),transparent),radial-gradient(60%_50%_at_0%_100%,rgb(29_64_192/0.4),transparent)]" />
        <div className="relative max-w-md">
          <p className="font-display text-3xl leading-snug text-white">
            Upload scattered sources. Get back structured, evidence-backed knowledge.
          </p>
          <p className="mt-3 text-sm text-slate-400">Example output</p>
          <div className="mt-10 space-y-3">
            {preview.map(({ icon: Icon, tone, label, text }) => (
              <div
                key={label}
                className="rounded-xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm"
              >
                <p className="flex items-center gap-2 text-xs font-medium tracking-wide text-slate-300 uppercase">
                  <Icon className={`size-4 ${tone}`} />
                  {label}
                </p>
                <p className="mt-1.5 text-sm text-white/90">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
