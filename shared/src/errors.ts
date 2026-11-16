import { z } from 'zod';

export const errorCodeSchema = z.enum([
  'BAD_REQUEST',
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'INVALID_ORIGIN',
  'NOT_FOUND',
  'CONFLICT',
  'PAYLOAD_TOO_LARGE',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
  // Domain-specific codes
  'INVALID_CREDENTIALS',
  'EMAIL_TAKEN',
  'USER_NOT_FOUND',
  'ALREADY_MEMBER',
  'LAST_ADMIN',
  'VERSION_CONFLICT',
  'COLUMN_NOT_EMPTY',
]);

export type ErrorCode = z.infer<typeof errorCodeSchema>;

/** Validation messages keyed by field path, e.g. `{ "email": ["Invalid email address"] }`. */
export const fieldErrorsSchema = z.record(z.string(), z.array(z.string()));

export type FieldErrors = z.infer<typeof fieldErrorsSchema>;

/** The single error shape returned by every API endpoint. */
export const apiErrorResponseSchema = z.object({
  error: z.object({
    code: errorCodeSchema,
    message: z.string(),
    details: fieldErrorsSchema.optional(),
  }),
});

export type ApiErrorResponse = z.infer<typeof apiErrorResponseSchema>;
