// Splits extracted document text into overlapping chunks for retrieval.
//
// Chunks are built from paragraphs where possible, so related sentences stay
// together. A paragraph longer than `maxChars` is split at sentence
// boundaries, and a sentence longer than that is split between words. Each
// chunk repeats the last sentence(s) of the previous one (`overlapChars`), so
// a fact that straddles a boundary is still retrievable in one piece.

export const CHUNK_DEFAULTS = Object.freeze({
  targetChars: 1200,
  maxChars: 1600,
  overlapChars: 200,
});

const sentenceSegmenter = new Intl.Segmenter('en', { granularity: 'sentence' });

/** Cleans extraction artefacts while keeping paragraph breaks. */
export function normalizeText(text) {
  return String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/­/g, '') // soft hyphens
    .replace(/(\p{L})-\n(\p{Ll})/gu, '$1$2') // words hyphenated across a line break
    .replace(/[^\S\n]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function splitParagraphs(text) {
  // Blank lines separate paragraphs; single newlines are line wraps.
  return text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\n/g, ' ').trim())
    .filter(Boolean);
}

function splitSentences(text) {
  return Array.from(sentenceSegmenter.segment(text), (s) => s.segment.trim()).filter(Boolean);
}

function splitByWords(text, maxChars) {
  const pieces = [];
  let current = '';
  for (const word of text.split(' ')) {
    // A single "word" longer than the limit (a URL, a data dump) is sliced.
    for (let i = 0; i < word.length; i += maxChars) {
      const part = word.slice(i, i + maxChars);
      if (current && current.length + 1 + part.length > maxChars) {
        pieces.push(current);
        current = part;
      } else {
        current = current ? `${current} ${part}` : part;
      }
    }
  }
  if (current) pieces.push(current);
  return pieces;
}

// Units are the smallest pieces a chunk is assembled from: whole paragraphs,
// or sentences (or word runs) of paragraphs too long to keep whole.
function toUnits(pages, maxChars) {
  const units = [];
  for (const { pageNumber = null, text } of pages) {
    for (const paragraph of splitParagraphs(normalizeText(text))) {
      if (paragraph.length <= maxChars) {
        units.push({ text: paragraph, pageNumber, newParagraph: true });
        continue;
      }
      splitSentences(paragraph).forEach((sentence, i) => {
        const parts = sentence.length <= maxChars ? [sentence] : splitByWords(sentence, maxChars);
        parts.forEach((part, j) =>
          units.push({ text: part, pageNumber, newParagraph: i === 0 && j === 0 }),
        );
      });
    }
  }
  return units;
}

// Trailing sentences of a chunk, up to `overlapChars`, to seed the next one.
function overlapTail(units, overlapChars) {
  if (!overlapChars || !units.length) return [];
  const last = units.at(-1);
  const sentences = splitSentences(last.text);
  const tail = [];
  let length = 0;
  for (let i = sentences.length - 1; i >= 0; i -= 1) {
    const added = sentences[i].length + (tail.length ? 1 : 0);
    if (length + added > overlapChars) break;
    tail.unshift(sentences[i]);
    length += added;
  }
  if (!tail.length) return [];
  return [{ text: tail.join(' '), pageNumber: last.pageNumber, newParagraph: false, overlap: true }];
}

const joinUnits = (units) =>
  units.map((u, i) => (i === 0 ? u.text : `${u.newParagraph ? '\n\n' : ' '}${u.text}`)).join('');

// Character offsets in the joined text where each new page begins, so a
// quote found at offset N can be attributed to the right page.
function pageStartsOf(units) {
  const starts = [];
  let offset = 0;
  units.forEach((u, i) => {
    if (i > 0) offset += u.newParagraph ? 2 : 1;
    if (u.pageNumber !== null && starts.at(-1)?.pageNumber !== u.pageNumber) {
      starts.push({ offset, pageNumber: u.pageNumber });
    }
    offset += u.text.length;
  });
  return starts;
}

/** The page containing character `offset` of a chunk (falls back to its start page). */
export function pageAtOffset(chunk, offset) {
  const starts = chunk.metadata?.pageStarts;
  if (!starts?.length) return chunk.pageNumber ?? null;
  let page = starts[0].pageNumber;
  for (const start of starts) {
    if (start.offset <= offset) page = start.pageNumber;
    else break;
  }
  return page;
}

/**
 * @param {{ pageNumber: number|null, text: string }[]} pages
 * @returns {{ chunkIndex: number, text: string, pageNumber: number|null,
 *             metadata: { pageEnd: number|null, charCount: number,
 *                         pageStarts: { offset: number, pageNumber: number }[] } }[]}
 */
export function chunkPages(pages, options = {}) {
  const { targetChars, maxChars, overlapChars } = { ...CHUNK_DEFAULTS, ...options };
  if (targetChars > maxChars) throw new Error('targetChars must not exceed maxChars');

  const chunks = [];
  let current = [];

  const flush = () => {
    if (!current.some((u) => !u.overlap)) return;
    const text = joinUnits(current);
    chunks.push({
      chunkIndex: chunks.length,
      text,
      pageNumber: current[0].pageNumber,
      metadata: {
        pageEnd: current.at(-1).pageNumber,
        charCount: text.length,
        pageStarts: pageStartsOf(current),
      },
    });
    current = overlapTail(current, overlapChars);
  };

  for (const unit of toUnits(pages, maxChars)) {
    const length = current.length ? joinUnits(current).length + 1 : 0;
    if (current.some((u) => !u.overlap) && length + unit.text.length > targetChars) flush();
    // Drop carried-over overlap if it would push this chunk past the hard limit.
    const onlyOverlap = current.length && current.every((u) => u.overlap);
    if (onlyOverlap && joinUnits(current).length + 2 + unit.text.length > maxChars) current = [];
    current.push(unit);
  }
  flush();

  return chunks;
}
