import { z } from 'zod';
import { GROUNDING_RULES, formatSources } from './grounding.js';

const text = (max) => z.string().trim().max(max);

/**
 * An array where each item is validated on its own: a malformed item is
 * dropped instead of failing the whole reply, and extra items are cut.
 */
export const lenientArray = (item, max) =>
  z
    .array(z.unknown())
    .catch([])
    .transform((items) =>
      items.flatMap((value) => {
        const parsed = item.safeParse(value);
        return parsed.success ? [parsed.data] : [];
      }).slice(0, max),
    );

const confidence = z.coerce.number().min(0).max(100).catch(50);

const evidenceItem = z.object({
  claim: text(600).min(1),
  source: z.string().trim(),
  quote: text(600).catch(''),
  support: z.enum(['supporting', 'contradicting', 'unclear']).catch('unclear'),
});

const citedInsight = z.object({
  title: text(300).min(1),
  description: text(2000).catch(''),
  confidence,
  evidence: lenientArray(evidenceItem, 6),
});

const sideOfContradiction = z.object({
  text: text(600).min(1),
  source: z.string().trim(),
  quote: text(600).catch(''),
});

export const insightsReplySchema = z.object({
  keyFindings: lenientArray(citedInsight, 8),
  themes: lenientArray(citedInsight, 6),
  contradictions: lenientArray(
    z.object({
      title: text(300).min(1),
      description: text(2000).catch(''),
      claimA: sideOfContradiction,
      claimB: sideOfContradiction,
      possibleExplanation: text(1000).catch(''),
      confidence,
    }),
    5,
  ),
  researchGaps: lenientArray(citedInsight.extend({ rationale: text(1000).catch('') }), 6),
  unansweredQuestions: lenientArray(citedInsight, 5),
});

export const matrixReplySchema = z.object({
  rows: lenientArray(
    z.object({
      claim: text(300).min(1),
      cells: lenientArray(
        z.object({
          source: z.string().trim(),
          status: z.enum(['supporting', 'contradicting', 'unclear']).catch('unclear'),
          note: text(400).catch(''),
          quote: text(600).catch(''),
        }),
        40,
      ),
    }),
    8,
  ),
});

/** "- field-study.pdf: S1, S2, S3", so the model can check every document. */
function documentIndex(sources) {
  const byFile = new Map();
  for (const s of sources) {
    const key = String(s.documentId);
    if (!byFile.has(key)) byFile.set(key, { filename: s.filename, ids: [] });
    byFile.get(key).ids.push(s.id);
  }
  return [...byFile.values()].map((d) => `- ${d.filename}: ${d.ids.join(', ')}`).join('\n');
}

const header = ({ title, researchQuestion, sources }) => `Research project: "${title}"
Research question: "${researchQuestion}"

The corpus has ${new Set(sources.map((s) => String(s.documentId))).size} document(s). Their excerpts, by document:
${documentIndex(sources)}`;

/**
 * Key findings, themes, contradictions, gaps and unanswered questions.
 * @param {{ title: string, researchQuestion: string,
 *           sources: { id: string, documentId: any, filename: string, pageNumber: number|null, text: string }[] }} input
 */
export function buildInsightsPrompt(input) {
  return {
    label: 'analysis-insights',
    system: GROUNDING_RULES,
    schema: insightsReplySchema,
    temperature: 0.2,
    // Gemini's thinking tokens count toward this limit, and the reply is long.
    maxOutputTokens: 24576,
    prompt: `${header(input)}

Analyse the whole corpus with respect to the research question. Return JSON in exactly this shape:
{
  "keyFindings": [
    {
      "title": "One-sentence finding",
      "description": "1 to 3 sentences: what the evidence shows, and how strong or limited it is",
      "confidence": 70,
      "evidence": [
        { "claim": "What one source states", "source": "S1", "quote": "Words copied exactly from S1, at most 30 words", "support": "supporting" }
      ]
    }
  ],
  "themes": [ { "title": "Theme name", "description": "How the theme appears across the documents", "confidence": 70, "evidence": [ … ] } ],
  "contradictions": [
    {
      "title": "What the sources disagree about",
      "description": "One or two sentences on the disagreement",
      "claimA": { "text": "What one document reports", "source": "S2", "quote": "exact words from S2" },
      "claimB": { "text": "What a different document reports", "source": "S5", "quote": "exact words from S5" },
      "possibleExplanation": "A cautious explanation, e.g. different samples, methods, task types or time spans",
      "confidence": 60
    }
  ],
  "researchGaps": [
    {
      "title": "What is not yet known",
      "description": "Why this matters for the research question",
      "rationale": "What in the corpus shows the gap, e.g. \\"All three documents study only short-term effects.\\"",
      "confidence": 60,
      "evidence": [ … optional … ]
    }
  ],
  "unansweredQuestions": [ { "title": "A question the corpus cannot answer", "description": "What evidence would be needed", "confidence": 50, "evidence": [] } ]
}

How to fill it in:
- keyFindings: 3 to 6, most important first. Each needs 1 to 4 evidence items. A finding backed by several documents is stronger than one backed by a single document.
- themes: 2 to 4 topics that recur across documents.
- contradictions: only genuine disagreements between two DIFFERENT documents. claimA and claimB must cite excerpts from different documents. If the documents do not disagree, return []. Never invent a disagreement.
- researchGaps: 2 to 4 things the research question needs that the corpus does not cover (populations, time spans, methods, outcomes). Base each rationale on what the documents do cover.
- unansweredQuestions: 1 to 3 parts of the research question that the corpus cannot answer.
- "source" must be one of the excerpt ids above. "quote" must be copied character for character from that excerpt.
- "support" says how the evidence relates to the finding: "supporting", "contradicting" or "unclear".
- "confidence" (0-100): how strongly the corpus backs the item. Lower it for single-document support, small or weak studies, or disagreement.
- Titles and descriptions are plain text. Never write excerpt ids like S1 in them.

Excerpts:
${formatSources(input.sources)}`,
  };
}

/** The evidence matrix: central claims checked against every document. */
export function buildMatrixPrompt(input) {
  return {
    label: 'analysis-matrix',
    system: GROUNDING_RULES,
    schema: matrixReplySchema,
    temperature: 0.1,
    maxOutputTokens: 24576,
    prompt: `${header(input)}

Build an evidence matrix: the central claims relevant to the research question, checked against every document. Return JSON in exactly this shape:
{
  "rows": [
    {
      "claim": "A specific, checkable claim, e.g. \\"AI assistants reduce task completion time\\"",
      "cells": [
        { "source": "S1", "status": "supporting", "note": "One sentence on what this document says about the claim", "quote": "Words copied exactly from S1, at most 30 words" }
      ]
    }
  ]
}

How to fill it in:
- 4 to 8 claims. Prefer claims that several documents address, including claims they disagree on.
- For each claim, go through every document in the list above. For each document that addresses the claim, add ONE cell citing the excerpt where it does. Leave out documents that say nothing about the claim; the app marks those as "no evidence".
- "status": "supporting" (the document backs the claim), "contradicting" (it points the other way) or "unclear" (mixed, indirect or ambiguous).
- "source" must be one of the excerpt ids above. "quote" must be copied character for character from that excerpt.
- Notes and claims are plain text. Never write excerpt ids like S1 in them.

Excerpts:
${formatSources(input.sources)}`,
  };
}
