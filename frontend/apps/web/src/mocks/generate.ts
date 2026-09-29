import type {
  AnswerEvidence,
  Conversation,
  EvidenceMatrix,
  Insight,
  InsightEvidence,
  Project,
  ResearchBrief,
  SourceDocument,
} from '@synapse/shared';
import { newId, now } from './db';

/* Deterministic, readable placeholder research content for mocks. Never shown against the real API. */

const SUPPORTS = ['supporting', 'contradicting', 'unclear'] as const;

function pageOf(doc: SourceDocument, n: number): number | null {
  return doc.metadata.pageCount ? Math.min(doc.metadata.pageCount, 2 + ((n * 3) % doc.metadata.pageCount)) : null;
}

function stem(filename: string): string {
  return filename.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
}

export function summaryFor(doc: Pick<SourceDocument, 'filename'>): string {
  return `A study on ${stem(doc.filename)}, reporting its method, sample and main outcomes, with notes on the limits of its design.`;
}

export function extractedTextFor(doc: SourceDocument): string {
  const pages = doc.metadata.pageCount ?? 3;
  return Array.from({ length: pages }, (_, i) => {
    const header = doc.metadata.pageCount ? `— Page ${i + 1} —\n\n` : '';
    return `${header}${stem(doc.filename)}: section ${i + 1}. This mock text stands in for the extracted content of the uploaded file. The real backend returns the full text it parsed, with page breaks preserved for PDFs.\n\nParticipants were observed over a four-week period while completing a set of representative tasks. Results are reported with confidence intervals and a discussion of threats to validity.`;
  }).join('\n\n');
}

export function answerFor(project: Project, question: string, docs: SourceDocument[]): Conversation {
  const offTopic = /\b(weather|stock price|recipe|football)\b/i.test(question);
  if (offTopic || docs.length === 0) {
    return {
      id: newId(),
      projectId: project.id,
      question,
      response: {
        answer: 'Insufficient evidence in the current research corpus.',
        keyFindings: [],
        evidence: [],
        confidence: 0,
        limitations: ['None of the uploaded sources discuss this question.'],
        insufficientEvidence: true,
      },
      sources: [],
      createdAt: now(),
    };
  }

  const cited = docs.slice(0, 3);
  const evidence: AnswerEvidence[] = cited.map((d, i) => ({
    claim:
      i === 0
        ? 'Participants were observed for a short period, typically a few weeks.'
        : i === 1
          ? 'Effects were measured on simple, well-defined tasks.'
          : 'Self-reported measures were used alongside observed outcomes.',
    sourceId: d.id,
    sourceName: d.filename,
    page: pageOf(d, i + 1),
    quote: `“…as reported in ${stem(d.filename)}, the observation window and task selection limit how far the results generalise…”`,
    support: SUPPORTS[i % 3]!,
  }));

  return {
    id: newId(),
    projectId: project.id,
    question,
    response: {
      answer: `Evidence suggests the sources converge on a few recurring points about “${question.replace(/\?$/, '')}”.\n\nMost sources rely on short observation windows and well-defined tasks, so conclusions about long-term or complex work are tentative. Where sources disagree, the difference may relate to how outcomes were measured.`,
      keyFindings: ['Most studies measure effects over weeks, not months.', 'Task complexity is a likely moderator.'],
      evidence,
      confidence: Math.min(90, 45 + cited.length * 11),
      limitations: ['No source studies effects beyond six months.', 'Samples are small and mostly from one region.'],
      insufficientEvidence: false,
    },
    sources: cited.map((d, i) => ({ documentId: d.id, filename: d.filename, pageNumber: pageOf(d, i + 1) })),
    createdAt: now(),
  };
}

function ev(doc: SourceDocument, n: number, claim: string): InsightEvidence {
  return {
    claim,
    documentId: doc.id,
    filename: doc.filename,
    pageNumber: pageOf(doc, n),
    quote: `“…${claim.toLowerCase().replace(/\.$/, '')}, according to the authors…”`,
    support: SUPPORTS[n % 3]!,
  };
}

export function analysisFor(project: Project, docs: SourceDocument[]): { insights: Insight[]; matrix: EvidenceMatrix } {
  const at = now();
  const a = docs[0]!;
  const b = docs[1] ?? a;
  const c = docs[2] ?? b;
  const refs = (list: SourceDocument[], n: number) =>
    list.map((d) => ({ documentId: d.id, filename: d.filename, pageNumber: pageOf(d, n) }));
  const base = (type: Insight['type'], title: string, description: string, confidence: number, n: number): Insight => ({
    id: newId(),
    projectId: project.id,
    type,
    title,
    description,
    confidence,
    evidence: [ev(a, n, title), ev(b, n + 1, description)],
    details: null,
    sourceReferences: refs([a, b], n),
    createdAt: at,
  });

  const insights: Insight[] = [
    base('key_finding', 'Faster completion on well-defined tasks', 'Several sources report shorter completion times when the task is clearly specified.', 78, 1),
    base('key_finding', 'Quality effects are mixed', 'Evidence on output quality is less consistent than evidence on speed.', 55, 2),
    base('key_finding', 'Experience moderates the effect', 'Less experienced participants tend to show larger gains.', 64, 3),
    base('theme', 'Measurement of outcomes', 'Sources differ in whether they measure time, quality or satisfaction.', 71, 4),
    base('theme', 'Short study durations', 'Most studies run for weeks rather than months.', 82, 5),
    {
      ...base('contradiction', 'Gains on complex tasks', 'Sources disagree on whether gains hold for complex, unfamiliar tasks.', 62, 6),
      details: {
        claimA: { text: `${stem(a.filename)} reports large speed-ups.`, documentId: a.id, filename: a.filename, pageNumber: pageOf(a, 6) },
        claimB: { text: `${stem(c.filename)} reports little improvement on complex tasks.`, documentId: c.id, filename: c.filename, pageNumber: pageOf(c, 7) },
        possibleExplanation: 'The difference may relate to task complexity and how completion was measured.',
      },
    },
    {
      ...base('research_gap', 'Long-term effects are unstudied', 'No source follows participants beyond six months.', 74, 7),
      details: { rationale: `${docs.length} of ${docs.length} sources study only short-term effects.` },
    },
    {
      ...base('research_gap', 'Limited diversity of settings', 'Most samples come from a single type of organisation.', 58, 8),
      details: { rationale: 'Only one source includes more than one organisation.' },
    },
    base('unanswered_question', 'Does the effect persist once novelty wears off?', 'The sources raise this but none can answer it with their data.', 35, 9),
  ];

  const statuses = ['supporting', 'unclear', 'contradicting', 'no_evidence'] as const;
  const claims = [
    'The intervention improves speed',
    'The intervention improves quality',
    'Effects hold for complex tasks',
    'Users report higher satisfaction',
  ];
  const matrix: EvidenceMatrix = {
    sources: docs.map((d) => ({ documentId: d.id, filename: d.filename })),
    rows: claims.map((claim, r) => ({
      id: `row-${r + 1}`,
      claim,
      cells: docs.map((d, col) => {
        const status = statuses[(r + col) % statuses.length]!;
        return {
          documentId: d.id,
          status,
          note: status === 'no_evidence' ? '' : `${stem(d.filename)}: ${status === 'supporting' ? 'reports a positive effect' : status === 'contradicting' ? 'reports no or a negative effect' : 'mixed or self-reported results'}.`,
          pageNumber: status === 'no_evidence' ? null : pageOf(d, r + col),
        };
      }),
    })),
  };
  return { insights, matrix };
}

export function briefFor(project: Project, insights: Insight[], docs: SourceDocument[]): ResearchBrief {
  const cite = (id: string, page: number | null) => {
    const i = docs.findIndex((d) => d.id === id);
    return `[S${i + 1}${page ? `, p. ${page}` : ''}]`;
  };
  const by = (t: Insight['type']) => insights.filter((x) => x.type === t);
  const line = (x: Insight) => `- **${x.title}.** ${x.description} ${x.evidence[0] ? cite(x.evidence[0].documentId, x.evidence[0].pageNumber) : ''}`;
  const markdown = [
    `# Research Brief: ${project.title}`,
    '## Executive Summary',
    `Evidence from ${docs.length} source${docs.length === 1 ? '' : 's'} suggests consistent gains on well-defined tasks, with weaker and conflicting evidence for complex work and for quality.`,
    '## Research Question',
    project.researchQuestion,
    '## Key Findings',
    ...by('key_finding').map(line),
    '## Evidence',
    ...by('theme').map(line),
    '## Conflicting Findings',
    ...by('contradiction').map(line),
    '## Research Gaps',
    ...by('research_gap').map(line),
    '## Limitations',
    '- Short observation windows across sources.\n- Small samples from a narrow range of settings.',
    '## Conclusion',
    'The corpus supports a cautious, task-dependent conclusion. Longer and more varied studies are needed before generalising.',
    '## Sources',
    ...docs.map((d, i) => `- **S${i + 1}** — ${d.filename}`),
  ].join('\n\n');
  return { title: project.title, markdown, generatedAt: now() };
}
