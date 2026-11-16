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

export async function connectDatabase(uri: string): Promise<void> {
  registerConnectionListeners();
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 5_000 });
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
