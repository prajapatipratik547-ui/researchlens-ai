import { describe, it, expect } from 'vitest';
import {
  detectFileType,
  extractDocument,
  ExtractionError,
} from '../src/services/extraction.service.js';
import { makeDocx, makePdf } from './helpers/fixtures.js';

describe('detectFileType', () => {
  const pdf = makePdf(['Hello world, this is a test.']);
  const docx = makeDocx(['Hello']);

  it('accepts real PDF, DOCX and TXT files', () => {
    expect(detectFileType('a.pdf', pdf)).toEqual({ fileType: 'pdf' });
    expect(detectFileType('A.PDF', pdf)).toEqual({ fileType: 'pdf' });
    expect(detectFileType('b.docx', docx)).toEqual({ fileType: 'docx' });
    expect(detectFileType('c.txt', Buffer.from('plain text'))).toEqual({ fileType: 'txt' });
  });

  it('rejects unsupported extensions', () => {
    expect(detectFileType('virus.exe', pdf).error).toMatch(/Only PDF, DOCX and TXT/);
    expect(detectFileType('old.doc', docx).error).toMatch(/Only PDF, DOCX and TXT/);
    expect(detectFileType('noext', pdf).error).toMatch(/Only PDF, DOCX and TXT/);
  });

  it('rejects files whose contents do not match their extension', () => {
    expect(detectFileType('fake.pdf', Buffer.from('MZ\x90\x00 binary')).error).toBe('This file is not a valid PDF');
    expect(detectFileType('fake.docx', pdf).error).toMatch(/not a valid Word/);
    expect(detectFileType('fake.txt', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x00])).error).toMatch(
      /not a plain text/,
    );
  });

  it('rejects empty files', () => {
    expect(detectFileType('empty.txt', Buffer.alloc(0)).error).toBe('This file is empty');
  });
});

describe('extractDocument', () => {
  it('extracts PDF text page by page with page markers', async () => {
    const pdf = makePdf([
      'Developers completed tasks faster with an assistant.',
      'Code quality results were mixed across teams.',
    ]);
    const result = await extractDocument(pdf, 'pdf');

    expect(result.pageCount).toBe(2);
    expect(result.pages.map((p) => p.pageNumber)).toEqual([1, 2]);
    expect(result.pages[1].text).toContain('Code quality results were mixed');
    expect(result.text).toContain('--- Page 1 ---');
    expect(result.text).toContain('--- Page 2 ---');
    expect(result.wordCount).toBe(14);
  });

  it('extracts DOCX paragraphs without page numbers', async () => {
    const docx = makeDocx(['First paragraph about productivity.', 'Second & final <paragraph>.']);
    const result = await extractDocument(docx, 'docx');

    expect(result.pageCount).toBeNull();
    expect(result.pages).toEqual([
      { pageNumber: null, text: 'First paragraph about productivity.\n\nSecond & final <paragraph>.' },
    ]);
  });

  it('decodes UTF-8 text, strips a BOM, and falls back to Windows-1252', async () => {
    const utf8 = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('Café studies show résumé effects here.')]);
    expect((await extractDocument(utf8, 'txt')).text).toBe('Café studies show résumé effects here.');

    const cp1252 = Buffer.from('Caf\xe9 studies show r\xe9sum\xe9 effects here.', 'latin1');
    expect((await extractDocument(cp1252, 'txt')).text).toBe('Café studies show résumé effects here.');
  });

  it('reports a PDF with no text layer as unsupported', async () => {
    const blank = makePdf(['', '']);
    await expect(extractDocument(blank, 'pdf')).rejects.toThrow(/No readable text found/);
  });

  it('reports damaged files with a friendly ExtractionError', async () => {
    await expect(extractDocument(Buffer.from('%PDF-1.4 not really'), 'pdf')).rejects.toBeInstanceOf(
      ExtractionError,
    );
    await expect(extractDocument(Buffer.from('PK\x03\x04broken'), 'docx')).rejects.toThrow(
      /could not be read/,
    );
  });

  it('rejects text files with almost no words', async () => {
    await expect(extractDocument(Buffer.from('  hi  '), 'txt')).rejects.toThrow(/no.*readable text|does not contain/i);
  });
});
