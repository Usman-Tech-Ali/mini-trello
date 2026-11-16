import type { DatabaseHealth } from '@mini-trello/shared';
import mongoose from 'mongoose';

import { withTimeout } from '../../lib/with-timeout';

const DB_CHECK_TIMEOUT_MS = 2_000;

interface HelloResponse {
  setName?: string;
  msg?: string;
}

export async function checkDatabase(): Promise<DatabaseHealth> {
  const db = mongoose.connection.db;
  if (mongoose.connection.readyState !== mongoose.ConnectionStates.connected || !db) {
    return { status: 'down', latencyMs: null, transactionsSupported: null };
  }

  const startedAt = performance.now();
  try {
    const hello = (await withTimeout(
      db.admin().command({ hello: 1 }),
      DB_CHECK_TIMEOUT_MS,
      'MongoDB health check',
    )) as HelloResponse;
    return {
      status: 'up',
      latencyMs: Math.round(performance.now() - startedAt),
      // Replica set members report `setName`; mongos (sharded cluster) reports `msg: "isdbgrid"`.
      transactionsSupported: typeof hello.setName === 'string' || hello.msg === 'isdbgrid',
    };
  } catch {
    return { status: 'down', latencyMs: null, transactionsSupported: null };
  }
}
