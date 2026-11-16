import type { RequestHandler } from 'express';

import { AppError } from '../lib/app-error';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function originFromReferer(referer: string | undefined): string | undefined {
  if (!referer) return undefined;
  try {
    return new URL(referer).origin;
  } catch {
    return undefined;
  }
}

/**
 * CSRF defense in addition to SameSite cookies: state-changing requests must come from an
 * allowlisted browser origin. Requests without Origin and Referer are rejected (non-browser
 * clients must send an Origin header explicitly).
 */
export function originCheck(allowedOrigins: readonly string[]): RequestHandler {
  const allowed = new Set(allowedOrigins);

  return (req, _res, next) => {
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }
    const origin = req.get('origin') ?? originFromReferer(req.get('referer'));
    if (origin !== undefined && allowed.has(origin)) {
      next();
      return;
    }
    next(new AppError(403, 'INVALID_ORIGIN', 'Request origin is not allowed.'));
  };
}
