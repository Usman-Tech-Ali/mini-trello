import type { RequestHandler } from 'express';

import { getAuthUserId, getMembership } from '../lib/request-context';
import { parseIdParam } from '../lib/validate';
import {
  assertWorkspaceAdmin,
  assertWorkspaceMember,
  WORKSPACE_NOT_FOUND,
} from '../modules/workspaces/workspace-access';

/** Requires `:workspaceId` in the route and the current user to be a member of that workspace. */
export const requireWorkspaceMember: RequestHandler = async (req, _res, next) => {
  const workspaceId = parseIdParam(req.params.workspaceId, WORKSPACE_NOT_FOUND);
  req.membership = await assertWorkspaceMember(getAuthUserId(req), workspaceId);
  next();
};

/** Use after `requireWorkspaceMember`. */
export const requireWorkspaceAdmin: RequestHandler = (req, _res, next) => {
  assertWorkspaceAdmin(getMembership(req));
  next();
};
