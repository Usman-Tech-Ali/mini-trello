import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./src/test/global-setup.ts'],
    // Integration tests start their own in-memory MongoDB; this URI only satisfies config validation.
    env: {
      NODE_ENV: 'test',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/mini-trello-test-unused',
      CORS_ORIGINS: 'http://localhost:3000',
      LOG_LEVEL: 'silent',
      JWT_SECRET: 'test-secret-that-is-at-least-32-characters-long',
      AUTH_RATE_LIMIT_MAX: '1000',
    },
    // The first run downloads a MongoDB binary for mongodb-memory-server.
    hookTimeout: 180_000,
    // Integration tests hash passwords (argon2, deliberately CPU-heavy) and run transactions;
    // on a busy machine or CI runner the 5 s default caused rare false timeouts.
    testTimeout: 20_000,
  },
});
