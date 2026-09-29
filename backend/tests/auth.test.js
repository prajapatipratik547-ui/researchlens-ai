import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';
import { startTestDB, clearTestDB, stopTestDB } from './helpers/db.js';

const app = createApp();
const valid = { name: 'Ada Lovelace', email: 'ada@example.com', password: 'analytical1' };

const register = (body = valid) => request(app).post('/api/auth/register').send(body);
const login = (body) => request(app).post('/api/auth/login').send(body);
const me = (token) => {
  const req = request(app).get('/api/auth/me');
  return token ? req.set('Authorization', `Bearer ${token}`) : req;
};
const fieldsOf = (res) => res.body.error.details.map((d) => d.field);

describe('auth', () => {
  beforeAll(startTestDB);
  afterAll(stopTestDB);
  beforeEach(clearTestDB);

  describe('POST /api/auth/register', () => {
    it('creates a user and returns a token without the password hash', async () => {
      const res = await register();
      expect(res.status).toBe(201);
      expect(res.body.token).toEqual(expect.any(String));
      expect(res.body.user).toMatchObject({ name: 'Ada Lovelace', email: 'ada@example.com' });
      expect(res.body.user.id).toEqual(expect.any(String));
      expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|analytical1/);
    });

    it('stores a bcrypt hash, never the plain password', async () => {
      await register();
      const user = await User.findOne({ email: valid.email }).select('+passwordHash');
      expect(user.passwordHash).toMatch(/^\$2[aby]\$/);
      expect(user.passwordHash).not.toContain(valid.password);
    });

    it('normalises email case and whitespace', async () => {
      const res = await register({ ...valid, email: '  ADA@Example.COM ' });
      expect(res.status).toBe(201);
      expect(res.body.user.email).toBe('ada@example.com');
    });

    it('rejects a duplicate email with 409, case-insensitively', async () => {
      await register();
      const res = await register({ ...valid, email: 'ADA@example.com' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('EMAIL_TAKEN');
      expect(fieldsOf(res)).toEqual(['email']);
    });

    it('returns field-level validation errors', async () => {
      const res = await register({ name: 'A', email: 'not-an-email', password: 'short' });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
      expect(fieldsOf(res)).toEqual(expect.arrayContaining(['name', 'email', 'password']));
    });

    it('requires a letter and a number in the password', async () => {
      const res = await register({ ...valid, password: 'onlyletters' });
      expect(res.status).toBe(400);
      expect(fieldsOf(res)).toEqual(['password']);
    });

    it('rejects passwords longer than bcrypt can hash', async () => {
      const res = await register({ ...valid, password: 'a1'.repeat(40) });
      expect(res.status).toBe(400);
      expect(fieldsOf(res)).toEqual(['password']);
    });

    it('ignores client-supplied ids and hashes (no mass assignment)', async () => {
      const forcedId = new mongoose.Types.ObjectId().toString();
      const res = await register({ ...valid, _id: forcedId, passwordHash: 'x' });
      expect(res.status).toBe(201);
      expect(res.body.user.id).not.toBe(forcedId);
      const loginRes = await login({ email: valid.email, password: valid.password });
      expect(loginRes.status).toBe(200);
    });

    it('rejects a missing body', async () => {
      const res = await request(app).post('/api/auth/register');
      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(() => register());

    it('returns a token for correct credentials', async () => {
      const res = await login({ email: 'ADA@example.com', password: valid.password });
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(valid.email);
      expect(res.body.token).toEqual(expect.any(String));
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    it('gives the same 401 for a wrong password and an unknown email', async () => {
      const wrongPassword = await login({ email: valid.email, password: 'wrongpass1' });
      const unknownEmail = await login({ email: 'nobody@example.com', password: 'whatever1' });
      for (const res of [wrongPassword, unknownEmail]) {
        expect(res.status).toBe(401);
        expect(res.body.error).toMatchObject({
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
        });
      }
    });

    it('validates the payload', async () => {
      const res = await login({ email: 'bad' });
      expect(res.status).toBe(400);
      expect(fieldsOf(res)).toEqual(expect.arrayContaining(['email', 'password']));
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns the current user for a valid token', async () => {
      const { body } = await register();
      const res = await me(body.token);
      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({ id: body.user.id, email: valid.email });
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    it('rejects requests without a token', async () => {
      const res = await me();
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('NO_TOKEN');
    });

    it('rejects a non-Bearer authorization header', async () => {
      const { body } = await register();
      const res = await request(app).get('/api/auth/me').set('Authorization', `Basic ${body.token}`);
      expect(res.status).toBe(401);
    });

    it('rejects a malformed token', async () => {
      const res = await me('not.a.jwt');
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    it('rejects a token signed with a different secret', async () => {
      const { body } = await register();
      const forged = jwt.sign({}, 'attacker-secret', {
        subject: body.user.id,
        issuer: 'researchlens-api',
      });
      const res = await me(forged);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });

    it('rejects an unsigned (alg: none) token', async () => {
      const { body } = await register();
      const unsigned = jwt.sign({ sub: body.user.id, iss: 'researchlens-api' }, null, {
        algorithm: 'none',
      });
      const res = await me(unsigned);
      expect(res.status).toBe(401);
    });

    it('rejects an expired token with a distinct code', async () => {
      const { body } = await register();
      const expired = jwt.sign({}, process.env.JWT_SECRET, {
        subject: body.user.id,
        issuer: 'researchlens-api',
        expiresIn: -10,
      });
      const res = await me(expired);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('TOKEN_EXPIRED');
    });

    it('rejects a valid token whose user has been deleted', async () => {
      const { body } = await register();
      await User.deleteOne({ _id: body.user.id });
      const res = await me(body.token);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('USER_NOT_FOUND');
    });

    it('rejects a validly signed token with a non-ObjectId subject', async () => {
      const token = jwt.sign({}, process.env.JWT_SECRET, {
        subject: 'admin',
        issuer: 'researchlens-api',
      });
      const res = await me(token);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe('INVALID_TOKEN');
    });
  });
});
