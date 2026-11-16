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

/** Returns the user id for a valid, unexpired token, or null for anything else. */
export async function verifySessionToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
    });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export function sessionCookieOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    path: '/',
  };
}
