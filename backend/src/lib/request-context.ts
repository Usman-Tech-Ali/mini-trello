import { SOCKET_ID_HEADER } from '@mini-trello/shared';
import type { Request } from 'express';

import type { BoardAccess, TaskAccess } from '../modules/boards/board-access';
import type { MembershipContext } from '../modules/workspaces/workspace-access';

// These only fail if a route is missing its middleware — a programming error, hence a plain Error (500).

export function getAuthUserId(req: Request): string {
  if (!req.auth) throw new Error('requireAuth middleware is missing on this route');
  return req.auth.userId;
}

export function getMembership(req: Request): MembershipContext {
  if (!req.membership)
    throw new Error('requireWorkspaceMember middleware is missing on this route');
  return req.membership;
}

export function getBoardAccess(req: Request): BoardAccess {
  if (!req.boardAccess) throw new Error('requireBoardAccess middleware is missing on this route');
  return req.boardAccess;
}

export function getTaskAccess(req: Request): TaskAccess {
  if (!req.taskAccess) throw new Error('requireTaskAccess middleware is missing on this route');
  return req.taskAccess;
}

const SOCKET_ID_PATTERN = /^[\w-]{1,64}$/;

/** The caller's own socket, so a broadcast can skip echoing the change back to it. */
export function getOriginSocketId(req: Request): string | undefined {
  const value = req.get(SOCKET_ID_HEADER);
  return value && SOCKET_ID_PATTERN.test(value) ? value : undefined;
}
