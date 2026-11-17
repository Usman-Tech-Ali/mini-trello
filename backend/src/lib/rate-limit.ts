import { rateLimit } from 'express-rate-limit';

import { AppError } from './app-error';

interface AuthRateLimiterOptions {
  limit: number;
  windowMs?: number;
  /** Only count failed requests (e.g. login), so normal sign-ins never lock anyone out. */
  failedOnly?: boolean;
}

export function createAuthRateLimiter({
  limit,
  windowMs = 15 * 60 * 1000,
  failedOnly = false,
}: AuthRateLimiterOptions) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: failedOnly,
    handler: (_req, _res, next) => {
      next(
        new AppError(
          429,
          'RATE_LIMITED',
          'Too many attempts. Please wait a few minutes and try again.',
        ),
      );
    },
  });
}

/**
 * Per-user limit for write routes that fan out to other people (comments with @mentions create
 * notifications). Keyed by the signed-in user, so people behind one office IP don't share it.
 * Use after `requireAuth`.
 */
export function createUserRateLimiter({ limit, windowMs }: { limit: number; windowMs: number }) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => `user:${req.auth?.userId ?? 'anonymous'}`,
    handler: (_req, _res, next) => {
      next(
        new AppError(
          429,
          'RATE_LIMITED',
          'You are doing that too often. Please slow down a little.',
        ),
      );
    },
  });
}
