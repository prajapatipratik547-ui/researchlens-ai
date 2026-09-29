import { useMotionValue, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react';
import type { RefObject } from 'react';

/**
 * 0→1 progress while a tall "pinned" section scrolls past its sticky stage.
 * With reduced motion the scene is frozen at `restAt` so it reads as a static layout.
 */
export function useSectionProgress(
  target: RefObject<HTMLElement | null>,
  restAt = 0.5,
): { progress: MotionValue<number>; reduce: boolean } {
  const reduce = useReducedMotion() ?? false;
  const { scrollYProgress } = useScroll({ target, offset: ['start start', 'end end'] });
  // A function transform keeps every derived value on the JS frame loop. Without it, motion hands
  // some opacity bindings to native ScrollTimelines, which drift out of sync with sticky stages.
  const progress = useTransform(scrollYProgress, (v) => v);
  const frozen = useMotionValue(restAt);
  return { progress: reduce ? frozen : progress, reduce };
}
