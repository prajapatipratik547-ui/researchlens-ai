import request from 'supertest';

let counter = 0;

/** Registers a fresh user and returns { user, token, auth } for requests. */
export async function registerUser(app, overrides = {}) {
  counter += 1;
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      name: `Test User ${counter}`,
      email: `user${counter}.${Date.now()}@example.com`,
      password: 'password1',
      ...overrides,
    });
  if (res.status !== 201) throw new Error(`registerUser failed: ${JSON.stringify(res.body)}`);
  const { user, token } = res.body;
  return { user, token, auth: { Authorization: `Bearer ${token}` } };
}
