import type { HealthResponse } from '@mini-trello/shared';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createApp } from '../../app';
import { disconnectDatabase } from '../../db/connection';
import { startTestDatabase } from '../../test/mongo-memory';

describe('GET /health', () => {
  const app = createApp();
  let stopDatabase: (() => Promise<void>) | undefined;

  beforeAll(async () => {
    stopDatabase = await startTestDatabase();
  });

  afterAll(async () => {
    await stopDatabase?.();
  });

  it('reports ok with database details when MongoDB is reachable', async () => {
    const res = await request(app).get('/health').expect(200);
    const body = res.body as HealthResponse;

    expect(body.status).toBe('ok');
    expect(body.database.status).toBe('up');
    expect(body.database.latencyMs).toEqual(expect.any(Number));
    expect(body.database.transactionsSupported).toBe(true);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('reports degraded with 503 when the database connection is down', async () => {
    await disconnectDatabase();

    const res = await request(app).get('/health').expect(503);
    const body = res.body as HealthResponse;

    expect(body.status).toBe('degraded');
    expect(body.database).toEqual({ status: 'down', latencyMs: null, transactionsSupported: null });
  });
});
