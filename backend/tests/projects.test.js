import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { Project } from '../src/models/Project.js';
import { Document } from '../src/models/Document.js';
import { DocumentChunk } from '../src/models/DocumentChunk.js';
import { Insight } from '../src/models/Insight.js';
import { Conversation } from '../src/models/Conversation.js';
import { startTestDB, clearTestDB, stopTestDB } from './helpers/db.js';
import { registerUser } from './helpers/auth.js';

const app = createApp();
const sample = {
  title: 'Impact of Generative AI on Software Developer Productivity',
  researchQuestion:
    'How does generative AI affect developer productivity, code quality, and developer satisfaction?',
  description: 'Hackathon demo project',
};

const create = (auth, body = sample) => request(app).post('/api/projects').set(auth).send(body);

async function seedChildren(project, userId) {
  const doc = await Document.create({
    projectId: project.id,
    userId,
    filename: 'source-a.pdf',
    fileType: 'pdf',
    fileSize: 1024,
    processingStatus: 'ready',
  });
  await DocumentChunk.create({
    documentId: doc._id,
    projectId: project.id,
    chunkIndex: 0,
    text: 'chunk',
  });
  await Insight.create([
    { projectId: project.id, type: 'key_finding', title: 'Finding' },
    { projectId: project.id, type: 'contradiction', title: 'Conflict' },
    { projectId: project.id, type: 'research_gap', title: 'Gap' },
  ]);
  await Conversation.create({
    projectId: project.id,
    userId,
    question: 'Q?',
    response: { answer: 'A' },
  });
}

describe('research projects', () => {
  let alice;
  let bob;

  beforeAll(startTestDB);
  afterAll(stopTestDB);
  beforeEach(async () => {
    await clearTestDB();
    alice = await registerUser(app, { name: 'Alice' });
    bob = await registerUser(app, { name: 'Bob' });
  });

  it('requires authentication on every route', async () => {
    const id = new mongoose.Types.ObjectId().toString();
    const responses = await Promise.all([
      request(app).get('/api/projects'),
      request(app).post('/api/projects').send(sample),
      request(app).get(`/api/projects/${id}`),
      request(app).delete(`/api/projects/${id}`),
    ]);
    for (const res of responses) expect(res.status).toBe(401);
  });

  describe('POST /api/projects', () => {
    it('creates a draft project owned by the caller with zero stats', async () => {
      const res = await create(alice.auth);
      expect(res.status).toBe(201);
      expect(res.body.project).toMatchObject({
        ...sample,
        status: 'draft',
        userId: alice.user.id,
        stats: { sourceCount: 0, insightCount: 0, gapCount: 0 },
      });
      expect(res.body.project.id).toEqual(expect.any(String));
    });

    it('ignores a client-supplied userId and status', async () => {
      const res = await create(alice.auth, { ...sample, userId: bob.user.id, status: 'analyzed' });
      expect(res.status).toBe(201);
      expect(res.body.project.userId).toBe(alice.user.id);
      expect(res.body.project.status).toBe('draft');
    });

    it('trims input and defaults the description', async () => {
      const res = await create(alice.auth, {
        title: '  My study  ',
        researchQuestion: '  Does X affect Y?  ',
      });
      expect(res.status).toBe(201);
      expect(res.body.project).toMatchObject({
        title: 'My study',
        researchQuestion: 'Does X affect Y?',
        description: '',
      });
    });

    it('returns field errors for invalid input', async () => {
      const res = await create(alice.auth, {
        title: 'ab',
        researchQuestion: 'short',
        description: 'x'.repeat(2001),
      });
      expect(res.status).toBe(400);
      expect(res.body.error.details.map((d) => d.field).sort()).toEqual([
        'description',
        'researchQuestion',
        'title',
      ]);
    });
  });

  describe('GET /api/projects', () => {
    it("lists only the caller's projects, most recently updated first", async () => {
      await create(alice.auth, { ...sample, title: 'Older study' });
      await new Promise((r) => setTimeout(r, 15));
      await create(alice.auth, { ...sample, title: 'Newer study' });
      await create(bob.auth, { ...sample, title: 'Bob study' });

      const res = await request(app).get('/api/projects').set(alice.auth);
      expect(res.status).toBe(200);
      expect(res.body.projects.map((p) => p.title)).toEqual(['Newer study', 'Older study']);
    });

    it('includes source, insight and gap counts per project', async () => {
      const { body } = await create(alice.auth);
      await create(alice.auth, { ...sample, title: 'Empty study' });
      await seedChildren(body.project, alice.user.id);

      const res = await request(app).get('/api/projects').set(alice.auth);
      const byTitle = Object.fromEntries(res.body.projects.map((p) => [p.title, p.stats]));
      expect(byTitle[sample.title]).toEqual({ sourceCount: 1, insightCount: 2, gapCount: 1 });
      expect(byTitle['Empty study']).toEqual({ sourceCount: 0, insightCount: 0, gapCount: 0 });
    });

    it('returns an empty list for a new user', async () => {
      const res = await request(app).get('/api/projects').set(bob.auth);
      expect(res.body.projects).toEqual([]);
    });
  });

  describe('GET /api/projects/:id', () => {
    it("returns the caller's project with stats", async () => {
      const { body } = await create(alice.auth);
      await seedChildren(body.project, alice.user.id);
      const res = await request(app).get(`/api/projects/${body.project.id}`).set(alice.auth);
      expect(res.status).toBe(200);
      expect(res.body.project).toMatchObject({ id: body.project.id, stats: { sourceCount: 1 } });
    });

    it("hides another user's project behind a 404", async () => {
      const { body } = await create(alice.auth);
      const res = await request(app).get(`/api/projects/${body.project.id}`).set(bob.auth);
      expect(res.status).toBe(404);
      expect(res.body.error.message).toBe('Research project not found');
    });

    it('returns 404 for an unknown id and 400 for a malformed one', async () => {
      const unknownId = new mongoose.Types.ObjectId().toString();
      const unknown = await request(app).get(`/api/projects/${unknownId}`).set(alice.auth);
      expect(unknown.status).toBe(404);

      const malformed = await request(app).get('/api/projects/not-an-id').set(alice.auth);
      expect(malformed.status).toBe(400);
      expect(malformed.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /api/projects/:id', () => {
    it('deletes the project and everything derived from it', async () => {
      const { body } = await create(alice.auth);
      const { body: other } = await create(alice.auth, { ...sample, title: 'Keep me' });
      await seedChildren(body.project, alice.user.id);
      await seedChildren(other.project, alice.user.id);

      const res = await request(app).delete(`/api/projects/${body.project.id}`).set(alice.auth);
      expect(res.status).toBe(204);

      const gone = { projectId: body.project.id };
      expect(await Project.exists({ _id: body.project.id })).toBeNull();
      expect(await Document.countDocuments(gone)).toBe(0);
      expect(await DocumentChunk.countDocuments(gone)).toBe(0);
      expect(await Insight.countDocuments(gone)).toBe(0);
      expect(await Conversation.countDocuments(gone)).toBe(0);

      // The other project's data is untouched.
      const kept = { projectId: other.project.id };
      expect(await Document.countDocuments(kept)).toBe(1);
      expect(await Insight.countDocuments(kept)).toBe(3);
    });

    it("refuses to delete another user's project and leaves it intact", async () => {
      const { body } = await create(alice.auth);
      await seedChildren(body.project, alice.user.id);

      const res = await request(app).delete(`/api/projects/${body.project.id}`).set(bob.auth);
      expect(res.status).toBe(404);
      expect(await Project.exists({ _id: body.project.id })).not.toBeNull();
      expect(await Document.countDocuments({ projectId: body.project.id })).toBe(1);
    });
  });
});
