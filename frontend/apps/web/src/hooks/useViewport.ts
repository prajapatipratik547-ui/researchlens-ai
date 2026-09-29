import { useSyncExternalStore } from 'react';

type Size = { w: number; h: number };

let cached: Size = { w: 1280, h: 800 };

function read(): Size {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (w !== cached.w || h !== cached.h) cached = { w, h };
  return cached;
}

/** Window size, stable identity between resizes. */
export function useViewport(): Size {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener('resize', onChange);
      return () => window.removeEventListener('resize', onChange);
    },
    read,
    () => cached,
  );
}
