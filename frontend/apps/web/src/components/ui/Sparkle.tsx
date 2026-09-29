import type { SVGProps } from 'react';

/** The ResearchLens four-point star mark. */
export function Sparkle(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 100 100" aria-hidden="true" {...props}>
      <path
        d="M50 0C52.6 26.6 73.4 47.4 100 50 73.4 52.6 52.6 73.4 50 100 47.4 73.4 26.6 52.6 0 50 26.6 47.4 47.4 26.6 50 0Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function ArrowRight(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" {...props}>
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
