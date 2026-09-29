import { useState } from 'react';
import type { ContradictionDetails, GapDetails, Insight } from '@synapse/shared';
import { INSIGHT_LABEL } from './insightLabels';
import { Confidence, SourceCite, StatusPill } from '../ui/Evidence';

const isContradiction = (d: Insight['details']): d is ContradictionDetails => Boolean(d && 'claimA' in d);
const isGap = (d: Insight['details']): d is GapDetails => Boolean(d && 'rationale' in d);

export function InsightCard({ insight, openDocument }: { insight: Insight; openDocument: (id: string) => void }) {
  const [showEvidence, setShowEvidence] = useState(false);
  const d = insight.details;

  return (
    <article className="flex h-full flex-col rounded-2xl border border-white/8 bg-white/[0.03] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-[10px] tracking-[0.18em] text-violet-200/80 uppercase">{INSIGHT_LABEL[insight.type]}</span>
        <Confidence score={insight.confidence} />
      </div>
      <h3 className="mt-3 text-[16px] leading-snug font-medium text-white">{insight.title}</h3>
      <p className="mt-2 text-[13.5px] leading-relaxed text-white/60">{insight.description}</p>

      {isContradiction(d) && (
        <div className="mt-4 space-y-2">
          {[d.claimA, d.claimB].map((claim, i) => (
            <div key={i} className="rounded-xl border border-white/8 bg-black/20 p-3">
              <p className="text-[13px] text-white/80">
                <span className="mr-1.5 font-mono text-[11px] text-white/40">{i === 0 ? 'A' : 'B'}</span>
                {claim.text}
              </p>
              <div className="mt-1.5">
                <SourceCite filename={claim.filename} page={claim.pageNumber} onOpen={() => openDocument(claim.documentId)} />
              </div>
            </div>
          ))}
          <p className="text-[13px] text-white/60">
            <span className="font-medium text-white/80">Possible explanation: </span>
            {d.possibleExplanation}
          </p>
        </div>
      )}

      {isGap(d) && (
        <p className="mt-4 rounded-xl border border-white/8 bg-black/20 p-3 text-[13px] text-white/70">
          <span className="font-medium text-white/85">Why this is a gap: </span>
          {d.rationale}
        </p>
      )}

      <div className="mt-auto pt-4">
        {insight.sourceReferences.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {insight.sourceReferences.map((s) => (
              <SourceCite
                key={`${s.documentId}-${s.pageNumber}`}
                filename={s.filename}
                page={s.pageNumber}
                onOpen={() => openDocument(s.documentId)}
              />
            ))}
          </div>
        )}
        {insight.evidence.length > 0 && (
          <>
            <button
              type="button"
              aria-expanded={showEvidence}
              onClick={() => setShowEvidence((s) => !s)}
              className="mt-3 text-[12.5px] text-white/45 hover:text-white/80"
            >
              {showEvidence ? 'Hide evidence' : `Show evidence (${insight.evidence.length})`}
            </button>
            {showEvidence && (
              <ul className="mt-3 space-y-2">
                {insight.evidence.map((e, i) => (
                  <li key={i} className="rounded-xl border border-white/8 bg-black/20 p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
                      <StatusPill status={e.support} compact />
                      <p className="text-[13px] text-white/80">{e.claim}</p>
                    </div>
                    <div className="mt-1.5">
                      <SourceCite filename={e.filename} page={e.pageNumber} onOpen={() => openDocument(e.documentId)} />
                    </div>
                    {e.quote && <blockquote className="mt-2 border-l-2 border-violet-300/40 pl-3 text-[12.5px] text-white/55 italic">{e.quote}</blockquote>}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </article>
  );
}
