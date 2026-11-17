import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z.url(),
  NEXT_PUBLIC_API_PROXY: z.enum(['true', 'false']).default('false'),
});

// Each variable must be referenced by its full name so Next.js can inline it into the browser bundle.
const parsed = envSchema.safeParse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_API_PROXY: process.env.NEXT_PUBLIC_API_PROXY || undefined,
});

if (!parsed.success) {
  throw new Error(
    `Invalid frontend environment configuration (see frontend/.env.example):
${z.prettifyError(parsed.error)}`,
  );
}

const apiUrl = parsed.data.NEXT_PUBLIC_API_URL.replace(/\/+$/, '');

export const env = {
  /** The API host. Socket.IO always connects here directly. */
  apiUrl,
  /**
   * Prefix for REST calls. With the proxy on, the browser calls this site's own `/api/...` and
   * Next.js forwards it to the API (see next.config.ts), so the session cookie is first-party.
   */
  restBaseUrl: parsed.data.NEXT_PUBLIC_API_PROXY === 'true' ? '' : apiUrl,
} as const;
