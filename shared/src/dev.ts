import { z } from 'zod';

/** Browser errors forwarded to the API log in development only. */
export const clientLogSchema = z.object({
  level: z.enum(['error', 'warn']),
  message: z.string().min(1).max(2000),
  stack: z.string().max(8000).optional(),
  url: z.string().max(2000),
  source: z.enum(['window.onerror', 'unhandledrejection', 'console.error', 'error-boundary']),
});
export type ClientLogInput = z.infer<typeof clientLogSchema>;
