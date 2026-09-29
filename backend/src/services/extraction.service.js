import path from 'node:path';
import { extractText as extractPdfText, getDocumentProxy } from 'unpdf';
import mammoth from 'mammoth';
import { normalizeText } from './chunking.service.js';

/** A file we understood the type of but could not get usable text from. */
export class ExtractionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ExtractionError';
  }
}

export const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.txt'];

const PDF_MAGIC = Buffer.from('%PDF-');
const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);

/**
 * Works out the file type from the extension AND the file's first bytes, so
 * a renamed executable or image is rejected even with a .pdf name.
 * Returns { fileType } or { error } with a user-facing reason.
 */
export function detectFileType(filename, buffer) {
  const ext = path.extname(filename).toLowerCase();
  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    return { error: 'Only PDF, DOCX and TXT files are supported' };
  }
  if (!buffer?.length) return { error: 'This file is empty' };

  if (ext === '.pdf') {
    return buffer.subarray(0, 1024).includes(PDF_MAGIC)
      ? { fileType: 'pdf' }
      : { error: 'This file is not a valid PDF' };
  }
  if (ext === '.docx') {
    return buffer.subarray(0, 4).equals(ZIP_MAGIC)
      ? { fileType: 'docx' }
      : { error: 'This file is not a valid Word (.docx) document' };
  }
  // Text files must not contain NUL bytes, which only binary files have.
  return buffer.subarray(0, 8192).includes(0)
    ? { error: 'This file is not a plain text file' }
    : { fileType: 'txt' };
}

async function extractPdf(buffer) {
  let pdf;
  try {
    pdf = await getDocumentProxy(new Uint8Array(buffer), { verbosity: 0 });
  } catch (err) {
    if (err?.name === 'PasswordException') {
      throw new ExtractionError('This PDF is password-protected. Remove the password and upload it again.');
    }
    throw new ExtractionError('This PDF could not be read. It may be damaged.');
  }
  const { totalPages, text } = await extractPdfText(pdf, { mergePages: false });
  return {
    pageCount: totalPages,
    pages: text.map((pageText, i) => ({ pageNumber: i + 1, text: pageText })),
  };
}

async function extractDocx(buffer) {
  try {
    const { value } = await mammoth.extractRawText({ buffer });
    // Word files have no fixed pages; page numbers depend on the viewer.
    return { pageCount: null, pages: [{ pageNumber: null, text: value }] };
  } catch {
    throw new ExtractionError('This Word document could not be read. It may be damaged.');
  }
}

function extractTxt(buffer) {
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    // Not valid UTF-8: most likely a Windows-1252 file saved by an older editor.
    text = new TextDecoder('windows-1252').decode(buffer);
  }
  return { pageCount: null, pages: [{ pageNumber: null, text: text.replace(/^﻿/, '') }] };
}

const extractors = { pdf: extractPdf, docx: extractDocx, txt: extractTxt };

/**
 * @returns {{ pageCount: number|null, pages: {pageNumber, text}[], text: string, wordCount: number }}
 * `text` is the full readable text, with page markers for PDFs.
 */
export async function extractDocument(buffer, fileType) {
  const { pageCount, pages } = await extractors[fileType](buffer);
  const cleaned = pages.map((p) => ({ ...p, text: normalizeText(p.text) }));

  const text = cleaned
    .filter((p) => p.text)
    .map((p) => (p.pageNumber ? `--- Page ${p.pageNumber} ---\n${p.text}` : p.text))
    .join('\n\n');

  const words = cleaned.reduce((n, p) => n + (p.text.match(/\S+/g)?.length ?? 0), 0);
  if (words < 5) {
    throw new ExtractionError(
      fileType === 'pdf'
        ? 'No readable text found. Scanned PDFs (images of pages) are not supported.'
        : 'This file does not contain any readable text.',
    );
  }

  return { pageCount, pages: cleaned, text, wordCount: words };
}
