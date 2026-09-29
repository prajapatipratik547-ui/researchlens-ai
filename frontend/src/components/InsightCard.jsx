import { Quote, Sparkles } from 'lucide-react';
import ConfidencePill from './ConfidencePill';
import EvidenceList from './EvidenceList';
import SourceButton from './SourceButton';
import { INSIGHT_TYPES } from '../utils/insightTypes';

function TypeTag({ type }) {
  const { label, icon: Icon, className } = INSIGHT_TYPES[type];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}>
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}

function Side({ label, claim, quote, onOpenSource }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <p className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">{label}</p>
      <p className="mt-1.5 text-sm text-slate-800">{claim.text}</p>
      {quote && (
        <blockquote className="mt-2 flex gap-2 text-sm text-slate-600 italic">
          <Quote className="mt-0.5 size-3.5 shrink-0 text-slate-400" aria-hidden="true" />
          {quote}
        </blockquote>
      )}
      <div className="mt-2">
        <SourceButton
          name={claim.filename}
          page={claim.pageNumber}
          onClick={() => onOpenSource(claim.documentId, quote)}
        />
      </div>
    </div>
  );
}

/** One AI insight with the evidence behind it. */
export default function InsightCard({ insight, onOpenSource }) {
  const { type, title, description, confidence, evidence, details } = insight;
  const isContradiction = type === 'contradiction' && details?.claimA;

  return (
    <article className="card overflow-hidden">
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <TypeTag type={type} />
          <ConfidencePill score={confidence} />
        </div>
        <h3 className="mt-3 font-semibold leading-snug text-slate-900">{title}</h3>
        {description && <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{description}</p>}

        {isContradiction && (
          <>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <Side label="One source reports" claim={details.claimA} quote={evidence[0]?.quote} onOpenSource={onOpenSource} />
              <Side label="Another source reports" claim={details.claimB} quote={evidence[1]?.quote} onOpenSource={onOpenSource} />
            </div>
            {details.possibleExplanation && (
              <p className="mt-3 flex gap-2 rounded-lg bg-brand-50/70 px-3 py-2.5 text-sm text-slate-700">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden="true" />
                <span>
                  <span className="font-medium text-slate-900">Possible explanation (AI interpretation): </span>
                  {details.possibleExplanation}
                </span>
              </p>
            )}
          </>
        )}

        {type === 'research_gap' && details?.rationale && (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
            <span className="font-medium text-slate-900">Why this is a gap: </span>
            {details.rationale}
          </p>
        )}
      </div>

      {!isContradiction && evidence.length > 0 && (
        <section className="border-t border-slate-100 px-5 py-4 sm:px-6">
          <h4 className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
            {type === 'research_gap' || type === 'unanswered_question' ? 'What the sources do cover' : 'Evidence'} ·{' '}
            {evidence.length}
          </h4>
          <div className="mt-2">
            <EvidenceList items={evidence} onOpenSource={onOpenSource} />
          </div>
        </section>
      )}
    </article>
  );
}
