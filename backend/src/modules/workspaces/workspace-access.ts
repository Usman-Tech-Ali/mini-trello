import type { WorkspaceRole } from '@mini-trello/shared';
import type { ClientSession } from 'mongoose';

import { AppError } from '../../lib/app-error';
import { MembershipModel } from './membership.model';

/**
 * Authorization rules for workspaces, shared by REST middleware and (from Phase 3) Socket.IO handlers.
 * Non-members get 404 so they can't tell whether a workspace exists; members lacking a role get 403.
 */

export interface MembershipContext {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
}

export const WORKSPACE_NOT_FOUND = 'Workspace not found.';
export const MEMBER_NOT_FOUND = 'Member not found.';

export async function findMembership(
  userId: string,
  workspaceId: string,
  session?: ClientSession,
): Promise<MembershipContext | null> {
  const membership = await MembershipModel.findOne({ workspaceId, userId }, null, { session });
  return membership ? { workspaceId, userId, role: membership.role } : null;
}

export async function assertWorkspaceMember(
  userId: string,
  workspaceId: string,
  session?: ClientSession,
): Promise<MembershipContext> {
  const membership = await findMembership(userId, workspaceId, session);
  if (!membership) throw new AppError(404, 'NOT_FOUND', WORKSPACE_NOT_FOUND);
  return membership;
}

export function assertWorkspaceAdmin(membership: MembershipContext): void {
  if (membership.role !== 'admin') {
    throw new AppError(403, 'FORBIDDEN', 'Only workspace admins can do this.');
  }
}
