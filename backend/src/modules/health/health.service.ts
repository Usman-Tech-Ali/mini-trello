import type { DatabaseHealth } from '@mini-trello/shared';
import mongoose from 'mongoose';

import { supportsTransactions, type HelloResponse } from '../../db/connection';
import { withTimeout } from '../../lib/with-timeout';

const DB_CHECK_TIMEOUT_MS = 2_000;

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
      transactionsSupported: supportsTransactions(hello),
    };
  } catch {
    return { status: 'down', latencyMs: null, transactionsSupported: null };
  }
}
