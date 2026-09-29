import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { Insight } from '../src/models/Insight.js';
import { Project } from '../src/models/Project.js';
import { whenIdle } from '../src/services/document.service.js';
import {
  composeBrief,
  groundInsights,
  groundMatrix,
  sanitizeCitations,
} from '../src/services/analysis.service.js';
import { selectChunks } from '../src/services/retrieval.service.js';
import { resetProvider, setProviderForTesting } from '../src/services/llm.service.js';
import { AIProviderError } from '../src/services/llm.errors.js';
import { insightsReplySchema, matrixReplySchema } from '../src/services/prompts/analysis.prompt.js';
import { startTestDB, clearTestDB, stopTestDB } from './helpers/db.js';
import { registerUser } from './helpers/auth.js';
import { makePdf } from './helpers/fixtures.js';

// ---------------------------------------------------------------------------
// Grounding (pure)
// ---------------------------------------------------------------------------

const study = {
  documentId: 'docA',
  filename: 'study-a.pdf',
  pageNumber: 3,
  text: 'Developers finished routine tasks 26% faster. Gains were smaller for complex tasks.',
  metadata: { pageStarts: [{ offset: 0, pageNumber: 3 }, { offset: 46, pageNumber: 4 }] },
};
const survey = {
  documentId: 'docB',
  filename: 'survey-b.txt',
  pageNumber: null,
  text: 'Respondents reported no change in overall task speed.',
  metadata: {},
};
const sourcesById = new Map([
  ['S1', study],
  ['S2', survey],
]);

const insightsReply = (overrides = {}) =>
  insightsReplySchema.parse({
    keyFindings: [
      {
        title: 'Routine work got faster (S1)',
        description: 'One study reports faster routine work [S1].',
        confidence: 95,
        evidence: [
          { claim: 'Routine tasks were 26% faster', source: 'S1', quote: 'finished routine tasks 26% faster', support: 'supporting' },
          { claim: 'Complex tasks gained less', source: 's1', quote: 'Gains were smaller for complex tasks', support: 'unclear' },
        ],
      },
      { title: 'Invented finding', confidence: 90, evidence: [{ claim: 'x', source: 'S9', quote: '', support: 'supporting' }] },
    ],
    themes: [],
    contradictions: [
      {
        title: 'Speed gains',
        claimA: { text: 'Tasks were faster', source: 'S1', quote: 'finished routine tasks 26% faster' },
        claimB: { text: 'No change in speed', source: 'S2', quote: 'no change in overall task speed' },
        possibleExplanation: 'Measured versus self-reported speed.',
        confidence: 95,
      },
      {
        title: 'Within one document',
        claimA: { text: 'Faster', source: 'S1', quote: '' },
        claimB: { text: 'Smaller gains', source: 'S1', quote: '' },
        confidence: 80,
      },
    ],
    researchGaps: [{ title: 'Long-term effects', rationale: 'Both sources are short (S1, S2).', confidence: 90, evidence: [] }],
    unansweredQuestions: [{ title: 'Does code quality change?', confidence: 30 }],
    ...overrides,
  });

describe('analysis reply schemas', () => {
  it('drop a malformed item instead of rejecting the whole reply', () => {
    const parsed = insightsReplySchema.parse({
      keyFindings: [{ title: 'Good', evidence: [] }, { notATitle: true }, 'junk'],
      themes: 'not a list',
    });
    expect(parsed.keyFindings.map((f) => f.title)).toEqual(['Good']);
    expect(parsed.themes).toEqual([]);
    expect(parsed.contradictions).toEqual([]);
  });
});

describe('groundInsights', () => {
  it('keeps findings with verified evidence, with pages taken from the source', () => {
    const { insights } = groundInsights(insightsReply(), sourcesById);
    const finding = insights.find((i) => i.type === 'key_finding');
    expect(finding).toMatchObject({
      title: 'Routine work got faster',
      description: 'One study reports faster routine work.',
      details: null,
      evidence: [
        { claim: 'Routine tasks were 26% faster', documentId: 'docA', filename: 'study-a.pdf', pageNumber: 3, support: 'supporting' },
        { claim: 'Complex tasks gained less', documentId: 'docA', filename: 'study-a.pdf', pageNumber: 4, support: 'unclear' },
      ],
      sourceReferences: [
        { documentId: 'docA', filename: 'study-a.pdf', pageNumber: 3 },
        { documentId: 'docA', filename: 'study-a.pdf', pageNumber: 4 },
      ],
    });
  });

  it('drops a finding whose only evidence cites an unknown source', () => {
    const { insights, stats } = groundInsights(insightsReply(), sourcesById);
    expect(insights.map((i) => i.title)).not.toContain('Invented finding');
    expect(stats.unknownSources).toBe(1);
  });

  it('caps confidence by the evidence behind it', () => {
    const { insights } = groundInsights(insightsReply(), sourcesById);
    const byType = (t) => insights.find((i) => i.type === t);
    expect(byType('key_finding').confidence).toBe(75); // one document, quotes verified
    expect(byType('contradiction').confidence).toBe(85); // two documents, quotes verified
    expect(byType('research_gap').confidence).toBe(60); // no evidence: never High
    expect(byType('unanswered_question').confidence).toBe(30);
  });

  it('builds a contradiction from two different documents only', () => {
    const { insights } = groundInsights(insightsReply(), sourcesById);
    const contradictions = insights.filter((i) => i.type === 'contradiction');
    expect(contradictions).toHaveLength(1);
    expect(contradictions[0].details).toEqual({
      claimA: { text: 'Tasks were faster', documentId: 'docA', filename: 'study-a.pdf', pageNumber: 3 },
      claimB: { text: 'No change in speed', documentId: 'docB', filename: 'survey-b.txt', pageNumber: null },
      possibleExplanation: 'Measured versus self-reported speed.',
    });
    expect(contradictions[0].evidence.map((e) => e.support)).toEqual(['supporting', 'contradicting']);
  });

  it('gives a research gap its rationale, without source ids', () => {
    const { insights } = groundInsights(insightsReply(), sourcesById);
    expect(insights.find((i) => i.type === 'research_gap').details).toEqual({ rationale: 'Both sources are short.' });
  });
});

describe('groundMatrix', () => {
  const documents = [
    { documentId: 'docA', filename: 'study-a.pdf' },
    { documentId: 'docB', filename: 'survey-b.txt' },
  ];
  const matrixOf = (rows) => groundMatrix(matrixReplySchema.parse({ rows }), sourcesById, documents);

  it('has a cell for every claim × document, in column order', () => {
    const matrix = matrixOf([
      {
        claim: 'AI speeds up routine work',
        cells: [
          { source: 'S2', status: 'contradicting', note: 'No change reported (S2).', quote: 'no change in overall task speed' },
          { source: 'S1', status: 'supporting', note: 'Faster.', quote: 'finished routine tasks 26% faster' },
        ],
      },
      { claim: 'Gains shrink on complex work', cells: [{ source: 'S1', status: 'supporting', quote: 'Gains were smaller for complex tasks' }] },
    ]);
    expect(matrix.sources).toEqual(documents);
    expect(matrix.rows[0]).toEqual({
      id: 'row-1',
      claim: 'AI speeds up routine work',
      cells: [
        { documentId: 'docA', status: 'supporting', note: 'Faster.', quote: 'finished routine tasks 26% faster', pageNumber: 3 },
        { documentId: 'docB', status: 'contradicting', note: 'No change reported.', quote: 'no change in overall task speed', pageNumber: null },
      ],
    });
    expect(matrix.rows[1].cells[0]).toMatchObject({ status: 'supporting', pageNumber: 4 });
    expect(matrix.rows[1].cells[1]).toEqual({ documentId: 'docB', status: 'no_evidence', note: '', quote: '', pageNumber: null });
  });

  it('drops a claim no known source backs, and marks mixed evidence unclear', () => {
    const matrix = matrixOf([
      { claim: 'Unsupported', cells: [{ source: 'S7', status: 'supporting' }] },
      {
        claim: 'Mixed',
        cells: [
          { source: 'S1', status: 'supporting' },
          { source: 'S1', status: 'contradicting' },
        ],
      },
    ]);
    expect(matrix.rows.map((r) => r.claim)).toEqual(['Mixed']);
    expect(matrix.rows[0].id).toBe('row-1');
    expect(matrix.rows[0].cells[0].status).toBe('unclear');
  });

  it('removes a quote that is not in the source', () => {
    const matrix = matrixOf([{ claim: 'Claim', cells: [{ source: 'S1', status: 'supporting', quote: 'productivity tripled overnight' }] }]);
    expect(matrix.rows[0].cells[0]).toMatchObject({ quote: '', pageNumber: 3 });
  });
});

describe('sanitizeCitations', () => {
  const known = new Map([
    ['S1', new Set([3, 4])],
    ['S2', new Set()],
  ]);

  it('keeps real citations and removes invented sources and pages', () => {
    expect(sanitizeCitations('Faster [S1, p. 3].', known)).toBe('Faster [S1, p. 3].');
    expect(sanitizeCitations('Invented [S9, p. 2].', known)).toBe('Invented.');
    expect(sanitizeCitations('Wrong page [S1, p. 99].', known)).toBe('Wrong page [S1].');
    expect(sanitizeCitations('Both [S1, p. 4; S2] and [S1, S2, S8].', known)).toBe('Both [S1, p. 4; S2] and [S1; S2].');
  });
});

describe('composeBrief', () => {
  it('writes the sections in order, with sources and matrix from stored data', () => {
    const labels = new Map([
      ['docA', 'S1'],
      ['docB', 'S2'],
    ]);
    const markdown = composeBrief({
      project: { title: 'AI study', researchQuestion: 'Does AI help?' },
      analysis: {
        sources: [
          { documentId: 'docA', filename: 'study_a.pdf' },
          { documentId: 'docB', filename: 'survey-b.txt' },
        ],
        coverage: 'full-corpus',
        matrix: {
          sources: [{ documentId: 'docA' }, { documentId: 'docB' }],
          rows: [
            {
              claim: 'AI | speeds work',
              cells: [
                { documentId: 'docA', status: 'supporting', pageNumber: 3 },
                { documentId: 'docB', status: 'no_evidence', pageNumber: null },
              ],
            },
          ],
        },
      },
      reply: {
        executiveSummary: 'Evidence suggests gains [S1, p. 3] [S5].',
        keyFindings: ['Faster routine work [S1, p. 3].'],
        evidence: 'One study.',
        conflictingFindings: [],
        researchGaps: ['Long-term effects.'],
        limitations: ['Small corpus.'],
        conclusion: 'Tentative.',
      },
      labels,
      known: new Map([
        ['S1', new Set([3])],
        ['S2', new Set()],
      ]),
    });

    const headings = markdown.match(/^## .+$/gm);
    expect(headings).toEqual([
      '## Executive Summary',
      '## Research Question',
      '## Key Findings',
      '## Evidence',
      '## Conflicting Findings',
      '## Research Gaps',
      '## Limitations',
      '## Conclusion',
      '## Sources',
    ]);
    expect(markdown).toMatch(/^# Research Brief: AI study/);
    expect(markdown).toContain('Evidence suggests gains [S1, p. 3].');
    expect(markdown).not.toContain('S5');
    expect(markdown).toContain('| AI \\| speeds work | Supports, p. 3 | — |');
    expect(markdown).toContain('_No potential contradictions were identified between the sources._');
    expect(markdown).toContain('- **S1**: study\\_a.pdf');
    expect(markdown).toMatch(/generated by AI from 2 uploaded sources/);
  });
});

describe('selectChunks for a whole-corpus analysis', () => {
  it('gives every document at least one chunk when the corpus is too big', () => {
    const chunk = (doc, i, text) => ({ documentId: doc, chunkIndex: i, text });
    const chunks = [
      ...Array.from({ length: 6 }, (_, i) => chunk('big', i, `productivity productivity gains ${'x'.repeat(90)}`)),
      chunk('quiet', 0, `unrelated wording only ${'y'.repeat(90)}`),
    ];
    const { chunks: picked } = selectChunks(chunks, 'productivity', {
      budgetChars: 350,
      perDocumentCap: 3,
      everyDocument: true,
    });
    expect(picked.some((c) => c.documentId === 'quiet')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

const app = createApp();

const STUDY_PAGES = [
  'DEMO DATA. Developers finished routine tasks faster with the assistant.',
  'Complex tasks improved less than routine ones.',
];
const SURVEY_TEXT = 'DEMO DATA. Survey respondents reported no change in task speed overall.';

// The excerpt id the prompt gave a file, e.g. "S2".
const idOf = (prompt, filename) => new RegExp(`<source id="(S\\d+)" file="${filename}"`).exec(prompt)?.[1];

describe('analysis API', () => {
  let alice;
  let bob;
  let project;
  let calls;

  const reply = (value) => ({ model: 'fake-1', text: JSON.stringify(value) });

  // A fake model that answers each of the three analysis prompts, including
  // some mistakes the backend must catch.
  const fakeAnalyst = () => ({
    name: 'fake',
    model: 'fake-1',
    async complete({ prompt }) {
      if (prompt.includes('Write a research brief')) {
        calls.brief.push(prompt);
        return reply({
          executiveSummary: 'Evidence suggests routine work got faster [S1, p. 1] while a survey saw no change [S2]. Invented [S7, p. 2].',
          keyFindings: ['Routine tasks were faster [S1, p. 1].', 'Complex tasks improved less [S1, p. 99].'],
          evidence: 'One field study and one survey.',
          conflictingFindings: ['The study and the survey disagree on speed [S1, p. 1; S2].'],
          researchGaps: ['No long-term data.'],
          limitations: ['Two small DEMO DATA sources.'],
          conclusion: 'Evidence suggests modest gains.',
        });
      }
      const s = idOf(prompt, 'field-study.pdf');
      const v = idOf(prompt, 'survey.txt');
      if (prompt.includes('Build an evidence matrix')) {
        calls.matrix.push(prompt);
        return reply({
          rows: [
            {
              claim: 'AI speeds up routine work',
              cells: [
                { source: s, status: 'supporting', note: 'Routine tasks were faster.', quote: 'finished routine tasks faster' },
                { source: v, status: 'contradicting', note: 'No change in speed.', quote: 'reported no change in task speed' },
              ],
            },
            {
              claim: 'Complex work benefits less',
              cells: [{ source: s, status: 'supporting', note: 'Smaller gains.', quote: 'Complex tasks improved less' }],
            },
            { claim: 'Invented claim', cells: [{ source: 'S42', status: 'supporting' }] },
          ],
        });
      }
      calls.insights.push(prompt);
      return reply({
        keyFindings: [
          {
            title: 'Routine tasks got faster',
            description: 'A field study reports faster routine work.',
            confidence: 95,
            evidence: [
              { claim: 'Routine tasks finished faster', source: s, quote: 'finished routine tasks faster', support: 'supporting' },
              { claim: 'Complex tasks improved less', source: s, quote: 'Complex tasks improved less', support: 'unclear' },
            ],
          },
          { title: 'Made-up finding', confidence: 90, evidence: [{ claim: 'x', source: 'S99', support: 'supporting' }] },
        ],
        themes: [
          {
            title: 'Task complexity',
            description: 'Gains depend on the task.',
            confidence: 70,
            evidence: [{ claim: 'Complex tasks gained less', source: s, quote: 'Complex tasks improved less', support: 'supporting' }],
          },
        ],
        contradictions: [
          {
            title: 'Whether AI speeds up work',
            description: 'Measured and reported speed differ.',
            claimA: { text: 'Developers were faster', source: s, quote: 'finished routine tasks faster' },
            claimB: { text: 'Respondents saw no change', source: v, quote: 'reported no change in task speed' },
            possibleExplanation: 'Measured versus self-reported speed.',
            confidence: 70,
          },
        ],
        researchGaps: [
          { title: 'Long-term effects', description: 'Matters for adoption.', rationale: 'Both sources are short.', confidence: 90, evidence: [] },
        ],
        unansweredQuestions: [{ title: 'Does code quality change?', description: 'Needs defect data.', confidence: 40, evidence: [] }],
      });
    },
  });

  const failing = (kind = 'rate_limited') => ({
    name: 'fake',
    model: 'fake-1',
    async complete() {
      throw new AIProviderError(kind, 'nope');
    },
  });

  const api = (auth, method, path) => request(app)[method](`/api/research/${project.id}${path}`).set(auth);
  const analyze = (auth = alice.auth) => api(auth, 'post', '/analyze');

  async function upload(name, content) {
    const res = await request(app)
      .post(`/api/projects/${project.id}/documents`)
      .set(alice.auth)
      .attach('files', content, name);
    await whenIdle();
    return res.body.documents[0];
  }
  const addSources = async () => {
    const pdf = await upload('field-study.pdf', makePdf(STUDY_PAGES));
    const txt = await upload('survey.txt', Buffer.from(SURVEY_TEXT));
    return { pdf, txt };
  };

  beforeAll(startTestDB);
  afterAll(stopTestDB);
  beforeEach(async () => {
    await whenIdle();
    await clearTestDB();
    calls = { insights: [], matrix: [], brief: [] };
    setProviderForTesting(null); // no summaries during setup uploads
    alice = await registerUser(app);
    bob = await registerUser(app);
    const res = await request(app)
      .post('/api/projects')
      .set(alice.auth)
      .send({ title: 'AI study', researchQuestion: 'How does AI affect developer productivity?' });
    project = res.body.project;
  });
  afterEach(resetProvider);

  it('returns empty results before any analysis', async () => {
    expect(project).toMatchObject({ analyzedAt: null, analysisInProgress: false });

    const insights = await api(alice.auth, 'get', '/insights');
    expect(insights.body).toEqual({ insights: [], analyzedAt: null, outdated: false });
    expect((await api(alice.auth, 'get', '/evidence')).body).toEqual({ matrix: null, analyzedAt: null, outdated: false });
    expect((await api(alice.auth, 'get', '/gaps')).body).toEqual({ gaps: [], analyzedAt: null, outdated: false });

    const brief = await api(alice.auth, 'get', '/brief');
    expect(brief.status).toBe(409);
    expect(brief.body.error.code).toBe('ANALYSIS_REQUIRED');
  });

  it('needs at least one ready source', async () => {
    setProviderForTesting(fakeAnalyst());
    const res = await analyze();
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NO_READY_SOURCES');
  });

  it('analyses the corpus into grounded insights and an evidence matrix', async () => {
    const { pdf, txt } = await addSources();
    setProviderForTesting(fakeAnalyst());

    const res = await analyze();
    expect(res.status).toBe(200);
    expect(res.body.analysis).toMatchObject({
      sourceCount: 2,
      counts: { key_finding: 1, theme: 1, contradiction: 1, research_gap: 1, unanswered_question: 1 },
    });

    // Both prompts saw both files, with the research question.
    for (const prompt of [calls.insights[0], calls.matrix[0]]) {
      expect(prompt).toContain('How does AI affect developer productivity?');
      expect(prompt).toContain('- field-study.pdf: S1');
      expect(prompt).toContain('- survey.txt: S2');
    }

    const projectRes = await request(app).get(`/api/projects/${project.id}`).set(alice.auth);
    expect(projectRes.body.project).toMatchObject({
      status: 'analyzed',
      analyzedAt: res.body.analysis.analyzedAt,
      analysisInProgress: false,
      stats: { sourceCount: 2, insightCount: 4, gapCount: 1 },
    });

    const { body } = await api(alice.auth, 'get', '/insights');
    expect(body.outdated).toBe(false);
    expect(body.analyzedAt).toBe(res.body.analysis.analyzedAt);
    expect(body.insights.map((i) => i.type)).toEqual([
      'key_finding',
      'theme',
      'contradiction',
      'research_gap',
      'unanswered_question',
    ]);
    const [finding, , contradiction] = body.insights;
    expect(finding).toMatchObject({
      projectId: project.id,
      title: 'Routine tasks got faster',
      confidence: 75,
      details: null,
      evidence: [
        { claim: 'Routine tasks finished faster', documentId: pdf.id, filename: 'field-study.pdf', pageNumber: 1, quote: 'finished routine tasks faster' },
        { claim: 'Complex tasks improved less', documentId: pdf.id, pageNumber: 2 },
      ],
    });
    expect(finding.id).toBeTruthy();
    expect(contradiction.details).toEqual({
      claimA: { text: 'Developers were faster', documentId: pdf.id, filename: 'field-study.pdf', pageNumber: 1 },
      claimB: { text: 'Respondents saw no change', documentId: txt.id, filename: 'survey.txt', pageNumber: null },
      possibleExplanation: 'Measured versus self-reported speed.',
    });

    const matrix = (await api(alice.auth, 'get', '/evidence')).body.matrix;
    expect(matrix.sources).toEqual([
      { documentId: pdf.id, filename: 'field-study.pdf' },
      { documentId: txt.id, filename: 'survey.txt' },
    ]);
    expect(matrix.rows.map((r) => r.claim)).toEqual(['AI speeds up routine work', 'Complex work benefits less']);
    expect(matrix.rows[0].cells.map((c) => c.status)).toEqual(['supporting', 'contradicting']);
    expect(matrix.rows[1].cells).toEqual([
      { documentId: pdf.id, status: 'supporting', note: 'Smaller gains.', quote: 'Complex tasks improved less', pageNumber: 2 },
      { documentId: txt.id, status: 'no_evidence', note: '', quote: '', pageNumber: null },
    ]);
  });

  it('filters insights by type and lists gaps', async () => {
    await addSources();
    setProviderForTesting(fakeAnalyst());
    await analyze();

    const themes = await api(alice.auth, 'get', '/insights?type=theme');
    expect(themes.body.insights.map((i) => i.title)).toEqual(['Task complexity']);

    const gaps = await api(alice.auth, 'get', '/gaps');
    expect(gaps.body.gaps).toHaveLength(1);
    expect(gaps.body.gaps[0]).toMatchObject({
      type: 'research_gap',
      title: 'Long-term effects',
      confidence: 60,
      details: { rationale: 'Both sources are short.' },
    });

    const bad = await api(alice.auth, 'get', '/insights?type=nonsense');
    expect(bad.status).toBe(400);
    expect(bad.body.error.details[0].field).toBe('type');
  });

  it('replaces the previous analysis when run again', async () => {
    await addSources();
    setProviderForTesting(fakeAnalyst());
    await analyze();
    await analyze();
    expect(await Insight.countDocuments({ projectId: project.id })).toBe(5);
  });

  it('flags the analysis as outdated when sources change, until it is re-run', async () => {
    const { txt } = await addSources();
    setProviderForTesting(fakeAnalyst());
    await analyze();

    await request(app).delete(`/api/documents/${txt.id}`).set(alice.auth);
    const after = await api(alice.auth, 'get', '/insights');
    expect(after.body.outdated).toBe(true);
    expect(after.body.insights.length).toBeGreaterThan(0); // old results stay visible
    expect((await api(alice.auth, 'get', '/evidence')).body.outdated).toBe(true);
    expect((await Project.findById(project.id)).status).toBe('active');

    await upload('survey.txt', Buffer.from(SURVEY_TEXT));
    await analyze();
    expect((await api(alice.auth, 'get', '/insights')).body.outdated).toBe(false);
    expect((await Project.findById(project.id)).status).toBe('analyzed');
  });

  it('refuses a second run while one is in progress, but not a stale one', async () => {
    await addSources();
    setProviderForTesting(fakeAnalyst());

    await Project.updateOne({ _id: project.id }, { analysisStartedAt: new Date() });
    const busy = await analyze();
    expect(busy.status).toBe(409);
    expect(busy.body.error.code).toBe('ANALYSIS_IN_PROGRESS');
    const running = await request(app).get(`/api/projects/${project.id}`).set(alice.auth);
    expect(running.body.project.analysisInProgress).toBe(true);

    // A lock left by a crashed run expires.
    await Project.updateOne({ _id: project.id }, { analysisStartedAt: new Date(Date.now() - 6 * 60 * 1000) });
    expect((await analyze()).status).toBe(200);
    expect((await Project.findById(project.id)).analysisStartedAt).toBeNull();
  });

  it('keeps the previous analysis and releases the lock when the AI fails', async () => {
    await addSources();
    setProviderForTesting(fakeAnalyst());
    await analyze();

    setProviderForTesting(failing('rate_limited'));
    const res = await analyze();
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('AI_RATE_LIMITED');
    expect(await Insight.countDocuments({ projectId: project.id })).toBe(5);
    expect((await Project.findById(project.id)).analysisStartedAt).toBeNull();
  });

  it('fails cleanly when the AI finds nothing it can back with evidence', async () => {
    await addSources();
    setProviderForTesting({
      name: 'fake',
      model: 'fake-1',
      async complete() {
        return reply({ keyFindings: [{ title: 'Unbacked', evidence: [{ claim: 'x', source: 'S50' }] }], rows: [] });
      },
    });
    const res = await analyze();
    expect(res.status).toBe(502);
    expect(res.body.error.code).toBe('AI_BAD_RESPONSE');
    expect(await Insight.countDocuments()).toBe(0);
  });

  it('writes the research brief once, with only real citations', async () => {
    await addSources();
    setProviderForTesting(fakeAnalyst());
    await analyze();

    const [first, second] = await Promise.all([api(alice.auth, 'get', '/brief'), api(alice.auth, 'get', '/brief')]);
    expect(first.status).toBe(200);
    expect(second.body.brief).toEqual(first.body.brief);
    expect(calls.brief).toHaveLength(1); // parallel requests share one generation

    const { brief, outdated } = first.body;
    expect(outdated).toBe(false);
    expect(brief.title).toBe('AI study');
    expect(brief.sources).toEqual([
      { label: 'S1', documentId: expect.any(String), filename: 'field-study.pdf' },
      { label: 'S2', documentId: expect.any(String), filename: 'survey.txt' },
    ]);
    expect(brief.markdown).toMatch(/^# Research Brief: AI study/);
    expect(brief.markdown).toContain('Evidence suggests routine work got faster [S1, p. 1] while a survey saw no change [S2]. Invented.');
    expect(brief.markdown).toContain('Complex tasks improved less [S1].'); // page 99 was never cited
    expect(brief.markdown).not.toContain('S7');
    expect(brief.markdown).toContain('- **S1**: field-study.pdf\n- **S2**: survey.txt');
    expect(brief.markdown).toContain('| AI speeds up routine work | Supports, p. 1 | Contradicts |');

    // The brief writer saw the verified analysis, not raw source text.
    expect(calls.brief[0]).toContain('S1 = field-study.pdf');
    expect(calls.brief[0]).toContain('Routine tasks finished faster [S1, p. 1]');
    expect(calls.brief[0]).not.toContain('<source');

    // Cached until the next analysis.
    await api(alice.auth, 'get', '/brief');
    expect(calls.brief).toHaveLength(1);
    await analyze();
    await api(alice.auth, 'get', '/brief');
    expect(calls.brief).toHaveLength(2);
  });

  it("refuses another user's project on every analysis endpoint", async () => {
    await addSources();
    setProviderForTesting(fakeAnalyst());
    await analyze();

    for (const [method, path] of [
      ['post', '/analyze'],
      ['get', '/insights'],
      ['get', '/evidence'],
      ['get', '/gaps'],
      ['get', '/brief'],
    ]) {
      const res = await api(bob.auth, method, path);
      expect(res.status, `${method} ${path}`).toBe(404);
    }
    const unauthenticated = await request(app).get(`/api/research/${project.id}/insights`);
    expect(unauthenticated.status).toBe(401);
  });

  it('deleting the project removes its analysis', async () => {
    await addSources();
    setProviderForTesting(fakeAnalyst());
    await analyze();
    await request(app).delete(`/api/projects/${project.id}`).set(alice.auth);
    const { Analysis } = await import('../src/models/Analysis.js');
    expect(await Analysis.countDocuments()).toBe(0);
    expect(await Insight.countDocuments()).toBe(0);
  });
});
