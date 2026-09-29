import { describe, it, expect } from 'vitest';
import {
  chunkPages,
  normalizeText,
  pageAtOffset,
  CHUNK_DEFAULTS,
} from '../src/services/chunking.service.js';

const sentence = (i) => `Sentence number ${i} describes a finding about developer productivity.`;
const paragraph = (from, count) =>
  Array.from({ length: count }, (_, k) => sentence(from + k)).join(' ');

describe('normalizeText', () => {
  it('joins words hyphenated across lines and collapses whitespace', () => {
    expect(normalizeText('produc-\ntivity  gains\t\there')).toBe('productivity gains here');
  });

  it('keeps paragraph breaks but limits them to one blank line', () => {
    expect(normalizeText('First.\n\n\n\nSecond.\r\nwrapped')).toBe('First.\n\nSecond.\nwrapped');
  });
});

describe('chunkPages', () => {
  it('returns no chunks for empty input', () => {
    expect(chunkPages([])).toEqual([]);
    expect(chunkPages([{ pageNumber: 1, text: '   \n\n ' }])).toEqual([]);
  });

  it('keeps a short document in one chunk', () => {
    const chunks = chunkPages([{ pageNumber: 1, text: 'Short paragraph.\n\nAnother one.' }]);
    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({
      chunkIndex: 0,
      text: 'Short paragraph.\n\nAnother one.',
      pageNumber: 1,
      metadata: { pageEnd: 1 },
    });
  });

  it('never splits a paragraph that fits, and never exceeds maxChars', () => {
    const paragraphs = Array.from({ length: 12 }, (_, i) => paragraph(i * 10, 6));
    const chunks = chunkPages([{ pageNumber: 1, text: paragraphs.join('\n\n') }]);

    expect(chunks.length).toBeGreaterThan(3);
    for (const chunk of chunks) {
      expect(chunk.text.length).toBeLessThanOrEqual(CHUNK_DEFAULTS.maxChars);
      expect(chunk.metadata.charCount).toBe(chunk.text.length);
    }
    // Every paragraph appears intact in at least one chunk.
    for (const p of paragraphs) {
      expect(chunks.some((c) => c.text.includes(p))).toBe(true);
    }
  });

  it('overlaps consecutive chunks by their trailing sentences', () => {
    const text = paragraph(0, 80); // one very long paragraph -> sentence units
    const chunks = chunkPages([{ pageNumber: 1, text }]);

    expect(chunks.length).toBeGreaterThan(2);
    for (let i = 1; i < chunks.length; i += 1) {
      const previousLastSentence = chunks[i - 1].text.split(/(?<=\.)\s+/).at(-1);
      expect(chunks[i].text.startsWith(previousLastSentence)).toBe(true);
    }
  });

  it('can disable overlap', () => {
    const chunks = chunkPages([{ pageNumber: 1, text: paragraph(0, 80) }], { overlapChars: 0 });
    const joined = chunks.map((c) => c.text).join(' ');
    expect(joined).toBe(paragraph(0, 80));
  });

  it('records the start and end page of each chunk', () => {
    const pages = [1, 2, 3].map((n) => ({ pageNumber: n, text: paragraph(n * 100, 8) }));
    const chunks = chunkPages(pages);

    expect(chunks[0].pageNumber).toBe(1);
    expect(chunks.at(-1).metadata.pageEnd).toBe(3);
    for (const chunk of chunks) {
      expect(chunk.metadata.pageEnd).toBeGreaterThanOrEqual(chunk.pageNumber);
    }
    // Text from page 3 is attributed to a chunk that covers page 3.
    const page3 = chunks.find((c) => c.text.includes(sentence(300)));
    expect(page3.metadata.pageEnd).toBe(3);
  });

  it('records where each page starts inside a chunk, so quotes map to the right page', () => {
    const chunks = chunkPages([
      { pageNumber: 4, text: 'Findings on page four.' },
      { pageNumber: 5, text: 'Limitations on page five.' },
    ]);
    expect(chunks).toHaveLength(1);
    const [chunk] = chunks;
    expect(chunk.metadata.pageStarts).toEqual([
      { offset: 0, pageNumber: 4 },
      { offset: chunk.text.indexOf('Limitations'), pageNumber: 5 },
    ]);
    expect(pageAtOffset(chunk, chunk.text.indexOf('Findings'))).toBe(4);
    expect(pageAtOffset(chunk, chunk.text.indexOf('page five'))).toBe(5);
    // Chunks stored before page offsets existed fall back to their start page.
    expect(pageAtOffset({ pageNumber: 7, metadata: {} }, 100)).toBe(7);
  });

  it('keeps null page numbers for formats without pages', () => {
    const chunks = chunkPages([{ pageNumber: null, text: paragraph(0, 40) }]);
    expect(chunks.every((c) => c.pageNumber === null && c.metadata.pageEnd === null)).toBe(true);
  });

  it('splits text with no sentence breaks between words, and slices giant tokens', () => {
    const words = Array.from({ length: 900 }, (_, i) => `word${i}`).join(' ');
    const token = 'x'.repeat(5000);
    const chunks = chunkPages([{ pageNumber: 1, text: `${words}\n\n${token}` }]);

    for (const chunk of chunks) expect(chunk.text.length).toBeLessThanOrEqual(CHUNK_DEFAULTS.maxChars);
    expect(chunks.map((c) => c.text).join('')).toContain('word899');
    expect(chunks.map((c) => c.text).join('').split('x').length - 1).toBeGreaterThanOrEqual(5000);
  });

  it('numbers chunks consecutively from zero', () => {
    const chunks = chunkPages([{ pageNumber: 1, text: paragraph(0, 100) }]);
    expect(chunks.map((c) => c.chunkIndex)).toEqual(chunks.map((_, i) => i));
  });
});
