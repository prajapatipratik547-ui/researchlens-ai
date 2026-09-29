import type { CSSProperties, ReactNode } from 'react';
import { ArrowRight, Sparkle } from '../ui/Sparkle';
import type { SurfaceMeta } from './surfaces';

function Pill({ children, dark }: { children: ReactNode; dark: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${
        dark ? 'bg-black/35 text-white/90' : 'bg-black/15 text-white'
      } backdrop-blur-md`}
    >
      {children}
    </span>
  );
}

/** Animated "Summarise the thread" progress, three of five segments lit. */
function ThreadProgress() {
  return (
    <div className="mt-3 grid grid-cols-5 gap-1.5" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className="relative h-[3px] overflow-hidden rounded-full bg-white/20">
          {i < 3 && (
            <span
              className="absolute inset-0 origin-left rounded-full bg-white/90 motion-safe:animate-[segment_2.4s_var(--ease-out-expo)_infinite]"
              style={{ animationDelay: `${i * 0.25}s` }}
            />
          )}
        </span>
      ))}
    </div>
  );
}

export function LiveSessionBody() {
  return (
    <>
      <div className="flex items-center justify-between">
        <Pill dark>
          <Sparkle className="size-2.5" /> Ask your sources
        </Pill>
        <Pill dark>
          <span className="size-1.5 rounded-full bg-live motion-safe:animate-pulse" /> 3 READY
        </Pill>
      </div>
      <div className="mt-auto">
        <div className="glass flex items-center justify-between rounded-2xl px-3.5 py-3 text-[13px] text-white/90">
          What limits do the studies share?
          <span className="grid size-6 place-items-center rounded-full bg-white text-ink">
            <ArrowRight className="size-3" />
          </span>
        </div>
        <ThreadProgress />
      </div>
      <div className="mt-auto pt-[18%]">
        <p className="text-[15px] text-white/85">Evidence assembled</p>
        <p className="mt-1 text-[11px] text-white/40">4 citations · confidence 78%</p>
      </div>
    </>
  );
}

interface SurfaceCardProps {
  surface: SurfaceMeta;
  className?: string;
  style?: CSSProperties;
}

export function SurfaceCard({ surface, className = '', style }: SurfaceCardProps) {
  return (
    <article
      className={`relative flex aspect-[338/452] w-[var(--card-w)] flex-col overflow-hidden rounded-[var(--radius-card)] p-[6%] text-white shadow-[0_30px_60px_-20px_rgb(20_5_50/0.45)] ${className}`}
      style={{ background: surface.background, ...style }}
      aria-label={surface.title ?? surface.tag}
    >
      <div className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-white/10 ring-inset" />
      {surface.id === 'live' ? (
        <LiveSessionBody />
      ) : (
        <>
          <div className="flex items-center justify-between">
            <Pill dark={surface.dark}>{surface.tag}</Pill>
            {surface.domain && <span className="text-[11px] text-white/60">{surface.domain}</span>}
          </div>
          {surface.id === 'sources' && (
            <Sparkle className="absolute top-1/2 left-[22%] size-[22%] -translate-y-1/2 text-white/70 blur-[1px]" />
          )}
          {surface.title && (
            <div className="mt-auto">
              <h3 className="display text-[clamp(20px,2.1vw,28px)] leading-[1.02] text-balance">{surface.title}</h3>
              <p className="mt-2.5 text-[11.5px] leading-snug text-white/55">{surface.body}</p>
            </div>
          )}
        </>
      )}
    </article>
  );
}
