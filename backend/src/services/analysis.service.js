import { Analysis } from '../models/Analysis.js';
import { INSIGHT_TYPES, Insight } from '../models/Insight.js';
import { ANALYSIS_LOCK_MS, Project } from '../models/Project.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../utils/logger.js';
import { confidenceCap, resolveCitation, stripSourceIds } from './citations.service.js';
import { generateJSON } from './llm.service.js';
import { isAnalysisOutdated, syncProjectAfterSourceChange } from './project.service.js';
import { requireReadySources } from './research.service.js';
import { retrieveForAnalysis } from './retrieval.service.js';
import { buildInsightsPrompt, buildMatrixPrompt } from './prompts/analysis.prompt.js';
import { buildBriefPrompt, formatAnalysisMaterial } from './prompts/brief.prompt.js';

// ---------------------------------------------------------------------------
// Grounding the analysis (pure, so it can be tested without a model)
// ---------------------------------------------------------------------------

/** Model evidence items → verified evidence in the Insight shape. */
function groundEvidence(items, sourcesById, stats) {
  const evidence = [];
  const seen = new Set();
  for (const item of items) {
    const ref = resolveCitation(item.source, item.quote, sourcesById);
    if (!ref) {
      stats.unknownSources += 1;
      continue;
    }
    if (item.quote && !ref.quote) stats.unverifiedQuotes += 1;
    const claim = stripSourceIds(item.claim);
    const key = `${ref.documentId}|${claim.toLowerCase()}`;
    if (!claim || seen.has(key)) continue;
    seen.add(key);
    evidence.push({
      claim,
      documentId: ref.documentId,
      filename: ref.filename,
      pageNumber: ref.pageNumber,
      quote: ref.quote,
      support: item.support,
    });
  }
  return evidence;
}

// An insight with no citable evidence (a gap, an open question) is the AI's
// interpretation, so it can never be rated High.
const NO_EVIDENCE_CAP = 60;

function cappedConfidence(requested, evidence) {
  const cap = evidence.length
    ? confidenceCap(new Set(evidence.map((e) => e.documentId)).size, evidence.every((e) => e.quote))
    : NO_EVIDENCE_CAP;
  return Math.round(Math.min(requested, cap));
}

function sourceReferences(evidence) {
  const refs = new Map();
  for (const e of evidence) {
    const key = `${e.documentId}|${e.pageNumber ?? ''}`;
    if (!refs.has(key)) refs.set(key, { documentId: e.documentId, filename: e.filename, pageNumber: e.pageNumber });
  }
  return [...refs.values()];
}

/**
 * Turns the model's insights into Insight records, enforcing the same rules
 * as the assistant: unknown sources and unverifiable quotes are removed,
 * file names and pages come from the stored chunks, findings and themes
 * without valid evidence are dropped, a contradiction needs two different
 * documents, and confidence is capped by the evidence behind it.
 */
export function groundInsights(reply, sourcesById) {
  const stats = { unknownSources: 0, unverifiedQuotes: 0, dropped: 0 };
  const insights = [];

  const addCited = (type, items, { requireEvidence, details = () => null }) => {
    for (const item of items) {
      const evidence = groundEvidence(item.evidence, sourcesById, stats);
      const title = stripSourceIds(item.title);
      if (!title || (requireEvidence && !evidence.length)) {
        stats.dropped += 1;
        continue;
      }
      insights.push({
        type,
        title,
        description: stripSourceIds(item.description),
        confidence: cappedConfidence(item.confidence, evidence),
        evidence,
        details: details(item),
        sourceReferences: sourceReferences(evidence),
      });
    }
  };

  addCited('key_finding', reply.keyFindings, { requireEvidence: true });
  addCited('theme', reply.themes, { requireEvidence: true });

  for (const item of reply.contradictions) {
    const a = resolveCitation(item.claimA.source, item.claimA.quote, sourcesById);
    const b = resolveCitation(item.claimB.source, item.claimB.quote, sourcesById);
    // "Sources disagree" needs two sources.
    if (!a || !b || a.documentId === b.documentId) {
      stats.dropped += 1;
      continue;
    }
    const side = (claim, ref) => ({
      text: stripSourceIds(claim.text),
      documentId: ref.documentId,
      filename: ref.filename,
      pageNumber: ref.pageNumber,
    });
    const claimA = side(item.claimA, a);
    const claimB = side(item.claimB, b);
    const evidence = [
      { claim: claimA.text, documentId: a.documentId, filename: a.filename, pageNumber: a.pageNumber, quote: a.quote, support: 'supporting' },
      { claim: claimB.text, documentId: b.documentId, filename: b.filename, pageNumber: b.pageNumber, quote: b.quote, support: 'contradicting' },
    ];
    insights.push({
      type: 'contradiction',
      title: stripSourceIds(item.title),
      description: stripSourceIds(item.description),
      confidence: cappedConfidence(item.confidence, evidence),
      evidence,
      details: { claimA, claimB, possibleExplanation: stripSourceIds(item.possibleExplanation) },
      sourceReferences: sourceReferences(evidence),
    });
  }

  addCited('research_gap', reply.researchGaps, {
    requireEvidence: false,
    details: (gap) => ({ rationale: stripSourceIds(gap.rationale) }),
  });
  addCited('unanswered_question', reply.unansweredQuestions, { requireEvidence: false });

  return { insights, stats };
}

const noEvidenceCell = (documentId) => ({ documentId, status: 'no_evidence', note: '', quote: '', pageNumber: null });

/**
 * Turns the model's matrix into the API shape: one column per document the
 * model read, a cell for every row × document. Documents the model did not
 * cite for a claim are "no_evidence"; a claim no document backs is dropped.
 */
export function groundMatrix(reply, sourcesById, documents) {
  const rows = [];
  for (const row of reply.rows) {
    const byDocument = new Map();
    for (const cell of row.cells) {
      const ref = resolveCitation(cell.source, cell.quote, sourcesById);
      if (!ref) continue;
      const candidate = {
        documentId: ref.documentId,
        status: cell.status,
        note: stripSourceIds(cell.note),
        quote: ref.quote,
        pageNumber: ref.pageNumber,
      };
      const current = byDocument.get(ref.documentId);
      if (!current) {
        byDocument.set(ref.documentId, candidate);
      } else if (new Set([current.status, candidate.status]).size === 2 &&
        [current.status, candidate.status].every((s) => s === 'supporting' || s === 'contradicting')) {
        current.status = 'unclear';
        current.note = 'This source has passages pointing both ways on this claim.';
      } else if (current.status === candidate.status && !current.quote && candidate.quote) {
        byDocument.set(ref.documentId, candidate);
      }
    }
    if (!byDocument.size) continue;
    rows.push({
      id: `row-${rows.length + 1}`,
      claim: stripSourceIds(row.claim),
      cells: documents.map((d) => byDocument.get(String(d.documentId)) ?? noEvidenceCell(String(d.documentId))),
    });
  }
  return {
    sources: documents.map((d) => ({ documentId: String(d.documentId), filename: d.filename })),
    rows,
  };
}

// ---------------------------------------------------------------------------
// Running an analysis
// ---------------------------------------------------------------------------

async function acquireLock(projectId) {
  const now = new Date();
  const locked = await Project.findOneAndUpdate(
    {
      _id: projectId,
      $or: [{ analysisStartedAt: null }, { analysisStartedAt: { $lt: new Date(now - ANALYSIS_LOCK_MS) } }],
    },
    { $set: { analysisStartedAt: now } },
    { returnDocument: 'after' },
  );
  if (!locked) {
    throw new ApiError(409, 'An analysis of this project is already running. It usually takes under a minute.', {
      code: 'ANALYSIS_IN_PROGRESS',
    });
  }
  return now;
}

/**
 * Analyses every ready source of a project: insights and the evidence
 * matrix, in two parallel AI calls. Replaces any earlier analysis only once
 * the new one has succeeded, so a failed run leaves the old results intact.
 */
export async function runAnalysis(project) {
  await requireReadySources(project._id);
  const startedAt = await acquireLock(project._id);

  try {
    const { chunks, documents, strategy } = await retrieveForAnalysis(project._id, project.researchQuestion);
    const sources = chunks.map((chunk, i) => ({ ...chunk, id: `S${i + 1}` }));
    const sourcesById = new Map(sources.map((s) => [s.id, s]));

    // The documents the model actually read, in reading order.
    const covered = [];
    for (const s of sources) {
      if (!covered.some((d) => String(d.documentId) === String(s.documentId))) {
        covered.push({ documentId: s.documentId, filename: s.filename });
      }
    }

    const input = { title: project.title, researchQuestion: project.researchQuestion, sources };
    const [insightsReply, matrixReply] = await Promise.all([
      generateJSON(buildInsightsPrompt(input)),
      generateJSON(buildMatrixPrompt(input)),
    ]);

    const { insights, stats } = groundInsights(insightsReply, sourcesById);
    const matrix = groundMatrix(matrixReply, sourcesById, covered);
    if (!insights.some((i) => i.type === 'key_finding')) {
      throw new ApiError(502, 'The AI could not produce findings backed by your sources. Please try again.', {
        code: 'AI_BAD_RESPONSE',
      });
    }

    const analyzedAt = new Date();
    const counts = Object.fromEntries(INSIGHT_TYPES.map((t) => [t, insights.filter((i) => i.type === t).length]));

    // New results first, then remove the old ones: a failure part-way never
    // leaves the project with no insights at all.
    const saved = await Insight.insertMany(insights.map((i) => ({ ...i, projectId: project._id })));
    await Insight.deleteMany({ projectId: project._id, _id: { $nin: saved.map((s) => s._id) } });
    await Analysis.findOneAndUpdate(
      { projectId: project._id },
      {
        $set: {
          documentIds: documents.map((d) => d._id),
          sources: covered,
          coverage: strategy,
          matrix,
          counts,
          brief: null,
          analyzedAt,
        },
      },
      { upsert: true },
    );
    await Project.updateOne({ _id: project._id }, { $set: { analyzedAt } });
    await syncProjectAfterSourceChange(project._id);

    logger.info('Analysis complete', {
      projectId: String(project._id),
      strategy,
      chunks: sources.length,
      documents: covered.length,
      matrixRows: matrix.rows.length,
      ...counts,
      ...stats,
    });
    return { analyzedAt, sourceCount: covered.length, counts };
  } finally {
    // Only release our own lock (a stale one may have been taken over).
    await Project.updateOne({ _id: project._id, analysisStartedAt: startedAt }, { $set: { analysisStartedAt: null } });
  }
}

// ---------------------------------------------------------------------------
// Reading results
// ---------------------------------------------------------------------------

async function analysisState(projectId) {
  const analysis = await Analysis.findOne({ projectId });
  return { analysis, analyzedAt: analysis?.analyzedAt ?? null, outdated: await isAnalysisOutdated(analysis) };
}

export async function listInsights(project, type) {
  const [insights, { analyzedAt, outdated }] = await Promise.all([
    Insight.find({ projectId: project._id, ...(type ? { type } : {}) }).sort({ _id: 1 }),
    analysisState(project._id),
  ]);
  return { insights, analyzedAt, outdated };
}

export async function getEvidenceMatrix(project) {
  const { analysis, analyzedAt, outdated } = await analysisState(project._id);
  return { matrix: analysis?.matrix ?? null, analyzedAt, outdated };
}

// ---------------------------------------------------------------------------
// Research brief
// ---------------------------------------------------------------------------

const escapeMarkdown = (value) => String(value).replace(/([\\`*_[\]|<>#])/g, '\\$1');

/** Every [S#] a brief may cite, with the pages the analysis actually found. */
export function knownCitations(labels, insights, matrix) {
  const known = new Map([...labels.values()].map((label) => [label, new Set()]));
  const add = (documentId, pageNumber) => {
    const label = labels.get(String(documentId));
    if (label && pageNumber) known.get(label).add(pageNumber);
  };
  for (const insight of insights) {
    for (const e of insight.evidence ?? []) add(e.documentId, e.pageNumber);
    if (insight.type === 'contradiction') {
      add(insight.details.claimA.documentId, insight.details.claimA.pageNumber);
      add(insight.details.claimB.documentId, insight.details.claimB.pageNumber);
    }
  }
  for (const row of matrix?.rows ?? []) for (const cell of row.cells) add(cell.documentId, cell.pageNumber);
  return known;
}

/**
 * Keeps only citations the analysis can back: an unknown source is removed,
 * and a page the analysis never cited is reduced to the source alone.
 */
export function sanitizeCitations(value, known) {
  return String(value ?? '')
    .replace(/\[([^[\]]*\bS\d+[^[\]]*)\]/gi, (_match, inner) => {
      const kept = inner.split(/\s*;\s*|\s*,\s*(?=S\d)/i).flatMap((part) => {
        const m = /^\s*(S\d+)(?:\s*,\s*pp?\.\s*(\d+)(?:\s*[-–]\s*\d+)?)?\s*$/i.exec(part);
        if (!m) return [];
        const label = m[1].toUpperCase();
        if (!known.has(label)) return [];
        const page = m[2] && known.get(label).has(Number(m[2])) ? `, p. ${m[2]}` : '';
        return [`${label}${page}`];
      });
      return kept.length ? `[${[...new Set(kept)].join('; ')}]` : '';
    })
    .replace(/[^\S\n]+([.,;:])/g, '$1')
    .replace(/[^\S\n]{2,}/g, ' ')
    .trim();
}

const MATRIX_LABELS = { supporting: 'Supports', contradicting: 'Contradicts', unclear: 'Unclear', no_evidence: '—' };

function matrixTable(matrix, labels) {
  if (!matrix?.rows?.length) return '';
  const cols = matrix.sources.map((s) => labels.get(String(s.documentId)));
  const cell = (c) => `${MATRIX_LABELS[c.status]}${c.status !== 'no_evidence' && c.pageNumber ? `, p. ${c.pageNumber}` : ''}`;
  return [
    `| Claim | ${cols.join(' | ')} |`,
    `| --- | ${cols.map(() => ':---:').join(' | ')} |`,
    ...matrix.rows.map((r) => `| ${escapeMarkdown(r.claim)} | ${r.cells.map(cell).join(' | ')} |`),
  ].join('\n');
}

const longDate = (date) =>
  new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(date);

/**
 * Assembles the brief in the guide's section order. The model writes the
 * prose; the research question, evidence table and source list come from
 * stored data, so the brief can't cite a source that isn't in the project.
 */
export function composeBrief({ project, analysis, reply, labels, known }) {
  const clean = (v) => sanitizeCitations(v, known);
  const bullets = (items, empty) => {
    const lines = items.map(clean).filter(Boolean);
    return lines.length ? lines.map((l) => `- ${l}`).join('\n') : `_${empty}_`;
  };
  const sourceCount = analysis.sources.length;

  const limitations = [
    ...reply.limitations,
    `This brief was generated by AI from ${sourceCount === 1 ? '1 uploaded source and covers only what it contains' : `${sourceCount} uploaded sources and covers only what they contain`}. Check key claims against the cited pages.`,
  ];
  if (analysis.coverage === 'ranked') {
    limitations.push('The sources were too long to read in full, so the analysis used the passages of each source most relevant to the research question.');
  }

  const table = matrixTable(analysis.matrix, labels);

  return `# Research Brief: ${escapeMarkdown(project.title)}

_Generated by ResearchLens AI on ${longDate(new Date())} from ${sourceCount} source${sourceCount === 1 ? '' : 's'}. AI-generated synthesis: evidence is cited as [S1, p. 4], and the Sources section maps each S number to a file._

## Executive Summary

${clean(reply.executiveSummary)}

## Research Question

${escapeMarkdown(project.researchQuestion)}

## Key Findings

${bullets(reply.keyFindings, 'No key findings were identified.')}

## Evidence

${clean(reply.evidence) || '_See the evidence matrix below._'}${table ? `\n\n### Evidence Matrix\n\n${table}` : ''}

## Conflicting Findings

${bullets(reply.conflictingFindings, 'No potential contradictions were identified between the sources.')}

## Research Gaps

${bullets(reply.researchGaps, 'No research gaps were identified.')}

## Limitations

${bullets(limitations, '')}

## Conclusion

${clean(reply.conclusion) || '_No conclusion could be drawn from the current sources._'}

## Sources

${analysis.sources.map((s) => `- **${labels.get(String(s.documentId))}**: ${escapeMarkdown(s.filename)}`).join('\n')}
`;
}

async function writeBrief(project, analysis) {
  const insights = await Insight.find({ projectId: project._id }).sort({ _id: 1 }).lean();
  const labels = new Map(analysis.sources.map((s, i) => [String(s.documentId), `S${i + 1}`]));
  const material = formatAnalysisMaterial({
    sources: analysis.sources,
    labels,
    insights,
    matrix: analysis.matrix,
  });

  const reply = await generateJSON(
    buildBriefPrompt({ title: project.title, researchQuestion: project.researchQuestion, material }),
  );

  const known = knownCitations(labels, insights, analysis.matrix);
  const brief = {
    title: project.title,
    markdown: composeBrief({ project, analysis, reply, labels, known }),
    // What each S number in the markdown refers to, so citations can link to the file.
    sources: analysis.sources.map((s, i) => ({
      label: `S${i + 1}`,
      documentId: String(s.documentId),
      filename: s.filename,
    })),
    generatedAt: new Date(),
  };
  // Keyed by this analysis: if a new one replaced it meanwhile, don't attach
  // a stale brief to it.
  await Analysis.updateOne({ _id: analysis._id }, { $set: { brief } });
  return brief;
}

// One brief generation per analysis at a time; parallel requests share it.
const briefJobs = new Map();

/** The research brief, written on the first request after an analysis. */
export async function getBrief(project) {
  const { analysis, outdated } = await analysisState(project._id);
  if (!analysis) {
    throw new ApiError(409, 'Run an analysis first. The brief is written from its results.', {
      code: 'ANALYSIS_REQUIRED',
    });
  }
  if (analysis.brief) return { brief: analysis.brief, outdated };

  const key = String(analysis._id);
  if (!briefJobs.has(key)) {
    briefJobs.set(key, writeBrief(project, analysis).finally(() => briefJobs.delete(key)));
  }
  return { brief: await briefJobs.get(key), outdated };
}
