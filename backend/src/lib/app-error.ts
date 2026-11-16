import type { ErrorCode, FieldErrors } from '@mini-trello/shared';

/** An expected, client-facing error. Anything else that reaches the error handler is treated as a 500. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: FieldErrors,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
