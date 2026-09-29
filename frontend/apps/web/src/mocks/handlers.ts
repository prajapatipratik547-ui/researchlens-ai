import { delay, http, HttpResponse, type HttpHandler } from 'msw';
import type { z } from 'zod';
import {
  analysisResponseSchema,
  authResponseSchema,
  briefResponseSchema,
  conversationResponseSchema,
  conversationsResponseSchema,
  createProjectRequestSchema,
  documentResponseSchema,
  documentsResponseSchema,
  evidenceResponseSchema,
  gapsResponseSchema,
  insightsResponseSchema,
  insightTypeSchema,
  LIMITS,
  loginRequestSchema,
  meResponseSchema,
  projectResponseSchema,
  projectsResponseSchema,
  registerRequestSchema,
  type FieldError,
  type Project,
  type SourceDocument,
  type User,
} from '@synapse/shared';
import { API_URL } from '../lib/api';
import { hashPassword, load, newId, now, save, type MockDb, type MockDocument } from './db';
import { analysisFor, answerFor, briefFor, extractedTextFor, summaryFor } from './generate';

/* Stateful mock of the ResearchLens API. Shapes come from @synapse/shared and are validated on the way out. */

const db: MockDb = load();
const url = (path: string) => `${API_URL}${path}`;

/* ------------------------------------------------------------------ helpers */

function reply<S extends z.ZodType>(schema: S, body: z.infer<S>, status = 200) {
  // A mock that drifts from the contract is a bug — fail loudly in dev.
  const parsed = schema.parse(body);
  save(db);
  return HttpResponse.json(parsed as Record<string, unknown>, { status });
}

function fail(status: number, code: string, message: string, details?: FieldError[]) {
  return HttpResponse.json({ error: { message, code, ...(details ? { details } : {}) } }, { status });
}

function zodDetails(issues: z.core.$ZodIssue[]): FieldError[] {
  return issues.map((i) => ({ field: String(i.path[0] ?? 'body'), message: i.message }));
}

const publicUser = ({ passwordHash: _hash, ...u }: MockDb['users'][number]): User => u;
const publicDoc = ({ uploadedAt: _t, willFail: _f, ...d }: MockDocument): SourceDocument => d;

type Mode = 'all' | 'planned';

/** In "planned" mode the real backend owns users/projects; we only need a token and a shadow project. */
function auth(request: Request, mode: Mode): { userId: string } | Response {
  const header = request.headers.get('Authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '');
  if (!token) return fail(401, 'NO_TOKEN', 'Log in to continue.');
  if (mode === 'planned') return { userId: 'planned' };
  const id = token.startsWith('mock.') ? token.slice(5) : '';
  if (!db.users.some((u) => u.id === id)) return fail(401, 'INVALID_TOKEN', 'Your session is not valid. Log in again.');
  return { userId: id };
}

function project(id: string, userId: string, mode: Mode): Project | null {
  const found = db.projects.find((p) => p.id === id);
  if (found) return mode === 'planned' || found.userId === userId ? found : null;
  if (mode === 'planned' && /^[a-f0-9]{24}$/i.test(id)) {
    const shadow: Project = {
      id,
      userId: newId(),
      title: 'Your research project',
      researchQuestion: 'What do the uploaded sources say?',
      description: '',
      status: 'draft',
      createdAt: now(),
      updatedAt: now(),
      stats: { sourceCount: 0, insightCount: 0, gapCount: 0 },
      analyzedAt: null,
    };
    db.projects.push(shadow);
    return shadow;
  }
  return null;
}

/** Advance simulated background processing and keep project status/stats in sync. */
function tick() {
  const t = Date.now();
  for (const d of db.documents) {
    if (d.processingStatus === 'ready' || d.processingStatus === 'failed') continue;
    const elapsed = t - d.uploadedAt;
    if (elapsed > 7000) {
      d.processingStatus = d.willFail ? 'failed' : 'ready';
      d.processingError = d.willFail ? 'No readable text found. Scanned PDFs are not supported.' : '';
      d.summary = d.willFail ? '' : summaryFor(d);
      d.updatedAt = now();
    } else if (elapsed > 3500 && d.processingStatus === 'processing') {
      d.processingStatus = 'analyzing';
      d.updatedAt = now();
    }
  }
  for (const p of db.projects) {
    const ready = readyDocs(p.id);
    const analysis = db.analyses[p.id];
    p.stats.sourceCount = ready.length;
    p.stats.insightCount = analysis?.insights.filter((i) => i.type !== 'research_gap').length ?? 0;
    p.stats.gapCount = analysis?.insights.filter((i) => i.type === 'research_gap').length ?? 0;
    p.analyzedAt = analysis?.analyzedAt ?? null;
    p.status = analysis && !isOutdated(p.id) ? 'analyzed' : ready.length > 0 ? 'active' : 'draft';
  }
}

const readyDocs = (projectId: string) =>
  db.documents
    .filter((d) => d.projectId === projectId && d.processingStatus === 'ready')
    .sort((a, b) => a.uploadedAt - b.uploadedAt)
    .map(publicDoc);

function isOutdated(projectId: string): boolean {
  const analysis = db.analyses[projectId];
  if (!analysis) return false;
  const current = readyDocs(projectId).map((d) => d.id).sort().join();
  return current !== [...analysis.sourceIds].sort().join();
}

function touch(p: Project) {
  p.updatedAt = now();
}

/* ------------------------------------------------------------------ seed */

async function seed() {
  if (db.users.length > 0) return;
  const at = now();
  const user = {
    id: newId(),
    name: 'Demo Researcher',
    email: 'demo@researchlens.app',
    passwordHash: await hashPassword('research1'),
    createdAt: at,
    updatedAt: at,
  };
  db.users.push(user);
  const p: Project = {
    id: newId(),
    userId: user.id,
    title: 'Impact of Generative AI on Software Developer Productivity',
    researchQuestion: 'How does generative AI affect developer productivity, code quality, and developer satisfaction?',
    description: 'Comparing field studies, surveys and lab experiments published since 2022.',
    status: 'draft',
    createdAt: at,
    updatedAt: at,
    stats: { sourceCount: 0, insightCount: 0, gapCount: 0 },
    analyzedAt: null,
  };
  db.projects.push(p);
  const files: Array<[string, SourceDocument['fileType'], number | null]> = [
    ['copilot-field-study.pdf', 'pdf', 14],
    ['developer-survey-2025.docx', 'docx', null],
    ['lab-experiment-complex-tasks.pdf', 'pdf', 22],
  ];
  files.forEach(([filename, fileType, pageCount], i) => {
    db.documents.push({
      id: newId(),
      projectId: p.id,
      filename,
      fileType,
      fileSize: 180_000 + i * 97_000,
      processingStatus: 'ready',
      processingError: '',
      summary: summaryFor({ filename }),
      metadata: { pageCount, wordCount: 4200 + i * 1300, chunkCount: 8 + i * 3 },
      createdAt: at,
      updatedAt: at,
      uploadedAt: Date.now() - 60_000 + i,
      willFail: false,
    });
  });
  const docs = readyDocs(p.id);
  const { insights, matrix } = analysisFor(p, docs);
  db.analyses[p.id] = { analyzedAt: at, insights, matrix, brief: null, sourceIds: docs.map((d) => d.id) };
  db.conversations.push(answerFor(p, 'What are the major limitations discussed across the sources?', docs));
  tick();
  save(db);
}

/* ------------------------------------------------------------------ live endpoints (Phases 1–3) */

function liveHandlers(): HttpHandler[] {
  const mode: Mode = 'all';
  return [
    http.post(url('/auth/register'), async ({ request }) => {
      await delay(600);
      const parsed = registerRequestSchema.safeParse(await request.json().catch(() => null));
      if (!parsed.success) return fail(400, 'VALIDATION_ERROR', 'Validation failed', zodDetails(parsed.error.issues));
      const { name, email, password } = parsed.data;
      if (db.users.some((u) => u.email === email)) {
        return fail(409, 'EMAIL_TAKEN', 'An account with this email already exists.', [
          { field: 'email', message: 'An account with this email already exists' },
        ]);
      }
      const at = now();
      const user = { id: newId(), name, email, passwordHash: await hashPassword(password), createdAt: at, updatedAt: at };
      db.users.push(user);
      return reply(authResponseSchema, { user: publicUser(user), token: `mock.${user.id}` }, 201);
    }),

    http.post(url('/auth/login'), async ({ request }) => {
      await delay(500);
      const parsed = loginRequestSchema.safeParse(await request.json().catch(() => null));
      if (!parsed.success) return fail(400, 'VALIDATION_ERROR', 'Validation failed', zodDetails(parsed.error.issues));
      const user = db.users.find((u) => u.email === parsed.data.email);
      if (!user || user.passwordHash !== (await hashPassword(parsed.data.password))) {
        return fail(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect.');
      }
      return reply(authResponseSchema, { user: publicUser(user), token: `mock.${user.id}` });
    }),

    http.get(url('/auth/me'), async ({ request }) => {
      await delay(250);
      const a = auth(request, mode);
      if (a instanceof Response) return a;
      const user = db.users.find((u) => u.id === a.userId)!;
      return reply(meResponseSchema, { user: publicUser(user) });
    }),

    http.get(url('/projects'), async ({ request }) => {
      await delay(450);
      const a = auth(request, mode);
      if (a instanceof Response) return a;
      tick();
      const projects = db.projects
        .filter((p) => p.userId === a.userId)
        .sort((x, y) => y.updatedAt.localeCompare(x.updatedAt));
      return reply(projectsResponseSchema, { projects });
    }),

    http.post(url('/projects'), async ({ request }) => {
      await delay(500);
      const a = auth(request, mode);
      if (a instanceof Response) return a;
      const parsed = createProjectRequestSchema.safeParse(await request.json().catch(() => null));
      if (!parsed.success) return fail(400, 'VALIDATION_ERROR', 'Validation failed', zodDetails(parsed.error.issues));
      const at = now();
      const p: Project = {
        id: newId(),
        userId: a.userId,
        title: parsed.data.title,
        researchQuestion: parsed.data.researchQuestion,
        description: parsed.data.description ?? '',
        status: 'draft',
        createdAt: at,
        updatedAt: at,
        stats: { sourceCount: 0, insightCount: 0, gapCount: 0 },
        analyzedAt: null,
      };
      db.projects.push(p);
      return reply(projectResponseSchema, { project: p }, 201);
    }),

    http.get(url('/projects/:id'), async ({ request, params }) => {
      await delay(300);
      const a = auth(request, mode);
      if (a instanceof Response) return a;
      tick();
      const p = project(String(params.id), a.userId, mode);
      if (!p) return fail(404, 'NOT_FOUND', 'Project not found.');
      return reply(projectResponseSchema, { project: p });
    }),

    http.delete(url('/projects/:id'), async ({ request, params }) => {
      await delay(400);
      const a = auth(request, mode);
      if (a instanceof Response) return a;
      const p = project(String(params.id), a.userId, mode);
      if (!p) return fail(404, 'NOT_FOUND', 'Project not found.');
      db.projects = db.projects.filter((x) => x.id !== p.id);
      db.documents = db.documents.filter((d) => d.projectId !== p.id);
      db.conversations = db.conversations.filter((c) => c.projectId !== p.id);
      delete db.analyses[p.id];
      save(db);
      return new HttpResponse(null, { status: 204 });
    }),
  ];
}

/* ------------------------------------------------------------------ planned endpoints (Phases 4–7) */

function plannedHandlers(mode: Mode): HttpHandler[] {
  const guard = (request: Request, projectId: string) => {
    const a = auth(request, mode);
    if (a instanceof Response) return a;
    const p = project(projectId, a.userId, mode);
    if (!p) return fail(404, 'NOT_FOUND', 'Project not found.');
    return p;
  };
  const docGuard = (request: Request, docId: string) => {
    const a = auth(request, mode);
    if (a instanceof Response) return a;
    const d = db.documents.find((x) => x.id === docId);
    if (!d || !project(d.projectId, a.userId, mode)) return fail(404, 'NOT_FOUND', 'Source not found.');
    return d;
  };
  const analysisMeta = (projectId: string) => ({
    analyzedAt: db.analyses[projectId]?.analyzedAt ?? null,
    outdated: isOutdated(projectId),
  });

  return [
    http.post(url('/projects/:id/documents'), async ({ request, params }) => {
      const p = guard(request, String(params.id));
      if (p instanceof Response) return p;
      const form = await request.formData();
      const files = form.getAll(LIMITS.upload.fieldName).filter((f): f is File => f instanceof File);
      await delay(300);
      if (files.length === 0) {
        return fail(400, 'VALIDATION_ERROR', 'Choose at least one file.', [{ field: 'files', message: 'Choose at least one file' }]);
      }
      if (files.length > LIMITS.upload.maxFiles) {
        return fail(400, 'TOO_MANY_FILES', `Upload at most ${LIMITS.upload.maxFiles} files at a time.`);
      }
      const badType = files.filter((f) => !LIMITS.upload.extensions.some((ext) => f.name.toLowerCase().endsWith(ext)));
      if (badType.length) {
        return fail(
          400,
          'FILE_TYPE_NOT_ALLOWED',
          'Only PDF, DOCX and TXT files are supported.',
          badType.map((f) => ({ field: f.name, message: 'Only PDF, DOCX and TXT files are supported' })),
        );
      }
      const tooBig = files.filter((f) => f.size > LIMITS.upload.maxBytes);
      if (tooBig.length) {
        return fail(413, 'FILE_TOO_LARGE', 'Each file must be 10 MB or less.', tooBig.map((f) => ({ field: f.name, message: 'Larger than 10 MB' })));
      }
      const at = now();
      const created: MockDocument[] = files.map((f, i) => {
        const fileType = f.name.toLowerCase().split('.').pop() as SourceDocument['fileType'];
        const words = Math.max(120, Math.round(f.size / 6));
        return {
          id: newId(),
          projectId: p.id,
          filename: f.name,
          fileType,
          fileSize: f.size,
          processingStatus: 'processing',
          processingError: '',
          summary: '',
          metadata: {
            pageCount: fileType === 'pdf' ? Math.max(1, Math.round(words / 450)) : null,
            wordCount: words,
            chunkCount: Math.max(1, Math.round(words / 550)),
          },
          createdAt: at,
          updatedAt: at,
          uploadedAt: Date.now() + i * 900,
          // Lets you demo the Failed state: name a file "scan…".
          willFail: /scan/i.test(f.name),
        };
      });
      db.documents.push(...created);
      touch(p);
      return reply(documentsResponseSchema, { documents: created.map(publicDoc) }, 202);
    }),

    http.get(url('/projects/:id/documents'), async ({ request, params }) => {
      await delay(250);
      const p = guard(request, String(params.id));
      if (p instanceof Response) return p;
      tick();
      const documents = db.documents
        .filter((d) => d.projectId === p.id)
        .sort((a, b) => b.uploadedAt - a.uploadedAt)
        .map(publicDoc);
      return reply(documentsResponseSchema, { documents });
    }),

    http.get(url('/documents/:id'), async ({ request, params }) => {
      await delay(350);
      const d = docGuard(request, String(params.id));
      if (d instanceof Response) return d;
      tick();
      const doc = publicDoc(d);
      return reply(documentResponseSchema, { document: { ...doc, extractedText: doc.processingStatus === 'ready' ? extractedTextFor(doc) : '' } });
    }),

    http.delete(url('/documents/:id'), async ({ request, params }) => {
      await delay(350);
      const d = docGuard(request, String(params.id));
      if (d instanceof Response) return d;
      db.documents = db.documents.filter((x) => x.id !== d.id);
      const p = db.projects.find((x) => x.id === d.projectId);
      if (p) touch(p);
      tick();
      save(db);
      return new HttpResponse(null, { status: 204 });
    }),

    http.post(url('/research/:projectId/ask'), async ({ request, params }) => {
      const p = guard(request, String(params.projectId));
      if (p instanceof Response) return p;
      const body = (await request.json().catch(() => null)) as { question?: unknown } | null;
      const question = typeof body?.question === 'string' ? body.question.trim() : '';
      if (question.length < LIMITS.question.min || question.length > LIMITS.question.max) {
        return fail(400, 'VALIDATION_ERROR', 'Validation failed', [
          { field: 'question', message: `Questions must be ${LIMITS.question.min}–${LIMITS.question.max} characters` },
        ]);
      }
      tick();
      const docs = readyDocs(p.id);
      if (docs.length === 0) return fail(409, 'NO_READY_SOURCES', 'Upload a source first, or wait for processing to finish.');
      await delay(2800);
      const conversation = answerFor(p, question, docs);
      db.conversations.push(conversation);
      return reply(conversationResponseSchema, { conversation });
    }),

    http.get(url('/research/:projectId/conversations'), async ({ request, params }) => {
      await delay(300);
      const p = guard(request, String(params.projectId));
      if (p instanceof Response) return p;
      const conversations = db.conversations
        .filter((c) => c.projectId === p.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      return reply(conversationsResponseSchema, { conversations });
    }),

    http.post(url('/research/:projectId/analyze'), async ({ request, params }) => {
      const p = guard(request, String(params.projectId));
      if (p instanceof Response) return p;
      tick();
      const docs = readyDocs(p.id);
      if (docs.length === 0) return fail(409, 'NO_READY_SOURCES', 'Upload a source first, or wait for processing to finish.');
      await delay(5000);
      const { insights, matrix } = analysisFor(p, docs);
      const analyzedAt = now();
      db.analyses[p.id] = { analyzedAt, insights, matrix, brief: null, sourceIds: docs.map((d) => d.id) };
      touch(p);
      tick();
      const counts = { key_finding: 0, theme: 0, contradiction: 0, research_gap: 0, unanswered_question: 0 };
      for (const i of insights) counts[i.type] += 1;
      return reply(analysisResponseSchema, { analysis: { analyzedAt, sourceCount: docs.length, counts } });
    }),

    http.get(url('/research/:projectId/insights'), async ({ request, params }) => {
      await delay(400);
      const p = guard(request, String(params.projectId));
      if (p instanceof Response) return p;
      tick();
      const type = insightTypeSchema.safeParse(new URL(request.url).searchParams.get('type'));
      const all = db.analyses[p.id]?.insights ?? [];
      const insights = type.success ? all.filter((i) => i.type === type.data) : all;
      return reply(insightsResponseSchema, { insights, ...analysisMeta(p.id) });
    }),

    http.get(url('/research/:projectId/evidence'), async ({ request, params }) => {
      await delay(400);
      const p = guard(request, String(params.projectId));
      if (p instanceof Response) return p;
      tick();
      return reply(evidenceResponseSchema, { matrix: db.analyses[p.id]?.matrix ?? null, ...analysisMeta(p.id) });
    }),

    http.get(url('/research/:projectId/gaps'), async ({ request, params }) => {
      await delay(350);
      const p = guard(request, String(params.projectId));
      if (p instanceof Response) return p;
      tick();
      const gaps = (db.analyses[p.id]?.insights ?? []).filter((i) => i.type === 'research_gap');
      return reply(gapsResponseSchema, { gaps, ...analysisMeta(p.id) });
    }),

    http.get(url('/research/:projectId/brief'), async ({ request, params }) => {
      const p = guard(request, String(params.projectId));
      if (p instanceof Response) return p;
      tick();
      const analysis = db.analyses[p.id];
      if (!analysis) return fail(409, 'ANALYSIS_REQUIRED', 'Run an analysis before generating the brief.');
      if (!analysis.brief) {
        await delay(3500);
        const docs = db.documents
          .filter((d) => analysis.sourceIds.includes(d.id))
          .sort((a, b) => a.uploadedAt - b.uploadedAt)
          .map(publicDoc);
        analysis.brief = briefFor(p, analysis.insights, docs);
      } else {
        await delay(250);
      }
      return reply(briefResponseSchema, { brief: analysis.brief, outdated: isOutdated(p.id) });
    }),
  ];
}

export async function buildHandlers(scope: 'true' | 'planned'): Promise<HttpHandler[]> {
  if (scope === 'true') {
    await seed();
    return [...liveHandlers(), ...plannedHandlers('all')];
  }
  return plannedHandlers('planned');
}
