import { describe, expect, it } from 'vitest';

import { loadConfig } from './env';

const valid = {
  NODE_ENV: 'production',
  MONGODB_URI: 'mongodb://127.0.0.1:27017/mini-trello?replicaSet=rs0',
  CORS_ORIGINS: 'https://app.example.com',
  JWT_SECRET: 'k3Jx9vQ2pLr8TzW5mN7bY4cH6dF1gA0sE2uI9oP3qR5tV8wX',
};

describe('loadConfig', () => {
  it('accepts a complete production configuration with secure defaults', () => {
    const config = loadConfig(valid);
    expect(config.cookie).toEqual({ secure: true, sameSite: 'lax' });
    expect(config.trustProxy).toBe(0);
  });

  it('requires NODE_ENV instead of silently falling back to development', () => {
    expect(() => loadConfig({ ...valid, NODE_ENV: undefined })).toThrow(/NODE_ENV/);
  });

  it('refuses the public example JWT secret and short secrets', () => {
    expect(() =>
      loadConfig({ ...valid, JWT_SECRET: 'replace-with-a-long-random-secret-at-least-32-chars' }),
    ).toThrow(/JWT_SECRET/);
    expect(() => loadConfig({ ...valid, JWT_SECRET: 'too-short' })).toThrow(/JWT_SECRET/);
  });

  it('reads the number of trusted proxies', () => {
    expect(loadConfig({ ...valid, TRUST_PROXY: '1' }).trustProxy).toBe(1);
  });

  it('rejects SameSite=None without Secure cookies', () => {
    expect(() =>
      loadConfig({ ...valid, COOKIE_SAME_SITE: 'none', COOKIE_SECURE: 'false' }),
    ).toThrow(/COOKIE_SECURE/);
  });
});
