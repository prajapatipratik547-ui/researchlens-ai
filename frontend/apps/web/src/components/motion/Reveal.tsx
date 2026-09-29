import type { ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';

interface RevealProps {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  /** Animate on mount instead of when scrolled into view. */
  immediate?: boolean;
}

/** Fade + rise entrance. Opacity/transform only. */
export function Reveal({ children, delay = 0, y = 24, className, immediate = false }: RevealProps) {
  const reduce = useReducedMotion();
  const hidden = { opacity: 0, y: reduce ? 0 : y };
  const shown = { opacity: 1, y: 0 };
  const transition = { duration: reduce ? 0.2 : 1.1, delay, ease: [0.16, 1, 0.3, 1] as const };

  return immediate ? (
    <motion.div className={className} initial={hidden} animate={shown} transition={transition}>
      {children}
    </motion.div>
  ) : (
    <motion.div
      className={className}
      initial={hidden}
      whileInView={shown}
      viewport={{ once: true, amount: 0.3 }}
      transition={transition}
    >
      {children}
    </motion.div>
  );
}
