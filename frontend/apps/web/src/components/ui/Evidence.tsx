import { confidenceLabel, type EvidenceStatus } from '@synapse/shared';

/* Evidence status + confidence display, exactly as defined by the integration guide. */

const STATUS: Record<EvidenceStatus, { icon: string; label: string; color: string }> = {
  supporting: { icon: '✓', label: 'Supports', color: 'var(--color-support)' },
  contradicting: { icon: '✕', label: 'Contradicts', color: 'var(--color-contradict)' },
  unclear: { icon: '?', label: 'Unclear', color: 'var(--color-unclear)' },
  no_evidence: { icon: '—', label: 'No evidence', color: 'var(--color-no-evidence)' },
};

/** Colour is always paired with an icon and a word. */
export function StatusPill({ status, compact = false }: { status: EvidenceStatus; compact?: boolean }) {
  const s = STATUS[status];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 self-start rounded-full border font-medium whitespace-nowrap ${
        compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-[12px]'
      }`}
      style={{ borderColor: s.color, color: 'white', background: `color-mix(in oklab, ${s.color} 22%, transparent)` }}
    >
      <span
        aria-hidden="true"
        className="grid size-3.5 place-items-center rounded-full text-[9px] leading-none font-bold text-white"
        style={{ background: s.color }}
      >
        {s.icon}
      </span>
      {s.label}
    </span>
  );
}

const LABEL_STYLE = {
  High: 'text-[#7ee2bd] bg-support/15 ring-support/40',
  Medium: 'text-[#ffd08a] bg-unclear/15 ring-unclear/40',
  Low: 'text-[#cbd5e1] bg-no-evidence/15 ring-no-evidence/40',
} as const;

/** "78% · High" for answers, "Medium" for insights. */
export function Confidence({ score, showPercent = false }: { score: number; showPercent?: boolean }) {
  const label = confidenceLabel(score);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium ring-1 ${LABEL_STYLE[label]}`}>
      <span className="sr-only">Confidence:</span>
      {showPercent && <span className="tabular-nums">{Math.round(score)}%</span>}
      {showPercent && <span aria-hidden="true">·</span>}
      {label}
    </span>
  );
}

/** "file.pdf · p. 4" — page omitted for DOCX/TXT. */
export function SourceCite({
  filename,
  page,
  onOpen,
}: {
  filename: string;
  page: number | null;
  onOpen?: () => void;
}) {
  const text = (
    <>
      <span className="truncate">{filename}</span>
      {page != null && <span className="shrink-0 text-white/45">· p. {page}</span>}
    </>
  );
  return onOpen ? (
    <button
      type="button"
      onClick={onOpen}
      className="inline-flex max-w-full items-center gap-1 text-left text-[12.5px] text-violet-200 underline decoration-violet-300/30 underline-offset-2 hover:decoration-violet-200"
    >
      {text}
    </button>
  ) : (
    <span className="inline-flex max-w-full items-center gap-1 text-[12.5px] text-white/70">{text}</span>
  );
}
