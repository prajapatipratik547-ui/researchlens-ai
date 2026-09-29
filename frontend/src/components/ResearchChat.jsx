import { useEffect, useId, useRef, useState } from 'react';
import { Link, useOutletContext } from 'react-router';
import { AlertCircle, ArrowUp, Loader2, MessageSquareText, RotateCw, Sparkles, Upload } from 'lucide-react';
import AnswerCard from './AnswerCard';
import DocumentViewer from './DocumentViewer';
import EmptyState from './EmptyState';
import ErrorState from './ErrorState';
import LoadingState from './LoadingState';
import { useFetch } from '../hooks/useFetch';
import { aiApi, getErrorMessage, researchApi } from '../services/api';

const MAX_QUESTION = 1000;

const SUGGESTIONS = [
  'What are the major findings across the sources?',
  'What limitations do the sources discuss?',
  'Where do the sources disagree?',
];

function QuestionBubble({ children }) {
  return (
    <div className="flex justify-end">
      <p className="max-w-[85%] rounded-2xl rounded-br-md bg-brand-700 px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-white">
        {children}
      </p>
    </div>
  );
}

/** The AI Assistant section of a research workspace. */
export default function ResearchChat() {
  const { project } = useOutletContext();
  const inputId = useId();
  const endRef = useRef(null);
  const inputRef = useRef(null);

  const history = useFetch(`conversations:${project.id}`, () => researchApi.conversations(project.id));
  const ai = useFetch('ai-status', aiApi.status);

  const [added, setAdded] = useState([]); // answers received in this visit
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(null); // question being answered
  const [failed, setFailed] = useState(null); // { question, message }
  const [viewing, setViewing] = useState(null); // { documentId, quote }

  const conversations = [...(history.data ?? []), ...added];
  const hasSources = project.stats.sourceCount > 0;
  const aiReady = ai.data?.configured !== false; // assume ready until told otherwise
  const canAsk = hasSources && aiReady && !pending;

  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: 'end', behavior: 'smooth' });
  }, [conversations.length, pending, failed]);

  async function ask(question) {
    const q = question.trim();
    if (q.length < 3 || !canAsk) return;
    setFailed(null);
    setPending(q);
    setDraft('');
    try {
      const conversation = await researchApi.ask(project.id, q);
      setAdded((a) => [...a, conversation]);
    } catch (err) {
      setFailed({ question: q, message: getErrorMessage(err, 'The assistant could not answer. Please try again.') });
    } finally {
      setPending(null);
    }
  }

  if (!hasSources) {
    return (
      <div className="mx-auto max-w-3xl">
        <EmptyState
          icon={MessageSquareText}
          title="Add sources to start asking questions"
          description="The assistant answers only from this project’s sources, so it needs at least one ready document."
          action={
            <Link to={`/research/${project.id}/sources`} className="btn-primary">
              <Upload className="size-4" aria-hidden="true" />
              Go to sources
            </Link>
          }
        />
      </div>
    );
  }

  let thread;
  if (history.loading && !history.data) {
    thread = <LoadingState label="Loading conversation…" />;
  } else if (history.error) {
    thread = (
      <ErrorState title="Couldn’t load earlier questions" message={getErrorMessage(history.error)} onRetry={history.reload} />
    );
  } else if (!conversations.length && !pending && !failed) {
    thread = (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-10 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <Sparkles className="size-6" aria-hidden="true" />
        </div>
        <h3 className="mt-4 font-semibold text-slate-900">Ask anything about your sources</h3>
        <p className="mx-auto mt-1.5 max-w-md text-sm text-slate-600">
          Every answer cites the file and page it came from, and says so when the evidence isn’t there.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => ask(s)}
              disabled={!canAsk}
              className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-sm text-slate-700 hover:border-brand-300 hover:text-brand-800 disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    );
  } else {
    thread = (
      <ol className="space-y-6" aria-label="Conversation">
        {conversations.map((c) => (
          <li key={c.id} className="space-y-3">
            <QuestionBubble>{c.question}</QuestionBubble>
            <AnswerCard
              response={c.response}
              sources={c.sources}
              onOpenSource={(documentId, quote) => setViewing({ documentId, quote })}
            />
          </li>
        ))}
        {pending && (
          <li className="space-y-3" aria-live="polite">
            <QuestionBubble>{pending}</QuestionBubble>
            <div className="card flex items-center gap-3 px-5 py-4 text-sm text-slate-600">
              <Loader2 className="size-4 animate-spin text-brand-600" aria-hidden="true" />
              Reading your sources and checking citations…
            </div>
          </li>
        )}
        {failed && (
          <li className="space-y-3">
            <QuestionBubble>{failed.question}</QuestionBubble>
            <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-start gap-2 text-sm text-rose-800">
                <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {failed.message}
              </p>
              <button type="button" onClick={() => ask(failed.question)} className="btn-secondary shrink-0">
                <RotateCw className="size-4" aria-hidden="true" />
                Try again
              </button>
            </div>
          </li>
        )}
      </ol>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      {!aiReady && (
        <div role="status" className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          The AI service is not configured on the server, so questions can’t be answered right now.
        </div>
      )}

      {thread}
      <div ref={endRef} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(draft);
        }}
        className="sticky bottom-4 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg"
      >
        <label htmlFor={inputId} className="sr-only">
          Ask a question about your sources
        </label>
        <div className="flex items-end gap-2">
          <textarea
            id={inputId}
            ref={inputRef}
            rows={2}
            value={draft}
            maxLength={MAX_QUESTION}
            disabled={!aiReady}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                ask(draft);
              }
            }}
            placeholder="Ask about your sources, e.g. What limitations do the studies share?"
            className="min-h-[3rem] flex-1 resize-none border-0 bg-transparent px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-0 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!canAsk || draft.trim().length < 3}
            className="btn-primary size-10 shrink-0 p-0"
            aria-label="Ask"
          >
            {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ArrowUp className="size-4" aria-hidden="true" />}
          </button>
        </div>
        <p className="flex justify-between px-3 pt-1 pb-0.5 text-[11px] text-slate-400">
          <span>Answers use only this project’s sources · Enter to send, Shift+Enter for a new line</span>
          <span className="tabular-nums">{draft.length}/{MAX_QUESTION}</span>
        </p>
      </form>

      {viewing && (
        <DocumentViewer
          documentId={viewing.documentId}
          highlight={viewing.quote}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  );
}
