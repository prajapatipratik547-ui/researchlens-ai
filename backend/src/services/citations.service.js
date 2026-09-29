import { pageAtOffset } from './chunking.service.js';

// ---------------------------------------------------------------------------
// Citation checks shared by every AI feature (Q&A, analysis, brief). The model
// cites excerpts by id (S1, S2…); these helpers turn an id + quote into a
// verified reference, or reject it.
// ---------------------------------------------------------------------------

// Lower-cased, punctuation-free, single-spaced, for quote matching that
// survives curly quotes, hyphenation and line wraps.
function normalizeWithMap(value) {
  let out = '';
  const map = []; // map[i] = index in the original string of out[i]
  let lastWasSpace = true;
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i].toLowerCase();
    if (/[\p{L}\p{N}]/u.test(ch)) {
      out += ch;
      map.push(i);
      lastWasSpace = false;
    } else if (!lastWasSpace) {
      out += ' ';
      map.push(i);
      lastWasSpace = true;
    }
  }
  return { text: out.trimEnd(), map };
}

/** Where `quote` occurs in `sourceText` (fuzzy on punctuation/case), or -1. */
export function findQuote(sourceText, quote) {
  const q = normalizeWithMap(quote).text.trim();
  if (q.length < 8) return -1;
  const { text, map } = normalizeWithMap(sourceText);
  const at = text.indexOf(q);
  return at === -1 ? -1 : map[at];
}

/** Removes "(S1)", "[S1, S2]" style ids from text shown to users. */
export const stripSourceIds = (value) =>
  String(value ?? '')
    .replace(/\s*[([]\s*S\d+(?:\s*[,;]\s*S\d+)*\s*[)\]]/g, '')
    .replace(/[^\S\n]{2,}/g, ' ')
    .trim();

/**
 * Resolves a model citation against the excerpts it was given.
 * File name and page always come from the stored chunk, never from the model;
 * a quote that is not really in the excerpt is dropped.
 *
 * @returns {{ chunk: object, documentId: string, filename: string,
 *             pageNumber: number|null, quote: string } | null}  null for an unknown id
 */
export function resolveCitation(sourceId, quote, sourcesById) {
  const chunk = sourcesById.get(String(sourceId ?? '').trim().toUpperCase());
  if (!chunk) return null;
  const at = quote ? findQuote(chunk.text, quote) : -1;
  return {
    chunk,
    documentId: String(chunk.documentId),
    filename: chunk.filename,
    pageNumber: at === -1 ? (chunk.pageNumber ?? null) : pageAtOffset(chunk, at),
    quote: at === -1 ? '' : quote,
  };
}

/**
 * The most confidence a set of evidence can justify: one source can only
 * justify so much, and unverified quotes cost the bonus.
 */
export function confidenceCap(distinctSources, allQuotesVerified) {
  return Math.min(100, 55 + 10 * Math.min(distinctSources, 3) + (allQuotesVerified ? 10 : 0));
}
