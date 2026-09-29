import type { ReactNode } from 'react';
import { ApiError } from '../../lib/errors';
import { Button } from './Button';
import { Sparkle } from './Sparkle';

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`rounded-lg bg-white/[0.06] motion-safe:animate-pulse ${className}`} />;
}

/** Screen-reader label for skeleton groups. */
export function LoadingRegion({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-white/12 px-6 py-14 text-center">
      <div className="grid size-12 place-items-center rounded-2xl bg-violet-500/15 text-violet-300">
        {icon ?? <Sparkle className="size-5" />}
      </div>
      <h3 className="mt-5 text-lg font-medium text-white">{title}</h3>
      {body && <p className="mt-2 max-w-md text-sm leading-relaxed text-white/50">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, title }: { error: unknown; onRetry?: () => void; title?: string }) {
  const message = error instanceof ApiError ? error.message : 'Something went wrong.';
  const busy = error instanceof ApiError && (error.status === 429 || error.code === 'AI_RATE_LIMITED');
  return (
    <div role="alert" className="flex flex-col items-center rounded-2xl border border-contradict/25 bg-contradict/[0.06] px-6 py-12 text-center">
      <h3 className="text-lg font-medium text-white">{title ?? (busy ? 'Please wait a moment' : 'Couldn’t load this')}</h3>
      <p className="mt-2 max-w-md text-sm text-white/55">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/** Neutral informational notice (e.g. insufficient evidence) — deliberately not red. */
export function InfoNote({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[13.5px] text-white/70 sm:flex-row sm:items-center">
      <svg viewBox="0 0 20 20" className="size-4 shrink-0 text-violet-300" aria-hidden="true">
        <circle cx="10" cy="10" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M10 9v5M10 6.2v.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <div className="flex-1">{children}</div>
      {action}
    </div>
  );
}
