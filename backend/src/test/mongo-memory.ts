import { randomUUID } from 'node:crypto';

import mongoose from 'mongoose';
import { inject } from 'vitest';

import { connectDatabase, disconnectDatabase, initModels } from '../db/connection';

/**
 * Connects Mongoose to a fresh database on the shared in-memory replica set (see global-setup.ts),
 * so transactions work as in production. Returns a function that drops the database and disconnects.
 */
export async function startTestDatabase(): Promise<() => Promise<void>> {
  await connectDatabase(inject('mongoUri'), `test-${randomUUID()}`);
  await initModels();
  return async () => {
    if (mongoose.connection.readyState === mongoose.ConnectionStates.connected) {
      await mongoose.connection.dropDatabase();
    }
    await disconnectDatabase();
  };
}
