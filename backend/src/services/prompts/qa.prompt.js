import { z } from 'zod';
import { GROUNDING_RULES, formatSources } from './grounding.js';

export const INSUFFICIENT_EVIDENCE_ANSWER = 'Insufficient evidence in the current research corpus.';

const text = (max) => z.string().trim().max(max);

// What the model returns. Lenient where a small slip shouldn't cost a whole
// answer (unknown support value, confidence as "80"), strict on structure.
export const qaReplySchema = z.object({
  answer: text(6000),
  keyFindings: z.array(text(500)).max(8).catch([]),
  evidence: z
    .array(
      z.object({
        claim: text(600).min(1),
        source: z.string().trim(),
        quote: text(600).catch(''),
        support: z.enum(['supporting', 'contradicting', 'unclear']).catch('unclear'),
      }),
    )
    .max(15)
    .catch([]),
  confidence: z.coerce.number().min(0).max(100).catch(0),
  limitations: z.array(text(600)).max(8).catch([]),
  insufficientEvidence: z.boolean().catch(false),
});

/**
 * @param {{ researchQuestion: string, question: string,
 *           history: { question: string, answer: string }[],
 *           sources: { id: string, filename: string, pageNumber: number|null, text: string }[] }} input
 */
export function buildQAPrompt({ researchQuestion, question, history, sources }) {
  const earlier = history.length
    ? `Earlier in this conversation (for context only; it is not evidence):\n${history
        .map((h) => `Q: ${h.question}\nA: ${h.answer.slice(0, 600)}`)
        .join('\n\n')}\n\n`
    : '';

  return {
    label: 'research-qa',
    system: GROUNDING_RULES,
    schema: qaReplySchema,
    temperature: 0.2,
    maxOutputTokens: 8192,
    prompt: `The project's overall research question is: "${researchQuestion}"

${earlier}Answer this question using only the sources below:
"${question}"

Return JSON in exactly this shape:
{
  "answer": "A direct answer first, then the supporting detail. 1 to 4 short paragraphs of plain text, separated by a blank line. Name documents by file name if needed; never write source ids like S1 in the answer.",
  "keyFindings": ["Up to 5 short findings, each backed by the evidence below"],
  "evidence": [
    {
      "claim": "One specific claim a source makes that bears on the answer",
      "source": "S1",
      "quote": "Words copied exactly from that source, at most 30 words",
      "support": "supporting"
    }
  ],
  "confidence": 70,
  "limitations": ["Caveats: what the evidence does not cover, weak or small studies, disagreements"],
  "insufficientEvidence": false
}

How to fill it in:
- Answer the question that was asked. Do not summarize other topics from the sources unless they change the answer.
- "source" must be one of the source ids below. Cite every source that matters, 2 to 8 evidence items in total.
- "quote" must be copied character for character from the cited source.
- "support" says how that evidence relates to your answer: "supporting", "contradicting" (it points the other way), or "unclear" (mixed or ambiguous).
- "confidence" (0-100) is how strongly the cited evidence backs the answer. Lower it for few sources, weak or indirect evidence, or disagreement between sources.
- If the sources do not address the question, set "insufficientEvidence" to true, leave "evidence" and "keyFindings" empty, and use "limitations" to say what is missing.

Sources:
${formatSources(sources)}`,
  };
}
