import type { CookieOptions } from 'express';
import { jwtVerify, SignJWT } from 'jose';

import { config } from '../../config/env';

export const SESSION_COOKIE = 'mt_session';
export const SESSION_TTL_SECONDS = 24 * 60 * 60;

const ISSUER = 'mini-trello-api';
const AUDIENCE = 'mini-trello-web';
const secret = new TextEncoder().encode(config.jwtSecret);

export function signSessionToken(userId: string): Promise<string> {
  return new SignJWT()
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret);
}

export interface VerifiedSession {
  userId: string;
  /** Unix time (seconds) when the session expires. */
  expiresAt: number;
}

/** Returns the session for a valid, unexpired token, or null for anything else. */
export async function verifySession(token: string): Promise<VerifiedSession | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
    });
    if (!payload.sub || payload.exp === undefined) return null;
    return { userId: payload.sub, expiresAt: payload.exp };
  } catch {
    return null;
  }
}

export async function verifySessionToken(token: string): Promise<string | null> {
  return (await verifySession(token))?.userId ?? null;
}

export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    path: '/',
  };
}
