import { describe, it, expect } from 'vitest';
import { bm25Scores, selectChunks, stem, tokenize } from '../src/services/retrieval.service.js';

describe('tokenize and stem', () => {
  it('drops stopwords and matches simple word forms', () => {
    expect(tokenize('What are the limitations discussed across the sources?')).toEqual([stem('limitations')]);
    expect(stem('limitations')).toBe(stem('limitation'));
    expect(stem('studies')).toBe('study');
    expect(stem('reviewing')).toBe(stem('reviewed'));
  });
});

describe('bm25Scores', () => {
  it('ranks the chunk that is about the query highest', () => {
    const scores = bm25Scores(
      [
        'Developers reported higher satisfaction with AI tools.',
        'The main limitation was the short four-week duration. Another limitation was sample size.',
        'Code review time increased for generated code.',
      ],
      'What limitations did the studies have?',
    );
    expect(scores.indexOf(Math.max(...scores))).toBe(1);
    expect(scores[0]).toBe(0);
  });
});

const chunk = (documentId, chunkIndex, text) => ({ documentId, chunkIndex, text });

describe('selectChunks', () => {
  it('sends the whole corpus when it fits the budget', () => {
    const chunks = [chunk('a', 0, 'alpha text'), chunk('b', 0, 'beta text')];
    expect(selectChunks(chunks, 'anything', { budgetChars: 1000 })).toEqual({ chunks, strategy: 'full-corpus' });
  });

  it('ranks, respects the budget and keeps reading order when the corpus is large', () => {
    const filler = (n) => `Unrelated background paragraph number ${n}. `.repeat(8);
    const chunks = [
      chunk('a', 0, filler(1)),
      chunk('a', 1, 'Security vulnerabilities appeared more often in AI generated code. ' + filler(2)),
      chunk('b', 0, filler(3)),
      chunk('b', 1, 'Security review caught vulnerabilities before release. ' + filler(4)),
      chunk('c', 0, filler(5)),
    ];
    const budget = chunks[1].text.length + chunks[3].text.length + 10;
    const { chunks: picked, strategy } = selectChunks(chunks, 'security vulnerabilities', { budgetChars: budget });

    expect(strategy).toBe('ranked');
    expect(picked).toEqual([chunks[1], chunks[3]]);
  });

  it('caps chunks per document so several sources are represented', () => {
    const relevant = (doc, i) => chunk(doc, i, `Productivity gains measured in trial ${doc}${i}. `.repeat(3));
    const chunks = [
      ...Array.from({ length: 6 }, (_, i) => relevant('a', i)),
      relevant('b', 0),
      chunk('c', 0, 'Nothing about the topic here at all. '.repeat(20)),
    ];
    const size = chunks[0].text.length;
    const { chunks: picked } = selectChunks(chunks, 'productivity gains', {
      budgetChars: size * 3 + 5,
      perDocumentCap: 2,
    });
    const docs = picked.map((c) => c.documentId);
    expect(docs.filter((d) => d === 'a')).toHaveLength(2);
    expect(docs).toContain('b');
  });

  it('spreads across documents when nothing matches the query', () => {
    const chunks = ['a', 'b', 'c'].flatMap((doc) =>
      [0, 1, 2].map((i) => chunk(doc, i, `Some text ${doc}${i}. `.repeat(10))),
    );
    const size = chunks[0].text.length;
    const { chunks: picked } = selectChunks(chunks, 'quantum chromodynamics', { budgetChars: size * 3 + 5 });
    expect(picked.map((c) => `${c.documentId}${c.chunkIndex}`)).toEqual(['a0', 'b0', 'c0']);
  });
});
