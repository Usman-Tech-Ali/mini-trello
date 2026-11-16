import type { ApiErrorResponse, AuthResponse } from '@mini-trello/shared';
import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../app';
import { createAuthRateLimiter } from '../../lib/rate-limit';
import { errorHandler } from '../../middleware/error-handler';
import { startTestDatabase } from '../../test/mongo-memory';
import { createClient, TEST_PASSWORD, uniqueEmail } from '../../test/http';
import { UserModel } from '../users/user.model';

const app = createApp();
let stopDatabase: (() => Promise<void>) | undefined;

beforeAll(async () => {
  stopDatabase = await startTestDatabase();
});

afterAll(async () => {
  await stopDatabase?.();
});

function sessionCookie(res: request.Response): string {
  const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
  const cookie = cookies.find((c) => c.startsWith('mt_session='));
  if (!cookie) throw new Error('No session cookie set');
  return cookie;
}

describe('POST /api/auth/register', () => {
  it('creates the user, normalizes the email and starts a session with a hardened cookie', async () => {
    const email = uniqueEmail('Alice');
    const client = createClient(app);
    const res = await client
      .post('/api/auth/register')
      .send({ name: '  Alice  ', email: `  ${email.toUpperCase()}  `, password: TEST_PASSWORD })
      .expect(201);

    const { user } = res.body as AuthResponse;
    expect(user).toMatchObject({ name: 'Alice', email: email.toLowerCase() });
    expect(user.id).toMatch(/^[a-f\d]{24}$/);
    expect(JSON.stringify(res.body)).not.toContain('password');

    const cookie = sessionCookie(res);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).toMatch(/Max-Age=86400/);

    await client.get('/api/auth/me').expect(200);
  });

  it('stores an Argon2id hash, never the password', async () => {
    const email = uniqueEmail();
    await createClient(app)
      .post('/api/auth/register')
      .send({ name: 'Hash Check', email, password: TEST_PASSWORD })
      .expect(201);

    const stored = await UserModel.findOne({ email }).select('+passwordHash').lean();
    expect(stored?.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it('rejects a duplicate email regardless of case', async () => {
    const email = uniqueEmail();
    const client = createClient(app);
    await client
      .post('/api/auth/register')
      .send({ name: 'A', email, password: TEST_PASSWORD })
      .expect(201);

    const res = await client
      .post('/api/auth/register')
      .send({ name: 'B', email: email.toUpperCase(), password: TEST_PASSWORD })
      .expect(409);
    expect((res.body as ApiErrorResponse).error).toMatchObject({
      code: 'EMAIL_TAKEN',
      details: { email: [expect.any(String)] },
    });
  });

  it('returns field-level validation errors', async () => {
    const res = await createClient(app)
      .post('/api/auth/register')
      .send({ name: '', email: 'not-an-email', password: 'short' })
      .expect(400);
    const { error } = res.body as ApiErrorResponse;
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(Object.keys(error.details ?? {}).sort()).toEqual(['email', 'name', 'password']);
  });
});

describe('POST /api/auth/login', () => {
  const email = uniqueEmail('login');

  beforeAll(async () => {
    await createClient(app)
      .post('/api/auth/register')
      .send({ name: 'Login User', email, password: TEST_PASSWORD })
      .expect(201);
  });

  it('starts a session with valid credentials', async () => {
    const client = createClient(app);
    const res = await client
      .post('/api/auth/login')
      .send({ email, password: TEST_PASSWORD })
      .expect(200);
    expect((res.body as AuthResponse).user.email).toBe(email);
    const me = await client.get('/api/auth/me').expect(200);
    expect((me.body as AuthResponse).user.email).toBe(email);
  });

  it('gives the same answer for a wrong password and an unknown email', async () => {
    const wrongPassword = await createClient(app)
      .post('/api/auth/login')
      .send({ email, password: 'wrong-password' })
      .expect(401);
    const unknownEmail = await createClient(app)
      .post('/api/auth/login')
      .send({ email: uniqueEmail('nobody'), password: TEST_PASSWORD })
      .expect(401);

    expect(wrongPassword.body).toEqual(unknownEmail.body);
    expect((wrongPassword.body as ApiErrorResponse).error.code).toBe('INVALID_CREDENTIALS');
    expect(wrongPassword.headers['set-cookie']).toBeUndefined();
  });
});

describe('session lifecycle', () => {
  it('rejects /me without a session or with a tampered token', async () => {
    const anonymous = await request(app).get('/api/auth/me').expect(401);
    expect((anonymous.body as ApiErrorResponse).error.code).toBe('UNAUTHENTICATED');

    await request(app).get('/api/auth/me').set('Cookie', 'mt_session=not.a.jwt').expect(401);
  });

  it('ends the session on logout', async () => {
    const client = createClient(app);
    await client
      .post('/api/auth/register')
      .send({ name: 'Logout User', email: uniqueEmail(), password: TEST_PASSWORD })
      .expect(201);
    await client.get('/api/auth/me').expect(200);

    const res = await client.post('/api/auth/logout').expect(204);
    expect(sessionCookie(res)).toMatch(/Expires=Thu, 01 Jan 1970/);
    await client.get('/api/auth/me').expect(401);
  });

  it('requires an allowlisted Origin for login (CSRF defense)', async () => {
    await request(app)
      .post('/api/auth/login')
      .set('Origin', 'https://evil.example')
      .send({ email: 'a@b.co', password: 'x' })
      .expect(403);
  });
});

describe('createAuthRateLimiter', () => {
  function buildApp(failedOnly: boolean) {
    const limited = express();
    limited.post(
      '/attempt/:outcome',
      createAuthRateLimiter({ limit: 2, failedOnly }),
      (req, res) => {
        res.status(req.params.outcome === 'ok' ? 200 : 401).end();
      },
    );
    limited.use(errorHandler);
    return limited;
  }

  it('blocks further attempts once the limit is reached', async () => {
    const limited = buildApp(false);
    await request(limited).post('/attempt/ok').expect(200);
    await request(limited).post('/attempt/ok').expect(200);
    const res = await request(limited).post('/attempt/ok').expect(429);
    expect((res.body as ApiErrorResponse).error.code).toBe('RATE_LIMITED');
  });

  it('only counts failures when failedOnly is set', async () => {
    const limited = buildApp(true);
    for (let i = 0; i < 3; i += 1) await request(limited).post('/attempt/ok').expect(200);
    await request(limited).post('/attempt/fail').expect(401);
    await request(limited).post('/attempt/fail').expect(401);
    await request(limited).post('/attempt/fail').expect(429);
  });
});
