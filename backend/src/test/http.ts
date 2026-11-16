import type { UserDto } from '@mini-trello/shared';
import type { Express } from 'express';
import request from 'supertest';

export const TEST_ORIGIN = 'http://localhost:3000';
export const TEST_PASSWORD = 'correct-horse-battery';

let emailCounter = 0;
export function uniqueEmail(prefix = 'user'): string {
  emailCounter += 1;
  return `${prefix}-${Date.now()}-${emailCounter}@example.com`;
}

/** A cookie-keeping client that sends the allowlisted Origin on state-changing requests. */
export function createClient(app: Express) {
  const agent = request.agent(app);
  return {
    get: (url: string) => agent.get(url),
    post: (url: string) => agent.post(url).set('Origin', TEST_ORIGIN),
    patch: (url: string) => agent.patch(url).set('Origin', TEST_ORIGIN),
    delete: (url: string) => agent.delete(url).set('Origin', TEST_ORIGIN),
  };
}

export type TestClient = ReturnType<typeof createClient>;

export interface TestUser {
  client: TestClient;
  user: UserDto;
}

export async function registerUser(app: Express, name = 'Test User'): Promise<TestUser> {
  const client = createClient(app);
  const res = await client
    .post('/api/auth/register')
    .send({ name, email: uniqueEmail(name.split(' ')[0]?.toLowerCase()), password: TEST_PASSWORD })
    .expect(201);
  return { client, user: (res.body as { user: UserDto }).user };
}
