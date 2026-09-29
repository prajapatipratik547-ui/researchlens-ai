import { useRef, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { motion, useReducedMotion, useTransform, type MotionValue } from 'motion/react';
import { useSectionProgress } from '../../hooks/useSectionProgress';
import { useViewport } from '../../hooks/useViewport';
import { ArrowRight } from '../ui/Sparkle';
import { SurfaceCard } from './SurfaceCard';
import { SURFACES } from './surfaces';
import { useCta } from './useCta';

/* Scroll timeline (fraction of the pinned section). */
const CONTENT_OUT: [number, number] = [0, 0.07];
const HERO_OUT: [number, number] = [0.025, 0.14];
const HANDOFF = 0.145;
const RING: [number, number] = [0.17, 0.9];
const EXPLORE_IN: [number, number] = [0.8, 0.9];

const STEP = 360 / SURFACES.length;
const MARQUEE = 'Every claim cited ○ Evidence you can check ○ ';

const HERO_BG =
  'radial-gradient(90% 70% at 0% 0%, #7a2ff0 0%, #5516c0 22%, transparent 62%), radial-gradient(70% 40% at 50% 112%, rgb(178 150 225 / 0.55), transparent 70%), linear-gradient(180deg, #3a0a8a 0%, #200552 50%, #1b1428 100%)';
const STAGE_BG =
  'radial-gradient(75% 60% at 50% 38%, #fbfbfc 0%, #efeef2 55%, #d9d8de 88%, #b9b8bf 100%)';

function useLayout() {
  const { w, h } = useViewport();
  const mobile = w < 768;
  const cardW = Math.round(Math.min(340, Math.max(210, mobile ? w * 0.6 : w * 0.297)));
  const radius = cardW * (mobile ? 1.25 : 1.62);
  // Where the Live card sits inside the hero, relative to the carousel slot.
  const hero = mobile ? { x: 0, y: h * 0.5 + cardW * 0.75, s: 0.85 } : { x: w * 0.26 - 8, y: -h * 0.02, s: 0.86 };
  return { w, h, mobile, cardW, radius, hero };
}

/* ---------------------------------------------------------------- hero copy */

function FileTypes() {
  const types = [
    ['PDF', '#b0457e'],
    ['DOC', '#2f6f86'],
    ['TXT', '#5b7d3a'],
  ] as const;
  return (
    <div className="glass inline-flex items-center gap-2.5 rounded-full py-1 pr-4 pl-1 !border-white/5 !bg-white/[0.04]">
      <div className="flex -space-x-2" aria-hidden="true">
        {types.map(([t, c]) => (
          <span
            key={t}
            className="grid size-7 place-items-center rounded-full font-mono text-[7.5px] font-medium text-white ring-2 ring-[#1d1030]"
            style={{ background: `radial-gradient(circle at 35% 30%, #ffffff44, ${c} 60%)` }}
          >
            {t}
          </span>
        ))}
      </div>
      <span className="text-[11.5px] text-white/50">Works with your PDF, DOCX and TXT sources</span>
    </div>
  );
}

function HeroCopy() {
  const reduce = useReducedMotion();
  const cta = useCta();
  const rise = (delay: number) => ({
    initial: { opacity: 0, y: reduce ? 0 : 40 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 1.2, delay, ease: [0.16, 1, 0.3, 1] as const },
  });
  return (
    <div className="flex h-full flex-col px-6 pt-24 pb-8 sm:px-12 sm:pt-[12vh] md:pb-10">
      <h1 className="display text-[clamp(52px,7.2vw,118px)]">
        <motion.span className="block text-white" {...rise(0.1)}>
          Research that
        </motion.span>
        <motion.span className="block text-[#b9a3e6]/75" {...rise(0.2)}>
          answers first
        </motion.span>
      </h1>
      <div className="mt-auto max-w-[400px] md:mb-[2vh]">
        <motion.p className="text-[14.5px] leading-relaxed text-white/75" {...rise(0.35)}>
          Upload your papers, ask one question, and get answers built only from your sources — every claim linked
          to a file and a page.
        </motion.p>
        <motion.div className="mt-7 flex gap-2.5" {...rise(0.45)}>
          <a
            href="#how-it-works"
            className="rounded-xl border border-white/8 bg-white/[0.06] px-5 py-3 text-sm text-white/80 backdrop-blur hover:bg-white/10"
          >
            How it works
          </a>
          <Link
            to={cta.to}
            className="inline-flex items-center gap-2 rounded-xl bg-[#d8d4de] px-5 py-3 text-sm text-ink hover:bg-white"
          >
            {cta.signedIn ? 'Go to dashboard' : 'Start researching'} <ArrowRight className="size-3.5" />
          </Link>
        </motion.div>
        <motion.div className="mt-8" {...rise(0.55)}>
          <FileTypes />
        </motion.div>
      </div>
      <motion.p
        className="absolute right-12 bottom-10 hidden max-w-[290px] text-right text-[12.5px] leading-relaxed text-white/35 lg:block"
        {...rise(0.6)}
      >
        From upload to cited answer in seconds — ResearchLens reads every page so you can check every claim.
      </motion.p>
    </div>
  );
}

/* ------------------------------------------------------------ ring + marquee */

function RingCard({
  index,
  radius,
  progress,
}: {
  index: number;
  radius: number;
  progress: MotionValue<number>;
}) {
  const surface = SURFACES[index]!;
  // The Live card in slot 0 is invisible until the floating hero card lands on it.
  const opacity = useTransform(progress, (p) => (index === 0 && p < HANDOFF ? 0 : 1));
  return (
    <motion.div
      className="absolute top-1/2 left-1/2 [backface-visibility:hidden]"
      style={{
        opacity,
        // Rotate first, then push out along the new axis: motion's transform order can't express this.
        transform: `translate(-50%, -50%) rotateY(${index * STEP}deg) translateZ(${radius}px)`,
      }}
    >
      <SurfaceCard surface={surface} />
    </motion.div>
  );
}

function Marquee({ progress, radius }: { progress: MotionValue<number>; radius: number }) {
  const x = useTransform(progress, [0, 1], ['-4%', '-46%']);
  return (
    <div
      className="pointer-events-none absolute top-1/2 left-0"
      style={{ transform: `translateY(-50%) translateZ(${-radius * 0.35}px) scale(${1 + (radius * 0.35) / 1400})` }}
      aria-hidden="true"
    >
      <motion.p
        className="display text-[clamp(64px,10vw,170px)] leading-none whitespace-nowrap text-ink"
        style={{ x }}
      >
        {MARQUEE.repeat(4)}
      </motion.p>
    </div>
  );
}

/* ---------------------------------------------------------------- animated */

function AnimatedSurfaces() {
  const ref = useRef<HTMLElement>(null);
  const { progress } = useSectionProgress(ref, 0);
  const { h, cardW, radius, hero, mobile } = useLayout();

  const contentOpacity = useTransform(progress, CONTENT_OUT, [1, 0]);
  const contentScale = useTransform(progress, CONTENT_OUT, [1, 0.86]);
  const heroY = useTransform(progress, HERO_OUT, [0, -h - 40]);

  const floatX = useTransform(progress, HERO_OUT, [hero.x, 0]);
  const floatY = useTransform(progress, HERO_OUT, [hero.y, 0]);
  const floatScale = useTransform(progress, HERO_OUT, [hero.s, 1]);
  const floatOpacity = useTransform(progress, (p) => (p < HANDOFF ? 1 : 0));

  const ringRotate = useTransform(progress, RING, [0, -STEP * (SURFACES.length - 1)]);
  const exploreOpacity = useTransform(progress, EXPLORE_IN, [0.15, 1]);
  const exploreY = useTransform(progress, EXPLORE_IN, [16, 0]);

  const perspective = mobile ? 900 : 1400;
  const vars = { '--card-w': `${cardW}px` } as CSSProperties;

  return (
    <section ref={ref} id="features" className="relative h-[560vh] bg-paper" style={vars}>
      <div className="sticky top-0 h-svh p-2">
        {/* Light carousel stage */}
        <div data-nav="light" className="panel relative h-full" style={{ background: STAGE_BG }}>
          <div className="absolute inset-0" style={{ perspective: `${perspective}px`, perspectiveOrigin: '50% 45%' }}>
            <div className="absolute inset-0 [transform-style:preserve-3d]">
              <Marquee progress={progress} radius={radius} />
              <div className="absolute inset-x-0 top-[47%] [transform-style:preserve-3d]">
                <motion.div
                  className="absolute top-0 left-1/2 [transform-style:preserve-3d]"
                  style={{ z: -radius, rotateY: ringRotate }}
                >
                  {SURFACES.map((s, i) => (
                    <RingCard key={s.id} index={i} radius={radius} progress={progress} />
                  ))}
                </motion.div>
              </div>
            </div>
          </div>
          <motion.div
            className="absolute inset-x-0 bottom-[6%] flex justify-center"
            style={{ opacity: exploreOpacity, y: exploreY }}
          >
            <Link to="/research/new" className="rounded-xl bg-ink px-6 py-3 text-sm text-white hover:bg-ink-3">
              Start a research project
            </Link>
          </motion.div>
        </div>

        {/* Purple hero panel, lifts away to reveal the stage */}
        <motion.div
          data-nav="dark"
          className="panel grain absolute inset-2 z-10"
          style={{ y: heroY, background: HERO_BG }}
        >
          <motion.div className="relative h-full origin-[30%_40%]" style={{ opacity: contentOpacity, scale: contentScale }}>
            <HeroCopy />
          </motion.div>
        </motion.div>

        {/* Floating Live card: hero → carousel slot 0 */}
        <div className="pointer-events-none absolute inset-x-0 top-[47%] z-20 flex justify-center">
          <motion.div style={{ x: floatX, y: floatY, scale: floatScale, opacity: floatOpacity }}>
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 1.3, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
            >
              <SurfaceCard surface={SURFACES[0]!} className="-translate-y-1/2" />
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------- reduced motion */

function StaticSurfaces() {
  const { cardW } = useLayout();
  return (
    <section id="features" className="bg-paper p-2" style={{ '--card-w': `${cardW}px` } as CSSProperties}>
      <div data-nav="dark" className="panel grain relative min-h-svh" style={{ background: HERO_BG }}>
        <div className="grid min-h-svh gap-10 md:grid-cols-[1fr_auto] md:items-center md:pr-12">
          <div className="relative min-h-[70svh]">
            <HeroCopy />
          </div>
          <div className="flex justify-center pb-10 md:pb-0">
            <SurfaceCard surface={SURFACES[0]!} />
          </div>
        </div>
      </div>
      <div data-nav="light" className="panel relative mt-2 py-20" style={{ background: STAGE_BG }}>
        <p className="display px-6 text-[clamp(48px,9vw,140px)] text-ink sm:px-12">Every claim cited</p>
        <div className="mt-10 flex snap-x gap-4 overflow-x-auto px-6 pb-6 sm:px-12">
          {SURFACES.slice(1).map((s) => (
            <SurfaceCard key={s.id} surface={s} className="shrink-0 snap-center" />
          ))}
        </div>
        <div className="mt-8 flex justify-center">
          <Link to="/research/new" className="rounded-xl bg-ink px-6 py-3 text-sm text-white">
            Start a research project
          </Link>
        </div>
      </div>
    </section>
  );
}

export function SurfacesScene() {
  const reduce = useReducedMotion();
  return reduce ? <StaticSurfaces /> : <AnimatedSurfaces />;
}
