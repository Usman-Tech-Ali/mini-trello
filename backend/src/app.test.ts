import type { ApiErrorResponse } from '@mini-trello/shared';
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import { createApp } from './app';

const ALLOWED_ORIGIN = 'http://localhost:3000';

describe('app', () => {
  const app = createApp();

  it('returns the standard error shape for unknown routes', async () => {
    const res = await request(app).get('/does-not-exist').expect(404);
    expect(res.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Route GET /does-not-exist not found.' },
    });
  });

  it('rejects malformed JSON with a 400 instead of a 500', async () => {
    const res = await request(app)
      .post('/does-not-exist')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Content-Type', 'application/json')
      .send('{"broken":')
      .expect(400);
    expect(res.body).toEqual({
      error: { code: 'BAD_REQUEST', message: 'Request body is not valid JSON.' },
    });
  });

  it('rejects bodies over the size limit', async () => {
    const res = await request(app)
      .post('/does-not-exist')
      .set('Origin', ALLOWED_ORIGIN)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ text: 'x'.repeat(150 * 1024) }))
      .expect(413);
    expect((res.body as ApiErrorResponse).error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('sends credentialed CORS headers only to allowlisted origins', async () => {
    const allowed = await request(app).get('/does-not-exist').set('Origin', ALLOWED_ORIGIN);
    expect(allowed.headers['access-control-allow-origin']).toBe(ALLOWED_ORIGIN);
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');

    const other = await request(app).get('/does-not-exist').set('Origin', 'https://evil.example');
    expect(other.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('sets a request id header for tracing', async () => {
    const res = await request(app).get('/does-not-exist');
    expect(res.headers['x-request-id']).toMatch(/^[\w-]+$/);
  });
});
