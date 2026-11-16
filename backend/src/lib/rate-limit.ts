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
      next(new AppError(429, 'RATE_LIMITED', 'Too many attempts. Please wait a few minutes and try again.'));
    },
  });
}
