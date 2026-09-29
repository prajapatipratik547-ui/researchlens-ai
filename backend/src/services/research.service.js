import { Conversation } from '../models/Conversation.js';
import { Document } from '../models/Document.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { confidenceCap, resolveCitation, stripSourceIds } from './citations.service.js';
import { generateJSON } from './llm.service.js';
import { retrieveForQuestion } from './retrieval.service.js';
import { buildQAPrompt, INSUFFICIENT_EVIDENCE_ANSWER } from './prompts/qa.prompt.js';

export { findQuote } from './citations.service.js';

const HISTORY_TURNS = 3;

export async function requireReadySources(projectId) {
  if (!(await Document.exists({ projectId, processingStatus: 'ready' }))) {
    throw new ApiError(409, 'Add at least one source and wait until it is ready.', {
      code: 'NO_READY_SOURCES',
    });
  }
}

// ---------------------------------------------------------------------------
// Grounding checks on the model's reply
// ---------------------------------------------------------------------------

/**
 * Turns the model's reply into the API response, enforcing grounding:
 * - evidence citing an id we never gave the model is dropped,
 * - file name and page come from the chunk, never from the model,
 * - a quote that is not actually in the cited source is removed,
 * - an answer left with no valid evidence becomes "insufficient evidence",
 * - confidence is capped by how much independent evidence backs it.
 */
export function groundReply(reply, sourcesById) {
  const evidence = [];
  const seen = new Set();
  let unknownSources = 0;
  let unverifiedQuotes = 0;

  for (const item of reply.evidence) {
    const ref = resolveCitation(item.source, item.quote, sourcesById);
    if (!ref) {
      unknownSources += 1;
      continue;
    }
    if (item.quote && !ref.quote) unverifiedQuotes += 1;

    const key = `${ref.documentId}|${item.claim.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    evidence.push({
      claim: item.claim,
      sourceId: ref.documentId,
      sourceName: ref.filename,
      page: ref.pageNumber,
      quote: ref.quote,
      support: item.support,
    });
  }

  if (unknownSources || unverifiedQuotes) {
    logger.warn('Grounding check removed citations', { unknownSources, unverifiedQuotes });
  }

  const limitations = reply.limitations.map(stripSourceIds).filter(Boolean);

  if (reply.insufficientEvidence || !evidence.length) {
    return {
      answer: INSUFFICIENT_EVIDENCE_ANSWER,
      keyFindings: [],
      evidence: [],
      confidence: 0,
      limitations: limitations.length
        ? limitations
        : ['The uploaded sources do not contain evidence that answers this question.'],
      insufficientEvidence: true,
    };
  }

  const cap = confidenceCap(
    new Set(evidence.map((e) => e.sourceId)).size,
    evidence.every((e) => e.quote),
  );

  return {
    answer: stripSourceIds(reply.answer),
    keyFindings: reply.keyFindings.map(stripSourceIds).filter(Boolean).slice(0, 5),
    evidence,
    confidence: Math.round(Math.min(reply.confidence, cap)),
    limitations,
    insufficientEvidence: false,
  };
}

function citedSources(evidence) {
  const seen = new Map();
  for (const e of evidence) {
    const key = `${e.sourceId}|${e.page ?? ''}`;
    if (!seen.has(key)) seen.set(key, { documentId: e.sourceId, filename: e.sourceName, pageNumber: e.page });
  }
  return [...seen.values()];
}

// ---------------------------------------------------------------------------

export async function askQuestion(project, userId, question) {
  await requireReadySources(project._id);

  const [{ chunks, strategy }, recent] = await Promise.all([
    retrieveForQuestion(project._id, question),
    Conversation.find({ projectId: project._id }).sort({ createdAt: -1 }).limit(HISTORY_TURNS).lean(),
  ]);

  const sources = chunks.map((chunk, i) => ({ ...chunk, id: `S${i + 1}` }));
  const sourcesById = new Map(sources.map((s) => [s.id, s]));

  const reply = await generateJSON(
    buildQAPrompt({
      researchQuestion: project.researchQuestion,
      question,
      history: recent.reverse().map((c) => ({ question: c.question, answer: c.response?.answer ?? '' })),
      sources,
    }),
  );

  const response = groundReply(reply, sourcesById);
  logger.info('Question answered', {
    projectId: String(project._id),
    strategy,
    chunks: sources.length,
    evidence: response.evidence.length,
    insufficient: response.insufficientEvidence,
  });

  return Conversation.create({
    projectId: project._id,
    userId,
    question,
    response,
    sources: citedSources(response.evidence),
  });
}

export function listConversations(projectId) {
  return Conversation.find({ projectId }).sort({ createdAt: 1, _id: 1 }).limit(200);
}
