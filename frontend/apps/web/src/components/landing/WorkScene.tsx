import { useRef, type ReactNode } from 'react';
import { Link } from 'react-router';
import { motion, useMotionValue, useTransform, type MotionValue } from 'motion/react';
import { useSectionProgress } from '../../hooks/useSectionProgress';
import { useViewport } from '../../hooks/useViewport';
import { ArrowRight } from '../ui/Sparkle';
import { useCta } from './useCta';

interface Project {
  no: string;
  slug: string;
  name: string;
  year: string;
  tags: string;
  art: string;
}

const PROJECTS: Project[] = [
  {
    no: '01',
    slug: 'genai-productivity',
    name: 'Developer AI',
    year: '2026',
    tags: 'Software · 4 sources · 9 insights',
    art: 'radial-gradient(45% 30% at 55% 28%, rgb(210 180 255 / 0.75), transparent 70%), radial-gradient(60% 40% at 30% 70%, rgb(150 40 170 / 0.55), transparent 70%), linear-gradient(170deg, #4a1790 0%, #2a0a55 55%, #140620 100%)',
  },
  {
    no: '02',
    slug: 'sleep-memory',
    name: 'Sleep & Memory',
    year: '2026',
    tags: 'Neuroscience · 6 sources',
    art: 'radial-gradient(circle at 50% 42%, rgb(255 255 255 / 0.95) 0%, rgb(200 205 220 / 0.5) 9%, transparent 22%), repeating-radial-gradient(circle at 50% 42%, rgb(140 150 180 / 0.28) 0 1px, transparent 1px 13px), linear-gradient(180deg, #1b2130 0%, #121620 100%)',
  },
  {
    no: '03',
    slug: 'urban-heat',
    name: 'Urban Heat',
    year: '2025',
    tags: 'Climate · 5 sources',
    art: 'radial-gradient(70% 16% at 60% 55%, rgb(150 80 220 / 0.7), transparent 75%), linear-gradient(180deg, #1c0d3d 0%, #2a0f58 45%, #120824 100%)',
  },
  {
    no: '04',
    slug: 'microplastics',
    name: 'Microplastics',
    year: '2025',
    tags: 'Public health · 7 sources',
    art: 'radial-gradient(35% 28% at 68% 62%, rgb(210 150 90 / 0.8), transparent 75%), linear-gradient(170deg, #2c1508 0%, #1a0e07 60%, #0f0906 100%)',
  },
  {
    no: '05',
    slug: 'remote-work',
    name: 'Remote Work',
    year: '2026',
    tags: 'Management · 3 sources',
    art: 'radial-gradient(45% 30% at 45% 36%, rgb(70 170 145 / 0.8), transparent 75%), linear-gradient(170deg, #10241f 0%, #0c1614 60%, #090d0c 100%)',
  },
];

const SLIDES = PROJECTS.length + 1; // + archive card
const ACTIVE_SCALE = 1.4;

function useTrack() {
  const { w, h } = useViewport();
  const cardW = Math.round(Math.min(360, Math.max(230, w < 768 ? w * 0.6 : w * 0.31)));
  const gap = Math.round(cardW * ((ACTIVE_SCALE - 1) / 2) + 28);
  return { w, h, cardW, cardH: Math.round(cardW * 0.78), gap, pitch: cardW + gap };
}

function Slide({
  index,
  focus,
  children,
  cardW,
  cardH,
}: {
  index: number;
  focus: MotionValue<number>;
  children: (reveal: MotionValue<number>) => ReactNode;
  cardW: number;
  cardH: number;
}) {
  const distance = useTransform(focus, (f) => Math.min(1, Math.abs(f - index)));
  const scale = useTransform(distance, [0, 1], [ACTIVE_SCALE, 1]);
  const opacity = useTransform(distance, [0, 1], [1, 0.55]);
  const reveal = useTransform(distance, [0, 0.35], [1, 0]);
  return (
    <motion.li className="shrink-0" style={{ width: cardW, height: cardH, scale, opacity }}>
      {children(reveal)}
    </motion.li>
  );
}

function ProjectCard({ project, reveal }: { project: Project; reveal: MotionValue<number> }) {
  const { to } = useCta();
  const cta = 'Start one like it';
  return (
    <Link
      to={to}
      aria-label={`${project.name} — example project. ${cta}`}
      className="relative flex h-full flex-col overflow-hidden rounded-[18px] p-3.5 ring-1 ring-white/6"
      style={{ background: project.art }}
    >
      <div className="flex items-center justify-between font-mono text-[8.5px] text-white/70">
        <span className="flex items-center gap-2">
          <span className="rounded-full border border-white/20 px-1.5 py-0.5">{project.no}</span>
          <span className="font-sans text-[9.5px] text-white/85">{project.slug}</span>
        </span>
        <span className="tracking-[0.15em]">{project.year}</span>
      </div>
      <div className="mt-auto flex items-end justify-between gap-3">
        <div>
          <h3 className="display text-[clamp(26px,2.6vw,38px)] text-white/90">{project.name}</h3>
          <p className="mt-1.5 text-[8.5px] text-white/45">{project.tags}</p>
        </div>
        <motion.span
          style={{ opacity: reveal }}
          className="mb-0.5 inline-flex shrink-0 items-center gap-1 rounded-full border border-white/12 px-2.5 py-1.5 text-[8.5px] text-mint"
        >
          {cta} <ArrowRight className="size-2.5" />
        </motion.span>
      </div>
    </Link>
  );
}

function ArchiveCard() {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-[18px] bg-ink-3/80 text-center ring-1 ring-white/6">
      <p className="font-mono text-[7.5px] tracking-[0.2em] text-white/40">
        0{PROJECTS.length} / 0{PROJECTS.length}
      </p>
      <p className="display mt-2 text-[clamp(22px,2.4vw,32px)] leading-none">
        Start your
        <br />
        own project
      </p>
      <Link
        to="/research/new"
        className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3.5 py-2 text-[9.5px] ring-1 ring-white/10 hover:bg-white/15"
      >
        Create project <ArrowRight className="size-2.5" />
      </Link>
    </div>
  );
}

export function WorkScene() {
  const ref = useRef<HTMLElement>(null);
  const { progress, reduce } = useSectionProgress(ref, 0);
  const { w, cardW, cardH, pitch } = useTrack();

  // `focus` is the index of the slide sitting at the viewport centre.
  const focus = useTransform(progress, [0.06, 0.94], [0, SLIDES - 1]);
  const x = useTransform(focus, (f) => w / 2 - cardW / 2 - f * pitch);
  const headerOpacity = useTransform(progress, [0, 0.08], [0.4, 1]);
  const shown = useMotionValue(1);

  const slides = (
    <>
      {PROJECTS.map((p, i) => (
        <Slide key={p.slug} index={i} focus={focus} cardW={cardW} cardH={cardH}>
          {(reveal) => <ProjectCard project={p} reveal={reveal} />}
        </Slide>
      ))}
      <Slide index={PROJECTS.length} focus={focus} cardW={cardW} cardH={cardH}>
        {() => <ArchiveCard />}
      </Slide>
    </>
  );

  if (reduce) {
    return (
      <section id="examples" data-nav="dark" className="bg-ink p-2">
        <div className="panel bg-[#08090c] py-16">
          <p className="px-6 font-mono text-[10px] tracking-[0.25em] text-white/45 uppercase sm:px-12">Example projects</p>
          <ul className="mt-10 flex snap-x gap-6 overflow-x-auto px-6 pb-6 sm:px-12">
            {PROJECTS.map((p) => (
              <li key={p.slug} className="shrink-0 snap-center" style={{ width: cardW, height: cardH }}>
                <ProjectCard project={p} reveal={shown} />
              </li>
            ))}
          </ul>
        </div>
      </section>
    );
  }

  return (
    <section ref={ref} id="examples" data-nav="dark" className="relative h-[420vh] bg-ink">
      <div className="sticky top-0 h-svh p-2">
        <div className="panel relative h-full bg-[#08090c]">
          <motion.p
            className="absolute top-[14%] left-6 font-mono text-[10px] tracking-[0.25em] text-white/45 uppercase sm:left-12"
            style={{ opacity: headerOpacity }}
          >
            Example projects
          </motion.p>
          <motion.ul
            className="absolute top-1/2 left-0 flex items-center"
            style={{ x, y: '-45%', gap: pitch - cardW }}
          >
            {slides}
          </motion.ul>
        </div>
      </div>
    </section>
  );
}
