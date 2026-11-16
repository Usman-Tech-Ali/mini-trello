import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { errorHandler } from './error-handler';
import { originCheck } from './origin-check';

const ALLOWED = 'http://localhost:3000';

function buildApp() {
  const app = express();
  app.use(originCheck([ALLOWED]));
  app.all('/resource', (_req, res) => {
    res.status(200).json({ ok: true });
  });
  app.use(errorHandler);
  return app;
}

describe('originCheck', () => {
  const app = buildApp();

  it('lets safe methods through without an Origin header', async () => {
    await request(app).get('/resource').expect(200);
  });

  it.each(['post', 'patch', 'put', 'delete'] as const)(
    'allows %s from an allowlisted origin',
    async (method) => {
      await request(app)[method]('/resource').set('Origin', ALLOWED).expect(200);
    },
  );

  it('rejects state-changing requests from other origins', async () => {
    const res = await request(app)
      .post('/resource')
      .set('Origin', 'https://evil.example')
      .expect(403);
    expect(res.body).toEqual({
      error: { code: 'INVALID_ORIGIN', message: 'Request origin is not allowed.' },
    });
  });

  it('rejects the opaque "null" origin', async () => {
    await request(app).post('/resource').set('Origin', 'null').expect(403);
  });

  it('falls back to the Referer origin when Origin is missing', async () => {
    await request(app).post('/resource').set('Referer', `${ALLOWED}/boards/123`).expect(200);
    await request(app).post('/resource').set('Referer', 'https://evil.example/page').expect(403);
  });

  it('rejects state-changing requests with neither Origin nor Referer', async () => {
    await request(app).post('/resource').expect(403);
  });

  it('does not treat a lookalike origin as allowlisted', async () => {
    await request(app)
      .post('/resource')
      .set('Origin', 'http://localhost:3000.evil.example')
      .expect(403);
  });
});
