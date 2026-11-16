import type { Request, RequestHandler } from 'express';

import { AppError } from '../lib/app-error';
import { SESSION_COOKIE, verifySessionToken } from '../modules/auth/session';

function readSessionCookie(req: Request): string | undefined {
  // Express types parsed cookies as `any`; treat them as untrusted input.
  const cookies: unknown = req.cookies;
  if (typeof cookies !== 'object' || cookies === null) return undefined;
  const value = (cookies as Record<string, unknown>)[SESSION_COOKIE];
  return typeof value === 'string' ? value : undefined;
}

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const token = readSessionCookie(req);
  const userId = token ? await verifySessionToken(token) : null;
  if (!userId) {
    next(new AppError(401, 'UNAUTHENTICATED', 'Please sign in to continue.'));
    return;
  }
  req.auth = { userId };
  next();
};
