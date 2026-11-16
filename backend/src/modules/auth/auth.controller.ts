import type { AuthResponse, UserDto } from '@mini-trello/shared';
import { loginSchema, registerSchema } from '@mini-trello/shared';
import type { Request, Response } from 'express';

import { AppError } from '../../lib/app-error';
import { getAuthUserId } from '../../lib/request-context';
import { parseInput } from '../../lib/validate';
import { authenticate, findUserById, registerUser } from './auth.service';
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  sessionCookieOptions,
  signSessionToken,
} from './session';

async function startSession(res: Response, user: UserDto): Promise<void> {
  const token = await signSessionToken(user.id);
  res.cookie(SESSION_COOKIE, token, {
    ...sessionCookieOptions(),
    maxAge: SESSION_TTL_SECONDS * 1000,
  });
}

export async function register(req: Request, res: Response<AuthResponse>): Promise<void> {
  const user = await registerUser(parseInput(registerSchema, req.body));
  await startSession(res, user);
  res.status(201).json({ user });
}

export async function login(req: Request, res: Response<AuthResponse>): Promise<void> {
  const user = await authenticate(parseInput(loginSchema, req.body));
  await startSession(res, user);
  res.json({ user });
}

export function logout(_req: Request, res: Response): void {
  res.clearCookie(SESSION_COOKIE, sessionCookieOptions());
  res.status(204).end();
}

export async function me(req: Request, res: Response<AuthResponse>): Promise<void> {
  const user = await findUserById(getAuthUserId(req));
  if (!user) {
    res.clearCookie(SESSION_COOKIE, sessionCookieOptions());
    throw new AppError(401, 'UNAUTHENTICATED', 'Please sign in to continue.');
  }
  res.json({ user });
}
