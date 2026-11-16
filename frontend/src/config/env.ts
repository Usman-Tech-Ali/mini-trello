import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z.url(),
});

// Each variable must be referenced by its full name so Next.js can inline it into the browser bundle.
const parsed = envSchema.safeParse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
});

if (!parsed.success) {
  throw new Error(
    `Invalid frontend environment configuration (see frontend/.env.example):\n${z.prettifyError(parsed.error)}`,
  );
}

export const env = {
  apiUrl: parsed.data.NEXT_PUBLIC_API_URL.replace(/\/+$/, ''),
} as const;
