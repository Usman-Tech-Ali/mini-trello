import { MongoMemoryReplSet } from 'mongodb-memory-server';
import type { TestProject } from 'vitest/node';

// One in-memory replica set for the whole run; each test file uses its own database on it.
// Starting a replica set per file in parallel is slower and can race on startup.
let replSet: MongoMemoryReplSet | undefined;

export async function setup(project: TestProject): Promise<void> {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  project.provide('mongoUri', replSet.getUri());
}

export async function teardown(): Promise<void> {
  await replSet?.stop();
}

declare module 'vitest' {
  export interface ProvidedContext {
    mongoUri: string;
  }
}
