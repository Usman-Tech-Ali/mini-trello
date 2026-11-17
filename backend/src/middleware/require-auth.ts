import type { Request, RequestHandler } from 'express';

import { AppError } from '../lib/app-error';
import { SESSION_COOKIE, verifySession } from '../modules/auth/session';

function readSessionCookie(req: Request): string | undefined {
  // Express types parsed cookies as `any`; treat them as untrusted input.
  const cookies: unknown = req.cookies;
  if (typeof cookies !== 'object' || cookies === null) return undefined;
  const value = (cookies as Record<string, unknown>)[SESSION_COOKIE];
  return typeof value === 'string' ? value : undefined;
}

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const token = readSessionCookie(req);
  const session = token ? await verifySession(token) : null;
  if (!session) {
    next(new AppError(401, 'UNAUTHENTICATED', 'Please sign in to continue.'));
    return;
  }
  req.auth = { userId: session.userId, sessionExpiresAt: session.expiresAt };
  next();
};
