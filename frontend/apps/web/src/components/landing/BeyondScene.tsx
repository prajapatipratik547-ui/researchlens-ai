import { useRef } from 'react';
import { motion, useTransform, type MotionValue } from 'motion/react';
import { useSectionProgress } from '../../hooks/useSectionProgress';
import { Sparkle } from '../ui/Sparkle';

const STATS = [
  { value: '3–15s', label: 'Per cited answer' },
  { value: '10 MB', label: 'Per source file' },
  { value: '4', label: 'Evidence states' },
] as const;

/* Scroll timeline. */
const COPY_OUT: [number, number] = [0.22, 0.4];
const STATS_IN = 0.3;
const TITLE_OUT: [number, number] = [0.55, 0.68];
const ZOOM: [number, number] = [0.66, 0.93];
const FADE: [number, number] = [0.88, 1];

function Stat({ index, progress, reduce }: { index: number; progress: MotionValue<number>; reduce: boolean }) {
  const start = STATS_IN + index * 0.05;
  const opacity = useTransform(progress, [start, start + 0.1, TITLE_OUT[0], TITLE_OUT[1]], [0, 1, 1, 0]);
  const x = useTransform(progress, [start, start + 0.12], [48, 0]);
  const stat = STATS[index]!;
  return (
    <motion.div className="text-left md:text-right" style={reduce ? undefined : { opacity, x }}>
      <p className="text-[clamp(22px,2.2vw,32px)] tracking-tight text-white/90">{stat.value}</p>
      <p className="mt-1 font-mono text-[9.5px] tracking-[0.18em] text-white/35 uppercase">{stat.label}</p>
    </motion.div>
  );
}

export function BeyondScene() {
  const ref = useRef<HTMLElement>(null);
  const { progress, reduce } = useSectionProgress(ref, 0.1);

  const copyOpacity = useTransform(progress, COPY_OUT, [1, 0]);
  const copyY = useTransform(progress, COPY_OUT, [0, -24]);
  const titleOpacity = useTransform(progress, TITLE_OUT, [1, 0]);
  const titleY = useTransform(progress, [0, TITLE_OUT[1]], [0, -40]);
  const limitY = useTransform(progress, [0, TITLE_OUT[1]], [30, 0]);
  const starScale = useTransform(progress, [0, ZOOM[0], ZOOM[1]], [0.92, 1.08, 26], { clamp: true });
  const starRotate = useTransform(progress, [0, ZOOM[1]], [-8, 12]);
  const glowScale = useTransform(progress, [0, 0.5, ZOOM[0]], [0.8, 1.15, 1.4]);
  const glowOpacity = useTransform(progress, [0, 0.2, ZOOM[0], ZOOM[1]], [0.5, 1, 1, 0]);
  const stageOpacity = useTransform(progress, FADE, [1, 0]);

  return (
    <section ref={ref} id="how-it-works" data-nav="dark" className={`relative bg-ink ${reduce ? 'h-svh' : 'h-[340vh]'}`}>
      <div className="sticky top-0 h-svh p-2">
        <motion.div
          className="panel relative h-full bg-[#08090c]"
          style={{ opacity: stageOpacity }}
        >
          {/* Star + glow */}
          <div className="absolute inset-0 grid place-items-center overflow-hidden">
            <motion.div
              className="absolute size-[min(70vw,520px)] rounded-full"
              style={{
                scale: glowScale,
                opacity: glowOpacity,
                background: 'radial-gradient(circle, rgb(130 70 220 / 0.55) 0%, rgb(80 30 160 / 0.2) 35%, transparent 65%)',
              }}
            />
            <motion.div style={{ scale: starScale, rotate: starRotate }}>
              <Sparkle
                className="size-[clamp(110px,15vw,180px)] text-[#ecebf0] drop-shadow-[0_0_28px_rgb(170_120_255/0.55)]"
              />
            </motion.div>
          </div>

          <motion.h2
            className="display text-silver absolute top-[9%] left-5 text-[clamp(72px,11vw,168px)] sm:left-8"
            style={{ opacity: titleOpacity, y: titleY }}
          >
            Beyond
          </motion.h2>
          <motion.p
            aria-hidden="true"
            className="display text-smoke absolute right-5 bottom-[4%] text-[clamp(64px,10.5vw,160px)] sm:right-8"
            style={{ opacity: titleOpacity, y: limitY }}
          >
            the abstract
          </motion.p>

          <motion.div
            className="absolute bottom-[22%] left-5 max-w-[360px] space-y-4 text-[12.5px] leading-relaxed text-white/45 sm:left-12 md:bottom-[14%]"
            style={{ opacity: copyOpacity, y: copyY }}
          >
            <p>
              ResearchLens reads the full text of every source you upload — keeping page numbers, splitting it into
              passages and answering only from what is actually there.
            </p>
            <p className="text-white/30">
              When the evidence isn’t in your corpus, it says so. Every claim is marked as supporting, contradicting or
              unclear — so you can tell source evidence from AI interpretation.
            </p>
          </motion.div>

          <div className="absolute inset-x-5 bottom-[22%] flex justify-between gap-4 sm:right-8 md:inset-x-auto md:top-[30%] md:bottom-auto md:block md:space-y-8">
            {STATS.map((s, i) => (
              <Stat key={s.label} index={i} progress={progress} reduce={reduce} />
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
