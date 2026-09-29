import { z } from 'zod';
import { GROUNDING_RULES, formatSources } from './grounding.js';

// ~4k tokens: enough to identify a document and its main claims, and cheap
// enough for free-tier rate limits on every upload.
export const SUMMARY_INPUT_CHARS = 15_000;

// Source ids like "(S1)" help in answers but are noise on a source card.
const stripSourceIds = (text) =>
  text
    .replace(/\s*[([]\s*S\d+(?:\s*,\s*S\d+)*\s*[)\]]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

export const summarySchema = z.object({
  summary: z.string().trim().min(10).max(1000).transform(stripSourceIds),
});

export function buildSummaryPrompt({ filename, text }) {
  const truncated = text.length > SUMMARY_INPUT_CHARS;
  const excerpt = truncated ? text.slice(0, SUMMARY_INPUT_CHARS) : text;

  return {
    label: 'document-summary',
    system: GROUNDING_RULES,
    schema: summarySchema,
    temperature: 0.1,
    maxOutputTokens: 2048,
    prompt: `Summarize the document below for a researcher deciding whether it is relevant.

Write 2 to 3 plain sentences (at most 80 words) that say:
- what kind of document it is (for example a study, survey, report, article or notes),
- what it examines,
- its main findings or claims, as the document itself states them.

Use only the document's own content. If the text is a fragment or unclear, say what it appears to be. Do not add opinions or facts that are not in the text. This summary describes a single document, so do not include source ids such as S1.${
      truncated ? '\nOnly the beginning of the document is shown; summarize what is shown.' : ''
    }

Return JSON: {"summary": "<2-3 sentences>"}

${formatSources([{ id: 'S1', filename, text: excerpt }])}`,
  };
}
