import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { Document } from '../src/models/Document.js';
import { whenIdle } from '../src/services/document.service.js';
import { resetProvider, setProviderForTesting } from '../src/services/llm.service.js';
import { AIProviderError } from '../src/services/llm.errors.js';
import { startTestDB, clearTestDB, stopTestDB } from './helpers/db.js';
import { registerUser } from './helpers/auth.js';

const app = createApp();
const text = Buffer.from('DEMO DATA. Developers finished routine tasks faster with an AI assistant in a four week study.');

describe('AI summaries during processing', () => {
  let user;
  let project;

  beforeAll(startTestDB);
  afterAll(stopTestDB);
  beforeEach(async () => {
    await whenIdle();
    await clearTestDB();
    user = await registerUser(app);
    const res = await request(app)
      .post('/api/projects')
      .set(user.auth)
      .send({ title: 'AI study', researchQuestion: 'Does AI help developers?' });
    project = res.body.project;
  });
  afterEach(resetProvider);

  const upload = () =>
    request(app).post(`/api/projects/${project.id}/documents`).set(user.auth).attach('files', text, 'study.txt');

  it('passes through "analyzing" and stores the AI summary', async () => {
    const statusesSeen = [];
    const prompts = [];
    setProviderForTesting({
      name: 'fake',
      model: 'fake-1',
      async complete(req) {
        prompts.push(req.prompt);
        const doc = await Document.findOne({ filename: 'study.txt' });
        statusesSeen.push(doc.processingStatus);
        return { text: '{"summary":"A four-week study finding faster routine task completion with an AI assistant."}', model: 'fake-1' };
      },
    });

    await upload();
    await whenIdle();

    expect(statusesSeen).toEqual(['analyzing']);
    expect(prompts[0]).toContain('Developers finished routine tasks faster');
    const { body } = await request(app).get(`/api/projects/${project.id}/documents`).set(user.auth);
    expect(body.documents[0]).toMatchObject({
      processingStatus: 'ready',
      summary: 'A four-week study finding faster routine task completion with an AI assistant.',
    });
  });

  it('still makes the document ready when the AI fails', async () => {
    setProviderForTesting({
      name: 'fake',
      model: 'fake-1',
      async complete() {
        throw new AIProviderError('rate_limited', 'quota');
      },
    });

    await upload();
    await whenIdle();

    const doc = await Document.findOne({ filename: 'study.txt' });
    expect(doc).toMatchObject({ processingStatus: 'ready', summary: '' });
  });

  it('skips summaries when no AI provider is configured', async () => {
    setProviderForTesting(null);
    await upload();
    await whenIdle();
    const doc = await Document.findOne({ filename: 'study.txt' });
    expect(doc).toMatchObject({ processingStatus: 'ready', summary: '' });
  });

  it('reports AI status to signed-in users without exposing keys', async () => {
    const off = await request(app).get('/api/ai/status').set(user.auth);
    expect(off.body.ai).toEqual({ configured: false, provider: 'gemini', model: null });

    setProviderForTesting({ name: 'gemini', model: 'gemini-2.5-flash', complete: async () => ({}) });
    const on = await request(app).get('/api/ai/status').set(user.auth);
    expect(on.body.ai).toEqual({ configured: true, provider: 'gemini', model: 'gemini-2.5-flash' });

    const anonymous = await request(app).get('/api/ai/status');
    expect(anonymous.status).toBe(401);
  });
});
