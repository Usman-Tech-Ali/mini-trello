import type { Request } from 'express';

import type { MembershipContext } from '../modules/workspaces/workspace-access';

// These only fail if a route is missing its middleware — a programming error, hence a plain Error (500).

export function getAuthUserId(req: Request): string {
  if (!req.auth) throw new Error('requireAuth middleware is missing on this route');
  return req.auth.userId;
}

export function getMembership(req: Request): MembershipContext {
  if (!req.membership) throw new Error('requireWorkspaceMember middleware is missing on this route');
  return req.membership;
}
