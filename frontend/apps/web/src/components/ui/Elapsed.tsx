import { useEffect, useState } from 'react';

/** Whole seconds since this element mounted — mount it only while the work is running. */
export function Elapsed() {
  const [start] = useState(() => Date.now());
  const [now, setNow] = useState(start);
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return <span className="tabular-nums">{Math.round((now - start) / 1000)}</span>;
}
