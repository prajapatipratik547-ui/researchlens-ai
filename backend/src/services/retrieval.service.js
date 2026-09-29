import { Document } from '../models/Document.js';
import { DocumentChunk } from '../models/DocumentChunk.js';
import { env } from '../config/env.js';

// ---------------------------------------------------------------------------
// Retrieval without a vector database.
//
// A research corpus in a hackathon project is small (tens to hundreds of
// chunks), so:
//   1. If every ready chunk fits in the context budget, send them all: the
//      model sees the whole corpus and nothing relevant can be missed.
//   2. Otherwise rank chunks with BM25 (classic keyword relevance) and take
//      the best ones that fit, capping how many come from any one document so
//      multi-source questions see multiple sources.
// ---------------------------------------------------------------------------

// Gemini's context is huge; Groq's free tier limits tokens per minute and
// local models have small windows, so they get a tighter budget.
export function contextBudgetChars() {
  return env.AI_PROVIDER === 'gemini' ? 60_000 : 16_000;
}

const STOPWORDS = new Set(
  `a about above after again against all am an and any are as at be because been before being below between both
  but by can could did do does doing down during each few for from further had has have having he her here hers
  him his how i if in into is it its itself just me more most my no nor not now of off on once only or other our
  ours out over own same she should so some such than that the their theirs them then there these they this those
  through to too under until up very was we were what when where which while who whom why will with would you your
  yours across among also based discussed discuss sources source study studies paper document documents mention
  mentioned say says said tell according`.split(/\s+/),
);

/** A light English stemmer: enough to match "limitation" with "limitations". */
export function stem(word) {
  if (word.length <= 4) return word;
  for (const [suffix, replacement] of [
    ['ational', 'ate'],
    ['ization', 'ize'],
    ['iveness', 'ive'],
    ['fulness', 'ful'],
    ['ousness', 'ous'],
    ['ations', 'ate'],
    ['ation', 'ate'],
    ['ities', 'ity'],
    ['ings', ''],
    ['ing', ''],
    ['ies', 'y'],
    ['edly', ''],
    ['ed', ''],
    ['ly', ''],
    ['es', ''],
    ['s', ''],
  ]) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 3) {
      return word.slice(0, -suffix.length) + replacement;
    }
  }
  return word;
}

export function tokenize(text) {
  return (String(text).toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [])
    .filter((t) => t.length > 1 && !STOPWORDS.has(t))
    .map(stem);
}

/** BM25 scores for each chunk against the query terms. */
export function bm25Scores(chunkTexts, query, { k1 = 1.2, b = 0.75 } = {}) {
  const docs = chunkTexts.map(tokenize);
  const avgLength = docs.reduce((n, d) => n + d.length, 0) / Math.max(docs.length, 1) || 1;
  const terms = [...new Set(tokenize(query))];

  const docFreq = new Map(terms.map((t) => [t, docs.filter((d) => d.includes(t)).length]));
  return docs.map((tokens) => {
    const counts = new Map();
    for (const t of tokens) counts.set(t, (counts.get(t) ?? 0) + 1);
    let score = 0;
    for (const term of terms) {
      const tf = counts.get(term);
      if (!tf) continue;
      const df = docFreq.get(term);
      const idf = Math.log(1 + (docs.length - df + 0.5) / (df + 0.5));
      score += (idf * tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * tokens.length) / avgLength));
    }
    return score;
  });
}

/**
 * Picks chunks for a question within `budgetChars`.
 * @param {{ text: string, documentId: any }[]} chunks  all candidate chunks, in reading order
 * @returns {{ chunks: object[], strategy: 'full-corpus' | 'ranked' }}
 */
export function selectChunks(chunks, query, { budgetChars, perDocumentCap = 6, everyDocument = false } = {}) {
  const total = chunks.reduce((n, c) => n + c.text.length, 0);
  if (total <= budgetChars) return { chunks, strategy: 'full-corpus' };

  const scores = bm25Scores(chunks.map((c) => c.text), query);
  const ranked = chunks
    .map((chunk, i) => ({ chunk, score: scores[i], order: i }))
    .sort((a, b) => b.score - a.score || a.order - b.order);

  // With no keyword overlap at all, spread the budget across documents so
  // the model can still judge (and usually report insufficient evidence).
  if (!ranked.length || ranked[0].score === 0) {
    ranked.sort((a, b) => a.chunk.chunkIndex - b.chunk.chunkIndex || a.order - b.order);
  }

  const picked = new Set();
  const perDoc = new Map();
  let used = 0;
  const take = (entry, ignoreCap) => {
    const docKey = String(entry.chunk.documentId);
    if (picked.has(entry)) return;
    if (!ignoreCap && (perDoc.get(docKey) ?? 0) >= perDocumentCap) return;
    if (used + entry.chunk.text.length > budgetChars) return;
    picked.add(entry);
    perDoc.set(docKey, (perDoc.get(docKey) ?? 0) + 1);
    used += entry.chunk.text.length;
  };
  // Whole-corpus work first gives every document its best chunk.
  if (everyDocument) {
    const seenDocs = new Set();
    for (const entry of ranked) {
      const docKey = String(entry.chunk.documentId);
      if (seenDocs.has(docKey)) continue;
      seenDocs.add(docKey);
      take(entry, false);
    }
  }
  for (const entry of ranked) take(entry, false);
  // Room left after the per-document cap: fill with the next best anyway.
  for (const entry of ranked) take(entry, true);

  // Present in reading order, which helps the model follow each document.
  const ordered = [...picked].sort((a, b) => a.order - b.order);
  return { chunks: ordered.map((p) => p.chunk), strategy: 'ranked' };
}

// A project's ready documents (oldest first) and all their chunks in reading order.
async function loadCorpus(projectId) {
  const docs = await Document.find({ projectId, processingStatus: 'ready' })
    .select('filename')
    .sort({ createdAt: 1, _id: 1 });
  if (!docs.length) return { docs, all: [] };

  const order = new Map(docs.map((d, i) => [String(d._id), i]));
  const all = await DocumentChunk.find({ documentId: { $in: docs.map((d) => d._id) } }).lean();
  all.sort(
    (a, b) =>
      order.get(String(a.documentId)) - order.get(String(b.documentId)) || a.chunkIndex - b.chunkIndex,
  );
  return { docs, all };
}

function withFilenames(chunks, docs) {
  const filenames = new Map(docs.map((d) => [String(d._id), d.filename]));
  return chunks.map((c) => ({ ...c, filename: filenames.get(String(c.documentId)) }));
}

/**
 * Loads a project's ready chunks with their file names and selects those
 * relevant to `query`.
 */
export async function retrieveForQuestion(projectId, query) {
  const { docs, all } = await loadCorpus(projectId);
  if (!docs.length) return { chunks: [], documents: [], strategy: 'empty' };

  const { chunks, strategy } = selectChunks(all, query, { budgetChars: contextBudgetChars() });
  return { chunks: withFilenames(chunks, docs), documents: docs, strategy };
}

/**
 * Chunks for a whole-corpus analysis. Unlike a question, an analysis must
 * hear from every source, so when the corpus is too big the budget is split
 * evenly between documents (the most relevant chunks of each, ranked against
 * the research question) instead of going to the best-matching few.
 */
export async function retrieveForAnalysis(projectId, researchQuestion) {
  const { docs, all } = await loadCorpus(projectId);
  if (!docs.length) return { chunks: [], documents: [], strategy: 'empty' };

  const budgetChars = contextBudgetChars();
  const averageChunk = all.reduce((n, c) => n + c.text.length, 0) / Math.max(all.length, 1) || 1;
  const perDocumentCap = Math.max(1, Math.floor(budgetChars / averageChunk / docs.length));

  const { chunks, strategy } = selectChunks(all, researchQuestion, {
    budgetChars,
    perDocumentCap,
    everyDocument: true,
  });
  return { chunks: withFilenames(chunks, docs), documents: docs, strategy };
}
