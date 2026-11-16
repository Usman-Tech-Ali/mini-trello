import { Router } from 'express';

import { requireAuth } from '../../middleware/require-auth';
import { requireWorkspaceAdmin, requireWorkspaceMember } from '../../middleware/require-workspace';
import {
  addWorkspaceMember,
  create,
  get,
  list,
  members,
  remove,
  updateRole,
} from './workspaces.controller';

export const workspacesRouter = Router();

workspacesRouter.use(requireAuth);

workspacesRouter.post('/', create);
workspacesRouter.get('/', list);
workspacesRouter.get('/:workspaceId', requireWorkspaceMember, get);
workspacesRouter.get('/:workspaceId/members', requireWorkspaceMember, members);
workspacesRouter.post(
  '/:workspaceId/members',
  requireWorkspaceMember,
  requireWorkspaceAdmin,
  addWorkspaceMember,
);
workspacesRouter.patch(
  '/:workspaceId/members/:userId',
  requireWorkspaceMember,
  requireWorkspaceAdmin,
  updateRole,
);
// Admin check happens in the service: members may remove themselves (leave the workspace).
workspacesRouter.delete('/:workspaceId/members/:userId', requireWorkspaceMember, remove);
