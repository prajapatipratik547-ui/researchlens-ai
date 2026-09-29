import { Gauge } from 'lucide-react';
import { confidenceLevel } from '../utils/confidence';

/** "High confidence" label for insights and gaps (chat answers show the %). */
export default function ConfidencePill({ score }) {
  const { label, pill } = confidenceLevel(score);
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${pill}`}
      title={`Confidence ${score}/100, based on the evidence behind it`}
    >
      <Gauge className="size-3.5" aria-hidden="true" />
      {label} confidence
    </span>
  );
}
