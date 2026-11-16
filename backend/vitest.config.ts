import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Integration tests start their own in-memory MongoDB; this URI only satisfies config validation.
    env: {
      NODE_ENV: 'test',
      MONGODB_URI: 'mongodb://127.0.0.1:27017/mini-trello-test-unused',
      CORS_ORIGINS: 'http://localhost:3000',
      LOG_LEVEL: 'silent',
    },
    // The first run downloads a MongoDB binary for mongodb-memory-server.
    hookTimeout: 180_000,
  },
});
