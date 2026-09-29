import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { Document } from '../src/models/Document.js';
import { DocumentChunk } from '../src/models/DocumentChunk.js';
import { Project } from '../src/models/Project.js';
import { recoverInterruptedDocuments, whenIdle } from '../src/services/document.service.js';
import { startTestDB, clearTestDB, stopTestDB } from './helpers/db.js';
import { registerUser } from './helpers/auth.js';
import { makeDocx, makePdf } from './helpers/fixtures.js';

const app = createApp();

const longParagraph = (topic, n) =>
  Array.from({ length: n }, (_, i) => `Observation ${i} about ${topic} was recorded in the study.`).join(' ');

const files = {
  pdf: () =>
    makePdf([
      'Developers finished routine tasks faster with an AI assistant.',
      'Gains were smaller for complex tasks in unfamiliar code.',
      'Participants reported higher satisfaction overall.',
    ]),
  docx: () => makeDocx([longParagraph('code quality', 40), 'A closing paragraph on review practices.']),
  txt: () => Buffer.from('A plain text survey summary about developer satisfaction and tooling.'),
};

describe('documents', () => {
  let alice;
  let bob;
  let project;

  const upload = (auth, projectId, attachments) => {
    const req = request(app).post(`/api/projects/${projectId}/documents`).set(auth);
    for (const [name, buffer] of attachments) req.attach('files', buffer, name);
    return req;
  };
  const list = (auth, projectId = project.id) =>
    request(app).get(`/api/projects/${projectId}/documents`).set(auth);

  beforeAll(startTestDB);
  afterAll(stopTestDB);
  beforeEach(async () => {
    await whenIdle();
    await clearTestDB();
    alice = await registerUser(app);
    bob = await registerUser(app);
    const res = await request(app)
      .post('/api/projects')
      .set(alice.auth)
      .send({ title: 'AI and productivity', researchQuestion: 'How does AI affect productivity?' });
    project = res.body.project;
  });

  describe('POST /api/projects/:id/documents', () => {
    it('accepts PDF, DOCX and TXT and returns them as processing (202)', async () => {
      const res = await upload(alice.auth, project.id, [
        ['field-study.pdf', files.pdf()],
        ['analysis.docx', files.docx()],
        ['survey.txt', files.txt()],
      ]);

      expect(res.status).toBe(202);
      expect(res.body.documents).toHaveLength(3);
      for (const doc of res.body.documents) {
        expect(doc).toMatchObject({
          projectId: project.id,
          processingStatus: 'processing',
          processingError: '',
          summary: '',
          metadata: { pageCount: null, wordCount: null, chunkCount: null },
        });
        expect(doc.userId).toBeUndefined();
        expect(doc.extractedText).toBeUndefined();
      }
      expect(res.body.documents.map((d) => d.fileType)).toEqual(['pdf', 'docx', 'txt']);
    });

    it('processes files into ready documents with metadata and page-aware chunks', async () => {
      await upload(alice.auth, project.id, [
        ['field-study.pdf', files.pdf()],
        ['analysis.docx', files.docx()],
      ]);
      await whenIdle();

      const { body } = await list(alice.auth);
      const byName = Object.fromEntries(body.documents.map((d) => [d.filename, d]));

      expect(byName['field-study.pdf']).toMatchObject({
        processingStatus: 'ready',
        metadata: { pageCount: 3, chunkCount: 1 },
      });
      expect(byName['field-study.pdf'].metadata.wordCount).toBeGreaterThan(20);
      expect(byName['analysis.docx']).toMatchObject({
        processingStatus: 'ready',
        metadata: { pageCount: null },
      });
      expect(byName['analysis.docx'].metadata.chunkCount).toBeGreaterThan(1);

      const pdfChunks = await DocumentChunk.find({ documentId: byName['field-study.pdf'].id });
      expect(pdfChunks[0]).toMatchObject({ pageNumber: 1, metadata: { pageEnd: 3 } });
      expect(String(pdfChunks[0].projectId)).toBe(project.id);

      const docxChunks = await DocumentChunk.find({ documentId: byName['analysis.docx'].id }).sort('chunkIndex');
      expect(docxChunks.map((c) => c.chunkIndex)).toEqual(docxChunks.map((_, i) => i));
      expect(docxChunks.every((c) => c.pageNumber === null)).toBe(true);
    });

    it('moves the project from draft to active and counts its sources', async () => {
      await upload(alice.auth, project.id, [['survey.txt', files.txt()]]);
      await whenIdle();

      const res = await request(app).get(`/api/projects/${project.id}`).set(alice.auth);
      expect(res.body.project).toMatchObject({ status: 'active', stats: { sourceCount: 1 } });
    });

    it('marks unreadable files as failed with a reason, without chunks', async () => {
      await upload(alice.auth, project.id, [
        ['scanned.pdf', makePdf(['', ''])],
        ['broken.pdf', Buffer.from('%PDF-1.4 truncated nonsense')],
      ]);
      await whenIdle();

      const { body } = await list(alice.auth);
      const byName = Object.fromEntries(body.documents.map((d) => [d.filename, d]));
      expect(byName['scanned.pdf']).toMatchObject({ processingStatus: 'failed' });
      expect(byName['scanned.pdf'].processingError).toMatch(/Scanned PDFs/);
      expect(byName['broken.pdf'].processingError).toMatch(/could not be read/);
      expect(await DocumentChunk.countDocuments({ projectId: project.id })).toBe(0);

      const proj = await request(app).get(`/api/projects/${project.id}`).set(alice.auth);
      expect(proj.body.project.status).toBe('draft');
      // Failed files are not usable sources.
      expect(proj.body.project.stats.sourceCount).toBe(0);
    });

    it('rejects the whole upload, naming each bad file, if any file is invalid', async () => {
      const res = await upload(alice.auth, project.id, [
        ['good.txt', files.txt()],
        ['program.exe', Buffer.from('MZ binary')],
        ['fake.pdf', Buffer.from('not a pdf at all')],
      ]);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('FILE_TYPE_NOT_ALLOWED');
      expect(res.body.error.details).toEqual([
        { field: 'program.exe', message: 'Only PDF, DOCX and TXT files are supported' },
        { field: 'fake.pdf', message: 'This file is not a valid PDF' },
      ]);
      expect(await Document.countDocuments()).toBe(0);
    });

    it('rejects more than 5 files', async () => {
      const six = Array.from({ length: 6 }, (_, i) => [`f${i}.txt`, files.txt()]);
      const res = await upload(alice.auth, project.id, six);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('TOO_MANY_FILES');
      expect(await Document.countDocuments()).toBe(0);
    });

    it('rejects a file over 10 MB with 413, naming it', async () => {
      const big = Buffer.alloc(10 * 1024 * 1024 + 1, 'a');
      const res = await upload(alice.auth, project.id, [
        ['small.txt', files.txt()],
        ['huge.txt', big],
      ]);
      expect(res.status).toBe(413);
      expect(res.body.error).toMatchObject({
        code: 'FILE_TOO_LARGE',
        details: [{ field: 'huge.txt', message: 'Files must be 10 MB or smaller' }],
      });
      expect(await Document.countDocuments()).toBe(0);
    });

    it('requires at least one file', async () => {
      const res = await request(app)
        .post(`/api/projects/${project.id}/documents`)
        .set(alice.auth)
        .field('note', 'no files here');
      expect(res.status).toBe(400);
      expect(res.body.error.details).toEqual([{ field: 'files', message: 'Choose at least one file to upload' }]);
    });

    it('rejects files sent under the wrong field name', async () => {
      const res = await request(app)
        .post(`/api/projects/${project.id}/documents`)
        .set(alice.auth)
        .attach('document', files.txt(), 'a.txt');
      expect(res.status).toBe(400);
      expect(res.body.error.message).toMatch(/"files" form field/);
    });

    it('keeps non-English file names intact and strips paths', async () => {
      const res = await upload(alice.auth, project.id, [['étude-résumé 研究.txt', files.txt()]]);
      expect(res.status).toBe(202);
      expect(res.body.documents[0].filename).toBe('étude-résumé 研究.txt');
    });

    it("refuses uploads to another user's project without storing anything", async () => {
      const res = await upload(bob.auth, project.id, [['survey.txt', files.txt()]]);
      expect(res.status).toBe(404);
      expect(await Document.countDocuments()).toBe(0);
    });

    it('requires authentication', async () => {
      const res = await upload({}, project.id, [['survey.txt', files.txt()]]);
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/projects/:id/documents', () => {
    it('lists newest first without extracted text', async () => {
      await upload(alice.auth, project.id, [['first.txt', files.txt()]]);
      await upload(alice.auth, project.id, [['second.txt', files.txt()]]);
      await whenIdle();

      const res = await list(alice.auth);
      expect(res.status).toBe(200);
      expect(res.body.documents.map((d) => d.filename)).toEqual(['second.txt', 'first.txt']);
      expect(res.body.documents.every((d) => d.extractedText === undefined)).toBe(true);
    });

    it("hides another user's project", async () => {
      const res = await list(bob.auth);
      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/documents/:id', () => {
    it('returns the document with its extracted text', async () => {
      const { body } = await upload(alice.auth, project.id, [['field-study.pdf', files.pdf()]]);
      await whenIdle();

      const res = await request(app).get(`/api/documents/${body.documents[0].id}`).set(alice.auth);
      expect(res.status).toBe(200);
      expect(res.body.document.extractedText).toContain('--- Page 2 ---');
      expect(res.body.document.extractedText).toContain('Gains were smaller for complex tasks');
    });

    it("returns 404 for another user's document and 400 for a bad id", async () => {
      const { body } = await upload(alice.auth, project.id, [['survey.txt', files.txt()]]);
      const other = await request(app).get(`/api/documents/${body.documents[0].id}`).set(bob.auth);
      expect(other.status).toBe(404);
      const bad = await request(app).get('/api/documents/xyz').set(alice.auth);
      expect(bad.status).toBe(400);
    });
  });

  describe('DELETE /api/documents/:id', () => {
    it('deletes the document and its chunks, and returns the project to draft', async () => {
      const { body } = await upload(alice.auth, project.id, [['field-study.pdf', files.pdf()]]);
      await whenIdle();
      const id = body.documents[0].id;
      expect(await DocumentChunk.countDocuments({ documentId: id })).toBeGreaterThan(0);

      const res = await request(app).delete(`/api/documents/${id}`).set(alice.auth);
      expect(res.status).toBe(204);
      expect(await Document.exists({ _id: id })).toBeNull();
      expect(await DocumentChunk.countDocuments({ documentId: id })).toBe(0);
      expect((await Project.findById(project.id)).status).toBe('draft');
    });

    it('marks an analyzed project as active again (analysis outdated)', async () => {
      const { body } = await upload(alice.auth, project.id, [
        ['a.txt', files.txt()],
        ['b.txt', files.txt()],
      ]);
      await whenIdle();
      await Project.updateOne({ _id: project.id }, { status: 'analyzed' });

      await request(app).delete(`/api/documents/${body.documents[0].id}`).set(alice.auth);
      expect((await Project.findById(project.id)).status).toBe('active');
    });

    it("cannot delete another user's document", async () => {
      const { body } = await upload(alice.auth, project.id, [['survey.txt', files.txt()]]);
      await whenIdle();
      const res = await request(app).delete(`/api/documents/${body.documents[0].id}`).set(bob.auth);
      expect(res.status).toBe(404);
      expect(await Document.exists({ _id: body.documents[0].id })).not.toBeNull();
    });

    it('leaves no orphaned chunks when a file is deleted mid-processing', async () => {
      const { body } = await upload(alice.auth, project.id, [['analysis.docx', files.docx()]]);
      await request(app).delete(`/api/documents/${body.documents[0].id}`).set(alice.auth);
      await whenIdle();
      expect(await DocumentChunk.countDocuments({ documentId: body.documents[0].id })).toBe(0);
    });
  });

  it('deleting a project removes its documents and chunks', async () => {
    await upload(alice.auth, project.id, [['field-study.pdf', files.pdf()]]);
    await whenIdle();
    await request(app).delete(`/api/projects/${project.id}`).set(alice.auth);
    expect(await Document.countDocuments()).toBe(0);
    expect(await DocumentChunk.countDocuments()).toBe(0);
  });

  it('marks documents interrupted by a restart as failed', async () => {
    const doc = await Document.create({
      projectId: new mongoose.Types.ObjectId(),
      userId: new mongoose.Types.ObjectId(),
      filename: 'stuck.pdf',
      fileType: 'pdf',
      fileSize: 10,
      processingStatus: 'processing',
    });
    await recoverInterruptedDocuments();
    const after = await Document.findById(doc._id);
    expect(after.processingStatus).toBe('failed');
    expect(after.processingError).toMatch(/interrupted/);
  });
});
