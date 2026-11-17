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

const SOCKET_AUDIENCE = 'mini-trello-socket';
export const SOCKET_TICKET_TTL_SECONDS = 60;

/**
 * A one-minute pass for opening a Socket.IO connection. The web app may reach the REST API through
 * its own domain (a proxy), where the session cookie lives, while the socket connects to the API
 * host directly and cannot send that cookie. It asks for a ticket over REST and sends it in the
 * handshake instead. A ticket has its own audience, so it is never accepted as a session (and a
 * session token is never accepted as a ticket), and it carries the session's expiry so the socket
 * still closes when the session ends.
 */
export function signSocketTicket(userId: string, sessionExpiresAt: number): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ sessionExp: sessionExpiresAt })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(SOCKET_AUDIENCE)
    .setIssuedAt(now)
    .setExpirationTime(Math.min(now + SOCKET_TICKET_TTL_SECONDS, sessionExpiresAt))
    .sign(secret);
}

/** Returns the session a valid, unexpired socket ticket was issued for, or null. */
export async function verifySocketTicket(token: string): Promise<VerifiedSession | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: ISSUER,
      audience: SOCKET_AUDIENCE,
      algorithms: ['HS256'],
    });
    const { sub, sessionExp } = payload;
    if (!sub || typeof sessionExp !== 'number') return null;
    return { userId: sub, expiresAt: sessionExp };
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
