import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { Conversation } from '../src/models/Conversation.js';
import { whenIdle } from '../src/services/document.service.js';
import { findQuote, groundReply } from '../src/services/research.service.js';
import { resetProvider, setProviderForTesting } from '../src/services/llm.service.js';
import { AIProviderError } from '../src/services/llm.errors.js';
import { INSUFFICIENT_EVIDENCE_ANSWER } from '../src/services/prompts/qa.prompt.js';
import { startTestDB, clearTestDB, stopTestDB } from './helpers/db.js';
import { registerUser } from './helpers/auth.js';
import { makePdf } from './helpers/fixtures.js';

// ---------------------------------------------------------------------------
// Grounding checks (pure)
// ---------------------------------------------------------------------------

const chunkA = {
  documentId: 'docA',
  filename: 'study-a.pdf',
  pageNumber: 3,
  text: 'Developers finished routine tasks 26% faster. Gains were smaller for complex tasks.',
  metadata: {
    pageStarts: [
      { offset: 0, pageNumber: 3 },
      { offset: 46, pageNumber: 4 },
    ],
  },
};
const chunkB = {
  documentId: 'docB',
  filename: 'survey-b.txt',
  pageNumber: null,
  text: 'Most respondents said AI tools reduced tedious work.',
  metadata: {},
};
const sources = new Map([
  ['S1', chunkA],
  ['S2', chunkB],
]);

const reply = (overrides = {}) => ({
  answer: 'Evidence suggests AI tools speed up routine work (S1), with smaller gains on complex tasks [S1, S2].',
  keyFindings: ['Routine tasks were faster (S1).'],
  evidence: [
    { claim: 'Routine tasks were 26% faster', source: 'S1', quote: 'finished routine tasks 26% faster', support: 'supporting' },
    { claim: 'Complex tasks gained less', source: 's1', quote: 'Gains were smaller for complex tasks', support: 'unclear' },
    { claim: 'Respondents found work less tedious', source: 'S2', quote: 'reduced tedious work', support: 'supporting' },
  ],
  confidence: 95,
  limitations: ['Only two sources (S1, S2).'],
  insufficientEvidence: false,
  ...overrides,
});

describe('findQuote', () => {
  it('matches despite case, punctuation, curly quotes and line breaks', () => {
    expect(findQuote('He said “AI helps,\nmostly” today.', 'ai helps mostly')).toBe(9);
    expect(findQuote('Short text.', 'not present at all')).toBe(-1);
    expect(findQuote('Anything', 'tiny')).toBe(-1);
  });
});

describe('groundReply', () => {
  it('fills in file names and pages from the source, and finds the page of each quote', () => {
    const out = groundReply(reply(), sources);
    expect(out.evidence).toEqual([
      { claim: 'Routine tasks were 26% faster', sourceId: 'docA', sourceName: 'study-a.pdf', page: 3, quote: 'finished routine tasks 26% faster', support: 'supporting' },
      { claim: 'Complex tasks gained less', sourceId: 'docA', sourceName: 'study-a.pdf', page: 4, quote: 'Gains were smaller for complex tasks', support: 'unclear' },
      { claim: 'Respondents found work less tedious', sourceId: 'docB', sourceName: 'survey-b.txt', page: null, quote: 'reduced tedious work', support: 'supporting' },
    ]);
  });

  it('removes source ids from the text shown to users', () => {
    const out = groundReply(reply(), sources);
    expect(out.answer).toBe('Evidence suggests AI tools speed up routine work, with smaller gains on complex tasks.');
    expect(out.keyFindings).toEqual(['Routine tasks were faster.']);
    expect(out.limitations).toEqual(['Only two sources.']);
  });

  it('drops evidence that cites a source id it was never given', () => {
    const out = groundReply(
      reply({ evidence: [...reply().evidence, { claim: 'Invented', source: 'S9', quote: 'x', support: 'supporting' }] }),
      sources,
    );
    expect(out.evidence.map((e) => e.claim)).not.toContain('Invented');
  });

  it('removes a quote that is not in the cited source but keeps the claim', () => {
    const out = groundReply(
      reply({ evidence: [{ claim: 'Faster work', source: 'S1', quote: 'productivity doubled overnight', support: 'supporting' }] }),
      sources,
    );
    expect(out.evidence[0]).toMatchObject({ claim: 'Faster work', quote: '', page: 3 });
  });

  it('caps confidence by how much independent evidence there is', () => {
    expect(groundReply(reply(), sources).confidence).toBe(85); // 2 sources, all quotes verified
    const oneSource = groundReply(reply({ evidence: [reply().evidence[0]] }), sources);
    expect(oneSource.confidence).toBe(75);
    expect(groundReply(reply({ confidence: 40 }), sources).confidence).toBe(40);
  });

  it('reports insufficient evidence in the standard form', () => {
    const out = groundReply(
      reply({ insufficientEvidence: true, limitations: ['No source discusses cost.'] }),
      sources,
    );
    expect(out).toEqual({
      answer: INSUFFICIENT_EVIDENCE_ANSWER,
      keyFindings: [],
      evidence: [],
      confidence: 0,
      limitations: ['No source discusses cost.'],
      insufficientEvidence: true,
    });
  });

  it('refuses to present an answer that has no valid evidence', () => {
    const out = groundReply(
      reply({ evidence: [{ claim: 'Made up', source: 'S7', quote: '', support: 'supporting' }], limitations: [] }),
      sources,
    );
    expect(out.insufficientEvidence).toBe(true);
    expect(out.answer).toBe(INSUFFICIENT_EVIDENCE_ANSWER);
    expect(out.limitations[0]).toMatch(/do not contain evidence/);
  });
});

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

const app = createApp();

describe('research assistant API', () => {
  let alice;
  let bob;
  let project;
  let prompts;

  // A fake model that cites the first source it was given.
  const citingProvider = (answer = 'Evidence suggests routine tasks were faster.') => ({
    name: 'fake',
    model: 'fake-1',
    async complete({ prompt }) {
      prompts.push(prompt);
      return {
        model: 'fake-1',
        text: JSON.stringify({
          answer,
          keyFindings: ['Routine work sped up.'],
          evidence: [
            { claim: 'Routine tasks were finished faster', source: 'S1', quote: 'finished routine tasks faster', support: 'supporting' },
          ],
          confidence: 90,
          limitations: ['Short study.'],
          insufficientEvidence: false,
        }),
      };
    },
  });

  const ask = (auth, question, projectId = project.id) =>
    request(app).post(`/api/research/${projectId}/ask`).set(auth).send({ question });

  async function addSource() {
    await request(app)
      .post(`/api/projects/${project.id}/documents`)
      .set(alice.auth)
      .attach(
        'files',
        makePdf(['DEMO DATA. Developers finished routine tasks faster with the assistant.', 'Complex tasks improved less.']),
        'field-study.pdf',
      );
    await whenIdle();
  }

  beforeAll(startTestDB);
  afterAll(stopTestDB);
  beforeEach(async () => {
    await whenIdle();
    await clearTestDB();
    prompts = [];
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

  it('answers from the sources with verified, page-level citations', async () => {
    await addSource();
    setProviderForTesting(citingProvider());

    const res = await ask(alice.auth, 'Did developers work faster?');
    expect(res.status).toBe(200);
    const { conversation } = res.body;
    expect(conversation).toMatchObject({
      projectId: project.id,
      question: 'Did developers work faster?',
      response: {
        answer: 'Evidence suggests routine tasks were faster.',
        keyFindings: ['Routine work sped up.'],
        confidence: 75,
        limitations: ['Short study.'],
        insufficientEvidence: false,
        evidence: [
          {
            claim: 'Routine tasks were finished faster',
            sourceName: 'field-study.pdf',
            page: 1,
            quote: 'finished routine tasks faster',
            support: 'supporting',
          },
        ],
      },
      sources: [{ filename: 'field-study.pdf', pageNumber: 1 }],
    });
    expect(conversation.userId).toBeUndefined();

    // The prompt carried the question, the research question and the source.
    expect(prompts[0]).toContain('"Did developers work faster?"');
    expect(prompts[0]).toContain('How does AI affect developer productivity?');
    expect(prompts[0]).toMatch(/<source id="S1" file="field-study.pdf" page="1">/);
  });

  it('includes recent questions as context for follow-ups', async () => {
    await addSource();
    setProviderForTesting(citingProvider());
    await ask(alice.auth, 'First question about speed?');
    await ask(alice.auth, 'And what about complex tasks?');

    expect(prompts[1]).toContain('Earlier in this conversation');
    expect(prompts[1]).toContain('Q: First question about speed?');
  });

  it('lists the conversation oldest first, for the project owner only', async () => {
    await addSource();
    setProviderForTesting(citingProvider());
    await ask(alice.auth, 'Question one?');
    await ask(alice.auth, 'Question two?');

    const res = await request(app).get(`/api/research/${project.id}/conversations`).set(alice.auth);
    expect(res.body.conversations.map((c) => c.question)).toEqual(['Question one?', 'Question two?']);

    const other = await request(app).get(`/api/research/${project.id}/conversations`).set(bob.auth);
    expect(other.status).toBe(404);
  });

  it('needs at least one ready source', async () => {
    setProviderForTesting(citingProvider());
    const res = await ask(alice.auth, 'Anything?');
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('NO_READY_SOURCES');
    expect(prompts).toHaveLength(0);
  });

  it('validates the question', async () => {
    const res = await ask(alice.auth, 'a');
    expect(res.status).toBe(400);
    expect(res.body.error.details[0]).toMatchObject({ field: 'question' });
  });

  it("refuses another user's project and saves nothing", async () => {
    await addSource();
    setProviderForTesting(citingProvider());
    const res = await ask(bob.auth, 'Did developers work faster?');
    expect(res.status).toBe(404);
    expect(await Conversation.countDocuments()).toBe(0);
  });

  it('passes AI failures through with their codes and saves nothing', async () => {
    await addSource();
    setProviderForTesting({
      name: 'fake',
      model: 'fake-1',
      async complete() {
        throw new AIProviderError('rate_limited', 'quota');
      },
    });
    const res = await ask(alice.auth, 'Did developers work faster?');
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('AI_RATE_LIMITED');
    expect(await Conversation.countDocuments()).toBe(0);
  });

  it('returns 503 AI_UNAVAILABLE when no AI provider is configured', async () => {
    await addSource();
    const res = await ask(alice.auth, 'Did developers work faster?');
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('AI_UNAVAILABLE');
  });
});
