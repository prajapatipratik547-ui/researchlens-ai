import { useRef } from 'react';
import { motion, useTransform, type MotionValue } from 'motion/react';
import { useSectionProgress } from '../../hooks/useSectionProgress';
import { useViewport } from '../../hooks/useViewport';

interface Tile {
  label: string;
  /** Position/size in % of the stage. */
  left: number;
  top: number;
  width: number;
  height: number;
  /** 0 = far (slow, dim), 1 = near (fast, bright). */
  depth: number;
  art: string;
  mobile?: boolean;
}

const TILES: Tile[] = [
  { label: 'notes.txt', left: 1, top: 2, width: 7, height: 14, depth: 0.25, art: 'radial-gradient(circle at 50% 40%, #9a4fd8, #3a1170 60%, #150826)' },
  { label: 'appendix.txt', left: 33, top: 14, width: 5, height: 8, depth: 0.1, art: 'radial-gradient(circle at 50% 60%, #2d6a5a, #0f201c 70%)' },
  { label: 'survey-2025.docx', left: 12, top: 32, width: 13, height: 28, depth: 0.45, art: 'radial-gradient(circle at 45% 35%, #a3383c, #3c0e12 60%, #1a0709)', mobile: true },
  {
    label: 'field-study.pdf',
    left: 44,
    top: 14,
    width: 35,
    height: 37,
    depth: 1,
    art: 'repeating-linear-gradient(118deg, rgb(255 255 255 / 0.12) 0 1px, transparent 1px 11px), radial-gradient(70% 70% at 70% 40%, #6b7fd0, transparent 70%), linear-gradient(160deg, #cfd2e6 0%, #7581b8 45%, #2c3566 100%)',
    mobile: true,
  },
  { label: 'review.pdf', left: 92, top: 2, width: 7, height: 26, depth: 0.55, art: 'linear-gradient(180deg, #6a2ab8, #2a0f55)' },
  { label: 'interviews.docx', left: 80, top: 30, width: 18, height: 21, depth: 0.7, art: 'radial-gradient(30% 25% at 30% 70%, #c6e04a, transparent 70%), radial-gradient(40% 40% at 70% 30%, #2e7a3a, transparent 75%), linear-gradient(160deg, #10180f, #0a0d0a)', mobile: true },
  {
    label: 'meta-analysis.pdf',
    left: 23,
    top: 60,
    width: 32,
    height: 39,
    depth: 0.85,
    art: 'radial-gradient(circle at 60% 50%, rgb(255 255 255 / 0.35), transparent 30%), conic-gradient(from 20deg at 60% 50%, #5d5d64, #d8d8dc, #6f6f76, #c5c5ca, #4a4a50, #bdbdc2, #66666c, #dcdce0, #5d5d64)',
    mobile: true,
  },
  { label: 'white-paper.pdf', left: 86, top: 64, width: 13, height: 12, depth: 0.35, art: 'radial-gradient(60% 40% at 60% 60%, #8a3ad0, transparent 75%), linear-gradient(180deg, #1c0c35, #0e0619)' },
  { label: 'lab-results.pdf', left: 67, top: 80, width: 11, height: 14, depth: 0.5, art: 'radial-gradient(circle at 50% 50%, rgb(255 255 255 / 0.6) 0%, transparent 18%), repeating-radial-gradient(circle, rgb(150 160 200 / 0.25) 0 1px, transparent 1px 8px), #10131c' },
  { label: 'dataset.txt', left: 3, top: 84, width: 9, height: 15, depth: 0.3, art: 'radial-gradient(circle at 50% 70%, #c47a3c, #3a1a08 60%, #140905)' },
];

function LibraryTile({ tile, progress, h }: { tile: Tile; progress: MotionValue<number>; h: number }) {
  const travel = h * (0.25 + tile.depth * 0.75);
  const y = useTransform(progress, [0, 1], [travel, -travel]);
  const scale = useTransform(progress, [0, 1], [0.94, 1 + tile.depth * 0.1]);
  return (
    <motion.div
      className={`absolute overflow-hidden rounded-xl ring-1 ring-white/5 ${tile.mobile ? '' : 'hidden md:block'}`}
      style={{
        left: `${tile.left}%`,
        top: `${tile.top}%`,
        width: `${tile.width}%`,
        height: `${tile.height}%`,
        background: tile.art,
        y,
        scale,
        opacity: 0.35 + tile.depth * 0.55,
        zIndex: Math.round(tile.depth * 10),
      }}
    >
      <span className="absolute top-2 left-2.5 text-[9px] text-white/45">{tile.label}</span>
    </motion.div>
  );
}

export function LibraryScene() {
  const ref = useRef<HTMLElement>(null);
  const { progress, reduce } = useSectionProgress(ref, 0.5);
  const { h } = useViewport();
  const titleOpacity = useTransform(progress, [0.15, 0.32, 0.68, 0.85], [0, 1, 1, 0]);
  const titleScale = useTransform(progress, [0.15, 0.5, 0.85], [0.94, 1, 1.04]);

  return (
    <section
      ref={ref}
      id="library"
      data-nav="dark"
      className={`relative bg-ink ${reduce ? 'h-svh' : 'h-[300vh]'}`}
    >
      <div className="sticky top-0 h-svh p-2">
        <div className="panel relative h-full bg-[#060608]">
          {TILES.map((t) => (
            <LibraryTile key={t.label} tile={t} progress={progress} h={reduce ? 0 : h} />
          ))}
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(40%_35%_at_50%_50%,rgb(6_6_8/0.85),transparent)]" />
          <motion.div
            className="absolute inset-0 z-20 grid place-items-center px-6 text-center"
            style={reduce ? undefined : { opacity: titleOpacity, scale: titleScale }}
          >
            <div>
              <h2 className="display text-silver text-[clamp(40px,4.6vw,68px)] leading-[1.02]">
                Every source,
                <br />
                one workspace
              </h2>
              <p className="mx-auto mt-5 max-w-[320px] text-[13.5px] leading-relaxed text-white/55">
                Papers, reports and notes — searchable by the AI as soon as processing finishes, with page numbers kept.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
