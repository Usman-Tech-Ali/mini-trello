import type { FieldErrors } from '@mini-trello/shared';
import { objectIdSchema } from '@mini-trello/shared';
import type { z } from 'zod';

import { AppError } from './app-error';

function toFieldErrors(error: z.ZodError): FieldErrors {
  const details: FieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : 'body';
    (details[key] ??= []).push(issue.message);
  }
  return details;
}

/** Validates untrusted input against a shared schema; returns the parsed (trimmed, normalized) value. */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new AppError(
      400,
      'VALIDATION_ERROR',
      'Some fields are invalid.',
      toFieldErrors(result.error),
    );
  }
  return result.data;
}

/** A malformed id can't match any resource, so it is reported as not found. */
export function parseIdParam(value: unknown, notFoundMessage: string): string {
  const result = objectIdSchema.safeParse(value);
  if (!result.success) throw new AppError(404, 'NOT_FOUND', notFoundMessage);
  return result.data;
}
