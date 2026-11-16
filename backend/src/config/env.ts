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
});

function loadConfig() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment configuration:\n${z.prettifyError(parsed.error)}`);
  }
  const env = parsed.data;
  return {
    nodeEnv: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    port: env.PORT,
    mongodbUri: env.MONGODB_URI,
    corsOrigins: env.CORS_ORIGINS,
    logLevel: env.LOG_LEVEL,
  } as const;
}

export const config = loadConfig();

export type AppConfig = typeof config;
