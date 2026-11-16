import { z } from 'zod';

export const objectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');

/** Client-generated id, created once per user action and reused on retries (dedupes creates). */
export const requestIdSchema = z.uuid('Invalid request id');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address').max(254, 'Email is too long'));
