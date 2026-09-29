import { z } from 'zod';
import { GROUNDING_RULES } from './grounding.js';
import { lenientArray } from './analysis.prompt.js';

const text = (max) => z.string().trim().max(max);
const sentences = (max) => lenientArray(text(1500).min(1), max);

export const briefReplySchema = z.object({
  executiveSummary: text(4000).min(1),
  keyFindings: sentences(8),
  evidence: text(6000).catch(''),
  conflictingFindings: sentences(6),
  researchGaps: sentences(6),
  limitations: sentences(8),
  conclusion: text(3000).catch(''),
});

const BRIEF_RULES = `${GROUNDING_RULES}

For this task the material is a verified analysis of the user's sources, not the sources themselves. Write only what that material supports.
Cite with the bracketed citations exactly as they appear in the material, for example [S1, p. 4]. Never create a citation, source or page that does not appear there.`;

const LEVEL = (score) => (score >= 70 ? 'High' : score >= 40 ? 'Medium' : 'Low');

/** "[S2, p. 4]" for a document and page, using the brief's source numbering. */
export function citation(labels, documentId, pageNumber) {
  const label = labels.get(String(documentId));
  if (!label) return '';
  return `[${label}${pageNumber ? `, p. ${pageNumber}` : ''}]`;
}

/**
 * The analysis as plain text for the brief writer, with every reference
 * already in [S1, p. 4] form.
 */
export function formatAnalysisMaterial({ sources, labels, insights, matrix }) {
  const cite = (e) => citation(labels, e.documentId, e.pageNumber);
  const ofType = (type) => insights.filter((i) => i.type === type);
  const evidenceLine = (evidence) =>
    evidence.length ? `\n   Evidence: ${evidence.map((e) => `${e.claim} ${cite(e)} (${e.support})`).join('; ')}` : '';

  const list = (type, render) => {
    const items = ofType(type);
    return items.length ? items.map(render).join('\n') : '(none)';
  };

  const matrixLines = matrix?.rows?.length
    ? matrix.rows
        .map(
          (row) =>
            `- "${row.claim}": ${row.cells
              .map((c) => {
                const label = labels.get(String(c.documentId));
                return c.status === 'no_evidence'
                  ? `${label} no evidence`
                  : `${label} ${c.status} ${cite(c)}`;
              })
              .join('; ')}`,
        )
        .join('\n')
    : '(none)';

  return `SOURCES
${sources.map((s) => `${labels.get(String(s.documentId))} = ${s.filename}`).join('\n')}

KEY FINDINGS
${list('key_finding', (i, n) => `${n + 1}. ${i.title} (confidence ${LEVEL(i.confidence)})\n   ${i.description}${evidenceLine(i.evidence)}`)}

THEMES
${list('theme', (i) => `- ${i.title}: ${i.description}${evidenceLine(i.evidence)}`)}

POTENTIAL CONTRADICTIONS
${list('contradiction', (i) => {
  const { claimA, claimB, possibleExplanation } = i.details;
  return `- ${i.title}: ${claimA.text} ${cite(claimA)} versus ${claimB.text} ${cite(claimB)}. Possible explanation: ${possibleExplanation || 'not stated'}`;
})}

RESEARCH GAPS
${list('research_gap', (i) => `- ${i.title}: ${i.details?.rationale || i.description}`)}

UNANSWERED QUESTIONS
${list('unanswered_question', (i) => `- ${i.title}: ${i.description}`)}

EVIDENCE MATRIX
${matrixLines}`;
}

export function buildBriefPrompt({ title, researchQuestion, material }) {
  return {
    label: 'research-brief',
    system: BRIEF_RULES,
    schema: briefReplySchema,
    temperature: 0.3,
    maxOutputTokens: 16384,
    prompt: `Write a research brief for the project "${title}".
Research question: "${researchQuestion}"

Return JSON in exactly this shape:
{
  "executiveSummary": "One paragraph (3 to 5 sentences) answering the research question as far as the evidence allows, with citations",
  "keyFindings": ["One sentence per key finding, most important first, each with its citations"],
  "evidence": "One or two short paragraphs on how strong the evidence is: how many sources agree, what kinds of study they are, where it is thin. With citations.",
  "conflictingFindings": ["One sentence per potential contradiction, naming both sides with citations and a possible explanation"],
  "researchGaps": ["One sentence per research gap"],
  "limitations": ["Limitations of this corpus and of this analysis"],
  "conclusion": "One paragraph: what can and cannot be concluded, worded cautiously"
}

Use "Evidence suggests" and "A possible explanation is" for interpretation. Leave a list empty rather than inventing content. Plain sentences only: no headings, no bullet characters, no bold.

Material:
${material}`,
  };
}
