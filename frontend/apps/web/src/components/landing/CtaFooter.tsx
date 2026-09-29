import { Link } from 'react-router';
import { Reveal } from '../motion/Reveal';
import { ArrowRight, Sparkle } from '../ui/Sparkle';
import { ChromeStar } from './ChromeStar';
import { useCta } from './useCta';

const CTA_BG =
  'radial-gradient(80% 60% at 0% 0%, #7a2ff0 0%, #5516c0 25%, transparent 65%), radial-gradient(60% 35% at 30% 105%, rgb(190 150 225 / 0.6), transparent 70%), linear-gradient(180deg, #4210a0 0%, #2a0766 55%, #1c0a3a 100%)';

const FOOTER_COLUMNS = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'How it works', href: '#how-it-works' },
      { label: 'Examples', href: '#examples' },
      { label: 'Sources', href: '#library' },
    ],
  },
  {
    title: 'Workspace',
    links: [
      { label: 'Dashboard', to: '/dashboard' },
      { label: 'New project', to: '/research/new' },
      { label: 'Log in', to: '/login' },
      { label: 'Create account', to: '/register' },
    ],
  },
] as const;

function CtaPanel() {
  const cta = useCta();
  return (
    <div id="start" data-nav="dark" className="panel grain relative min-h-[max(100svh,640px)]" style={{ background: CTA_BG }}>
      <ChromeStar className="absolute top-0 right-[-20%] h-[52%] w-[125%] md:inset-y-0 md:right-[-4%] md:h-auto md:w-[68%]" />
      <div className="relative z-10 flex min-h-[inherit] flex-col justify-end px-6 pt-24 pb-12 sm:px-12 md:max-w-[46%] md:justify-center md:py-24">
        <h2 className="display text-[clamp(48px,6vw,92px)] leading-[0.95]">
          <Reveal>
            <span className="block">Research</span>
          </Reveal>
          <Reveal delay={0.08}>
            <span className="block">deeper,</span>
          </Reveal>
          <Reveal delay={0.16}>
            <span className="block text-[#b9a3e6]/70">cite</span>
          </Reveal>
          <Reveal delay={0.24}>
            <span className="block text-[#b9a3e6]/70">everything</span>
          </Reveal>
        </h2>
        <Reveal delay={0.3}>
          <p className="mt-7 max-w-[300px] text-[14.5px] leading-relaxed text-white/80">
            Upload sources, ask anything, and export a cited brief. Start your first project today.
          </p>
        </Reveal>
        <Reveal delay={0.38}>
          <Link
            to={cta.to}
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm text-ink shadow-[0_10px_30px_-10px_rgb(0_0_0/0.4)] hover:bg-violet-50"
          >
            {cta.label} <ArrowRight className="size-3.5" />
          </Link>
        </Reveal>
        <Reveal delay={0.44}>
          <p className="mt-7 max-w-[240px] text-[13px] leading-relaxed text-white/50">
            Free to try · Your files stay in your project
          </p>
        </Reveal>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer
      data-nav="light"
      className="relative px-6 pt-24 pb-8 text-ink sm:px-12"
      style={{ background: 'linear-gradient(180deg, #edecef 0%, #e2e1e6 55%, #6d6c72 100%)' }}
    >
      <div className="flex flex-col gap-14 md:flex-row md:items-end md:justify-between">
        <Reveal>
          <Sparkle className="size-6 text-violet-500" />
          <p className="display mt-4 text-[clamp(48px,7vw,108px)] text-ink">ResearchLens</p>
          <p className="mt-2 text-sm text-ink/45">Research that answers first.</p>
        </Reveal>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-10 sm:gap-16 md:mb-3">
          {FOOTER_COLUMNS.map((col, i) => (
            <Reveal key={col.title} delay={0.06 * i}>
              <p className="font-mono text-[10px] tracking-[0.2em] text-ink/40 uppercase">{col.title}</p>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    {'to' in l ? (
                      <Link to={l.to} className="text-[14px] text-ink/80 hover:text-ink">
                        {l.label}
                      </Link>
                    ) : (
                      <a href={l.href} className="text-[14px] text-ink/80 hover:text-ink">
                        {l.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </nav>
      </div>
      <div className="mt-24 flex flex-col gap-2 font-mono text-[10px] tracking-[0.18em] text-white/60 uppercase sm:flex-row sm:justify-between">
        <span>© 2026 ResearchLens</span>
        <span>Answers from your sources only</span>
      </div>
    </footer>
  );
}

export function CtaFooter() {
  return (
    <section className="bg-paper">
      <div className="bg-[linear-gradient(to_bottom,var(--color-ink)_50%,var(--color-paper)_50%)] p-2">
        <CtaPanel />
      </div>
      <Footer />
    </section>
  );
}
