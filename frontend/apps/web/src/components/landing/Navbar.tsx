import { useState } from 'react';
import { Link } from 'react-router';
import { motion, useMotionValueEvent, useScroll } from 'motion/react';
import { Sparkle } from '../ui/Sparkle';
import { useCta } from './useCta';

type NavTheme = 'dark' | 'light';

const LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Examples', href: '#examples' },
  { label: 'Sources', href: '#library' },
] as const;
const PROBE_Y = 40;

/** Reads `data-nav` from whichever section sits under the navbar. */
function useNavTheme(): NavTheme {
  const [theme, setTheme] = useState<NavTheme>('dark');
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, 'change', () => {
    // Wait for scroll-linked transforms to be applied this frame before measuring.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const sections = document.querySelectorAll<HTMLElement>('[data-nav]');
        let next: NavTheme = 'dark';
        for (const el of sections) {
          const r = el.getBoundingClientRect();
          if (r.top <= PROBE_Y && r.bottom > PROBE_Y) next = el.dataset.nav === 'light' ? 'light' : 'dark';
        }
        setTheme(next);
      }),
    );
  });
  return theme;
}

function NavPill({ theme, hidden }: { theme: NavTheme; hidden?: boolean }) {
  const light = theme === 'light';
  const cta = useCta();
  const linkClass = `block rounded-full px-3.5 py-2 text-[13px] ${
    light ? 'text-ink/70 hover:text-ink' : 'text-white/75 hover:text-white'
  }`;
  return (
    <nav
      aria-label={hidden ? undefined : 'Primary'}
      aria-hidden={hidden || undefined}
      inert={hidden || undefined}
      className={`flex items-center gap-1 rounded-full p-1.5 ${
        light
          ? 'bg-white/90 text-ink shadow-[0_8px_30px_rgb(20_10_40/0.12)]'
          : 'border border-white/8 bg-[#140a26]/55 text-white shadow-[0_8px_30px_rgb(0_0_0/0.25)]'
      } backdrop-blur-xl`}
    >
      <Link to="/" aria-label="ResearchLens home" className="grid size-9 place-items-center rounded-full">
        <Sparkle className="size-4" />
      </Link>
      <ul className="hidden items-center md:flex">
        {LINKS.map((l) => (
          <li key={l.label}>
            <a href={l.href} className={linkClass}>
              {l.label}
            </a>
          </li>
        ))}
      </ul>
      {/* Signed-in users see "Go to dashboard" instead of Log in. */}
      {!cta.signedIn && (
        <Link to="/login" className={linkClass}>
          Log in
        </Link>
      )}
      <Link
        to={cta.to}
        className={`ml-1 rounded-full px-4 py-2 text-[13px] font-medium ${
          light ? 'bg-ink text-white' : 'bg-white text-ink'
        }`}
      >
        {cta.label}
      </Link>
    </nav>
  );
}

export function Navbar() {
  const theme = useNavTheme();
  return (
    <header className="pointer-events-none fixed inset-x-0 top-3 z-50 flex justify-center px-4 sm:top-4">
      <div className="pointer-events-auto relative">
        <motion.div animate={{ opacity: theme === 'dark' ? 1 : 0 }} transition={{ duration: 0.35 }}>
          <NavPill theme="dark" hidden={theme !== 'dark'} />
        </motion.div>
        <motion.div
          className="absolute inset-0"
          style={{ pointerEvents: theme === 'light' ? 'auto' : 'none' }}
          animate={{ opacity: theme === 'light' ? 1 : 0 }}
          transition={{ duration: 0.35 }}
        >
          <NavPill theme="light" hidden={theme !== 'light'} />
        </motion.div>
      </div>
    </header>
  );
}
