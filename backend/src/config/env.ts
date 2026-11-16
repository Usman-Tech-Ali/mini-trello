import { resolve } from 'node:path';

import { z } from 'zod';

const originSchema = z.url().refine((value) => new URL(value).origin === value, {
  message: 'Must be an exact origin like http://localhost:3000 (no path or trailing slash)',
});

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(4000),
  MONGODB_URI: z
    .string()
    .regex(/^mongodb(\+srv)?:\/\//, 'Must be a mongodb:// or mongodb+srv:// URI'),
  CORS_ORIGINS: z
    .string()
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    )
    .pipe(z.array(originSchema).min(1, 'At least one origin is required')),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  JWT_SECRET: z.string().min(32, 'Must be at least 32 characters (use a long random value)'),
  // Defaults to true in production. Must be true when COOKIE_SAME_SITE=none.
  COOKIE_SECURE: z.stringbool().optional(),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  // Max auth attempts per IP per 15 minutes (failed attempts only, for login).
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  // Optional JSON log file (e.g. ../logs/dev.log) in addition to stdout.
  LOG_FILE: z.string().min(1).optional(),
});

function loadConfig() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(parsed.error)}`);
  }
  const env = parsed.data;
  const cookieSecure = env.COOKIE_SECURE ?? env.NODE_ENV === 'production';
  if (env.COOKIE_SAME_SITE === 'none' && !cookieSecure) {
    throw new Error(
      'Invalid environment configuration: COOKIE_SAME_SITE=none requires COOKIE_SECURE=true',
    );
  }
  return {
    nodeEnv: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    port: env.PORT,
    mongodbUri: env.MONGODB_URI,
    corsOrigins: env.CORS_ORIGINS,
    logLevel: env.LOG_LEVEL,
    jwtSecret: env.JWT_SECRET,
    cookie: { secure: cookieSecure, sameSite: env.COOKIE_SAME_SITE },
    authRateLimitMax: env.AUTH_RATE_LIMIT_MAX,
    logFile: env.LOG_FILE ? resolve(env.LOG_FILE) : undefined,
  } as const;
}

export const config = loadConfig();

export type AppConfig = typeof config;
