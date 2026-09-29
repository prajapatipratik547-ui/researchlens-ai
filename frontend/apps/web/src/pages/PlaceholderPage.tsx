import { Link } from 'react-router';
import { Sparkle } from '../components/ui/Sparkle';

/** Temporary target for routes whose designs haven't landed yet. */
export function PlaceholderPage({ title, code }: { title: string; code?: string }) {
  return (
    <main className="grid min-h-svh place-items-center bg-ink px-4 text-center">
      <div>
        <Sparkle className="mx-auto size-10 text-violet-300" />
        {code && <p className="mt-6 font-mono text-xs tracking-[0.2em] text-white/40">{code}</p>}
        <h1 className="display mt-4 text-5xl text-silver">{title}</h1>
        <p className="mt-4 text-sm text-white/50">The page you’re looking for doesn’t exist.</p>
        <Link to="/" className="mt-8 inline-flex rounded-full bg-white px-5 py-2.5 text-sm text-ink">
          Back home
        </Link>
      </div>
    </main>
  );
}
