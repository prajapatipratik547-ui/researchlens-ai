import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { LIMITS, type AnswerEvidence, type Conversation } from '@synapse/shared';
import { useAsk, useConversations } from '../../hooks/useResearch';
import { toApiError } from '../../lib/errors';
import { formatDateTime } from '../../lib/format';
import { useWorkspace } from '../../components/workspace/context';
import { Button, ButtonLink } from '../../components/ui/Button';
import { Confidence, SourceCite, StatusPill } from '../../components/ui/Evidence';
import { FormError } from '../../components/ui/Field';
import { Spinner } from '../../components/ui/Spinner';
import { EmptyState, ErrorState, InfoNote, LoadingRegion, Skeleton } from '../../components/ui/States';

const SUGGESTIONS = [
  'What are the major limitations discussed across the sources?',
  'Where do the sources disagree, and why?',
  'What methods do the studies use?',
];

function Label({ children }: { children: ReactNode }) {
  return <p className="font-mono text-[10px] tracking-[0.18em] text-white/40 uppercase">{children}</p>;
}

function EvidenceRow({ item, onOpen }: { item: AnswerEvidence; onOpen: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="rounded-xl border border-white/8 bg-black/20 p-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <StatusPill status={item.support} compact />
        <p className="flex-1 text-[13.5px] leading-snug text-white/85">{item.claim}</p>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 sm:pl-[92px]">
        <SourceCite filename={item.sourceName} page={item.page} onOpen={onOpen} />
        {item.quote && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="text-[12px] text-white/45 hover:text-white/80"
          >
            {open ? 'Hide quote' : 'Show quote'}
          </button>
        )}
      </div>
      {open && (
        <blockquote className="mt-2 border-l-2 border-violet-300/40 pl-3 text-[13px] leading-relaxed text-white/60 italic sm:ml-[92px]">
          {item.quote}
        </blockquote>
      )}
    </li>
  );
}

function Answer({ c, openDocument }: { c: Conversation; openDocument: (id: string) => void }) {
  const r = c.response;
  const reduce = useReducedMotion();
  return (
    <motion.article
      initial={{ opacity: 0, y: reduce ? 0 : 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className="space-y-4"
    >
      <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-violet-500/20 px-4 py-3 text-[14px] text-white ring-1 ring-violet-300/20">
        {c.question}
      </div>

      <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-5">
        {r.insufficientEvidence ? (
          <InfoNote>
            <p className="font-medium text-white/90">{r.answer}</p>
            <p className="mt-1 text-white/55">
              The uploaded sources don’t cover this question. Try rephrasing, or add sources that address it.
            </p>
          </InfoNote>
        ) : (
          <div className="space-y-5">
            <section>
              <Label>Answer</Label>
              <div className="mt-2 space-y-3 text-[14.5px] leading-relaxed text-white/85">
                {r.answer.split(/\n\n+/).map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
              {r.keyFindings.length > 0 && (
                <ul className="mt-3 list-disc space-y-1 pl-5 text-[13.5px] text-white/70">
                  {r.keyFindings.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              )}
            </section>

            {r.evidence.length > 0 && (
              <section>
                <Label>Evidence</Label>
                <ul className="mt-2 space-y-2">
                  {r.evidence.map((e, i) => (
                    <EvidenceRow key={i} item={e} onOpen={() => openDocument(e.sourceId)} />
                  ))}
                </ul>
              </section>
            )}

            {c.sources.length > 0 && (
              <section>
                <Label>Sources</Label>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  {c.sources.map((s) => (
                    <SourceCite
                      key={`${s.documentId}-${s.pageNumber}`}
                      filename={s.filename}
                      page={s.pageNumber}
                      onOpen={() => openDocument(s.documentId)}
                    />
                  ))}
                </div>
              </section>
            )}

            <section className="flex flex-wrap items-center gap-3">
              <Label>Confidence</Label>
              <Confidence score={r.confidence} showPercent />
            </section>

            {r.limitations.length > 0 && (
              <section>
                <Label>Limitations</Label>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-[13px] text-white/55">
                  {r.limitations.map((l) => (
                    <li key={l}>{l}</li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
        <p className="mt-4 text-[11.5px] text-white/30">{formatDateTime(c.createdAt)} · AI interpretation of your sources</p>
      </div>
    </motion.article>
  );
}

function Thinking({ question }: { question: string }) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, []);
  return (
    <div className="space-y-4" role="status" aria-live="polite">
      <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-violet-500/20 px-4 py-3 text-[14px] text-white ring-1 ring-violet-300/20">
        {question}
      </div>
      <div className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-5 py-4 text-[13.5px] text-white/60">
        <Spinner className="size-4 text-violet-300" />
        Thinking… {seconds}s <span className="text-white/35">· answers usually take 3–15 seconds</span>
      </div>
    </div>
  );
}

export function AssistantTab() {
  const { project, openDocument } = useWorkspace();
  const conversations = useConversations(project.id);
  const ask = useAsk(project.id);
  const [question, setQuestion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const noSources = project.status === 'draft';

  const count = conversations.data?.length ?? 0;
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [count, ask.isPending]);

  const trimmed = question.trim();
  const tooShort = trimmed.length < LIMITS.question.min;
  const tooLong = trimmed.length > LIMITS.question.max;

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (tooShort || tooLong || ask.isPending) return;
    setError(null);
    ask.mutate(trimmed, {
      onSuccess: () => setQuestion(''),
      onError: (err) => {
        const apiErr = toApiError(err);
        setError(
          apiErr.code === 'NO_READY_SOURCES'
            ? 'No sources are ready yet. Upload one, or wait for processing to finish.'
            : apiErr.message,
        );
      },
    });
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      {conversations.isPending ? (
        <LoadingRegion label="Loading conversation">
          <Skeleton className="ml-auto h-12 w-2/3 rounded-2xl" />
          <Skeleton className="mt-4 h-56 rounded-2xl" />
        </LoadingRegion>
      ) : conversations.isError ? (
        <ErrorState error={conversations.error} onRetry={() => void conversations.refetch()} />
      ) : (
        <div className="space-y-10">
          {count === 0 && !ask.isPending && (
            noSources ? (
              <EmptyState
                title="No sources yet"
                body="The assistant answers only from your uploaded sources. Add at least one and wait until it’s ready."
                action={<ButtonLink to={`/research/${project.id}/sources`}>Upload sources</ButtonLink>}
              />
            ) : (
              <EmptyState
                title="Ask your sources anything"
                body="Every answer shows its evidence, the file and page it came from, and how confident it is."
                action={
                  <div className="flex flex-col gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setQuestion(s)}
                        className="rounded-xl border border-white/10 px-4 py-2 text-left text-[13px] text-white/70 hover:border-violet-300/40 hover:text-white"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                }
              />
            )
          )}
          {conversations.data.map((c) => (
            <Answer key={c.id} c={c} openDocument={openDocument} />
          ))}
          {ask.isPending && <Thinking question={ask.variables ?? trimmed} />}
          <div ref={endRef} />
        </div>
      )}

      <form onSubmit={submit} className="sticky bottom-4 mt-10 rounded-2xl border border-white/10 bg-ink-2/90 p-3 shadow-2xl backdrop-blur-xl">
        {error && (
          <div className="mb-3">
            <FormError>{error}</FormError>
          </div>
        )}
        <label htmlFor="ask" className="sr-only">
          Ask a question about your sources
        </label>
        <textarea
          id="ask"
          rows={2}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={onKeyDown}
          disabled={noSources}
          placeholder={noSources ? 'Upload a source to start asking questions' : 'Ask a question about your sources…'}
          className="w-full resize-none bg-transparent px-2 py-1 text-[14.5px] text-white outline-none placeholder:text-white/30 disabled:cursor-not-allowed"
        />
        <div className="flex items-center justify-between gap-3 px-2 pt-1">
          <span className={`font-mono text-[11px] tabular-nums ${tooLong ? 'text-contradict' : 'text-white/30'}`}>
            {trimmed.length}/{LIMITS.question.max}
          </span>
          <Button type="submit" size="sm" loading={ask.isPending} disabled={noSources || tooShort || tooLong}>
            Ask
          </Button>
        </div>
      </form>
    </div>
  );
}
