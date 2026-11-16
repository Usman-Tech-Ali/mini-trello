import mongoose from 'mongoose';

import { logger } from '../lib/logger';

// Drop filter keys that aren't in the schema instead of passing them to MongoDB.
mongoose.set('strictQuery', true);

let listenersRegistered = false;

function registerConnectionListeners(): void {
  if (listenersRegistered) return;
  listenersRegistered = true;
  mongoose.connection.on('disconnected', () => {
    logger.warn('MongoDB disconnected');
  });
  mongoose.connection.on('reconnected', () => {
    logger.info('MongoDB reconnected');
  });
  mongoose.connection.on('error', (error: unknown) => {
    logger.error({ err: error }, 'MongoDB connection error');
  });
}

export async function connectDatabase(uri: string, dbName?: string): Promise<void> {
  registerConnectionListeners();
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5_000, ...(dbName && { dbName }) });
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}

export interface HelloResponse {
  setName?: string;
  msg?: string;
}

/** Replica set members report `setName`; mongos (sharded cluster) reports `msg: "isdbgrid"`. */
export function supportsTransactions(hello: HelloResponse): boolean {
  return typeof hello.setName === 'string' || hello.msg === 'isdbgrid';
}

/** Writes use multi-document transactions, which only replica sets and sharded clusters support. */
export async function assertTransactionsSupported(): Promise<void> {
  const db = mongoose.connection.db;
  if (!db) throw new Error('Database is not connected');
  const hello = (await db.admin().command({ hello: 1 })) as HelloResponse;
  if (!supportsTransactions(hello)) {
    throw new Error(
      'MongoDB must run as a replica set (transactions are required). ' +
        'For local development, start mongod with a replica set name (e.g. rs0), run rs.initiate(), ' +
        'and use a connection string like mongodb://127.0.0.1:27017/mini-trello?replicaSet=rs0.',
    );
  }
}

/** Creates collections and indexes up front: unique indexes must exist before the app relies on them. */
export async function initModels(): Promise<void> {
  await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init()));
}
