import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { startTestDB, stopTestDB } from './helpers/db.js';

const app = createApp();

describe('app foundation', () => {
  beforeAll(startTestDB);
  afterAll(stopTestDB);

  it('reports healthy when the database is connected', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', database: 'connected' });
  });

  it('returns a structured 404 for unknown routes', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects malformed JSON with a 400, not a 500', async () => {
    const res = await request(app)
      .post('/api/does-not-exist')
      .set('Content-Type', 'application/json')
      .send('{"broken":');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });

  it('allows the configured client origin and blocks others', async () => {
    const allowed = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');

    const blocked = await request(app).get('/api/health').set('Origin', 'https://evil.example');
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe('CORS');
  });

  it('sets security headers and hides the framework', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
