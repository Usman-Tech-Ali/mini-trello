import { MongoMemoryReplSet } from 'mongodb-memory-server';

import { connectDatabase, disconnectDatabase } from '../db/connection';

/**
 * Starts a single-node in-memory replica set (so transactions work, matching production)
 * and connects Mongoose to it. Returns a function that tears everything down.
 */
export async function startTestDatabase(): Promise<() => Promise<void>> {
  const replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await connectDatabase(replSet.getUri());
  return async () => {
    await disconnectDatabase();
    await replSet.stop();
  };
}
