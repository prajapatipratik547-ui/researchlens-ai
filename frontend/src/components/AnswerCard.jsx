import { AlertTriangle, Info } from 'lucide-react';
import EvidenceList from './EvidenceList';
import SourceButton from './SourceButton';
import { confidenceLevel } from '../utils/confidence';

function Section({ title, children }) {
  return (
    <section className="border-t border-slate-100 px-5 py-4 sm:px-6">
      <h4 className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">{title}</h4>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Confidence({ score }) {
  const { label, bar, text } = confidenceLevel(score);
  return (
    <div className="flex items-center gap-3">
      <span className="text-2xl font-semibold tabular-nums text-slate-900">{score}%</span>
      <div className="min-w-0 flex-1">
        <div
          className="h-2 overflow-hidden rounded-full bg-slate-100"
          role="meter"
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Confidence"
        >
          <div className={`h-full rounded-full ${bar}`} style={{ width: `${score}%` }} />
        </div>
        <p className={`mt-1 text-xs font-medium ${text}`}>{label} confidence · based on the cited evidence</p>
      </div>
    </div>
  );
}

/** One AI answer, laid out so evidence is always visible next to the claim. */
export default function AnswerCard({ response, sources, onOpenSource }) {
  if (response.insufficientEvidence) {
    return (
      <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
        <div className="flex gap-3">
          <Info className="mt-0.5 size-5 shrink-0 text-slate-500" aria-hidden="true" />
          <div>
            <p className="font-medium text-slate-900">{response.answer}</p>
            {response.limitations.length > 0 && (
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                {response.limitations.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-slate-500">
              ResearchLens only answers from your uploaded sources. Add sources that cover this topic, or rephrase the question.
            </p>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="card overflow-hidden">
      <section className="px-5 py-4 sm:px-6">
        <h4 className="text-[11px] font-semibold tracking-wider text-brand-700 uppercase">Answer</h4>
        <div className="mt-2 space-y-3 leading-relaxed text-slate-800">
          {response.answer.split(/\n\s*\n/).map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>
        {response.keyFindings.length > 0 && (
          <ul className="mt-4 space-y-1.5 text-sm text-slate-700">
            {response.keyFindings.map((f) => (
              <li key={f} className="flex gap-2">
                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden="true" />
                {f}
              </li>
            ))}
          </ul>
        )}
      </section>

      <Section title={`Evidence · ${response.evidence.length}`}>
        <EvidenceList
          items={response.evidence.map((e) => ({
            claim: e.claim,
            documentId: e.sourceId,
            filename: e.sourceName,
            pageNumber: e.page,
            quote: e.quote,
            support: e.support,
          }))}
          onOpenSource={onOpenSource}
        />
      </Section>

      <Section title="Sources">
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {sources.map((s) => (
            <SourceButton
              key={`${s.documentId}-${s.pageNumber}`}
              name={s.filename}
              page={s.pageNumber}
              onClick={() => onOpenSource(s.documentId, '')}
            />
          ))}
        </div>
      </Section>

      <Section title="Confidence">
        <Confidence score={response.confidence} />
      </Section>

      {response.limitations.length > 0 && (
        <Section title="Limitations">
          <ul className="space-y-1.5 text-sm text-slate-700">
            {response.limitations.map((l) => (
              <li key={l} className="flex gap-2">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" aria-hidden="true" />
                {l}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </article>
  );
}
