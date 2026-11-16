import type {
  CreateWorkspaceInput,
  MemberDto,
  WorkspaceDto,
  WorkspaceRole,
} from '@mini-trello/shared';
import mongoose, { type ClientSession } from 'mongoose';

import { AppError } from '../../lib/app-error';
import { isDuplicateKeyError } from '../../lib/mongo-errors';
import { TaskModel } from '../tasks/task.model';
import { UserModel } from '../users/user.model';
import { MembershipModel, type MembershipDocument } from './membership.model';
import {
  assertWorkspaceAdmin,
  assertWorkspaceMember,
  MEMBER_NOT_FOUND,
  WORKSPACE_NOT_FOUND,
} from './workspace-access';
import { WorkspaceModel, type WorkspaceDocument } from './workspace.model';

function toWorkspaceDto(
  workspace: Pick<WorkspaceDocument, '_id' | 'name' | 'createdAt'>,
  role: WorkspaceRole,
): WorkspaceDto {
  return {
    id: workspace._id.toString(),
    name: workspace.name,
    role,
    createdAt: workspace.createdAt.toISOString(),
  };
}

function toMemberDto(
  membership: Pick<MembershipDocument, 'role' | 'createdAt'>,
  user: { _id: mongoose.Types.ObjectId; name: string; email: string },
): MemberDto {
  return {
    userId: user._id.toString(),
    name: user.name,
    email: user.email,
    role: membership.role,
    joinedAt: membership.createdAt.toISOString(),
  };
}

export async function createWorkspace(
  userId: string,
  input: CreateWorkspaceInput,
): Promise<{ workspace: WorkspaceDto; created: boolean }> {
  try {
    return await mongoose.connection.transaction(async (session) => {
      const [workspace] = await WorkspaceModel.create(
        [{ name: input.name, ownerId: userId, adminCount: 1, requestId: input.requestId }],
        { session },
      );
      if (!workspace) throw new Error('Workspace was not created');
      await MembershipModel.create([{ workspaceId: workspace._id, userId, role: 'admin' }], {
        session,
      });
      return { workspace: toWorkspaceDto(workspace, 'admin'), created: true };
    });
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
    // A retry of a request that already succeeded: return the original result instead of a duplicate.
    const existing = await WorkspaceModel.findOne({ ownerId: userId, requestId: input.requestId });
    if (!existing) throw error;
    const membership = await assertWorkspaceMember(userId, existing._id.toString());
    return { workspace: toWorkspaceDto(existing, membership.role), created: false };
  }
}

export async function listWorkspaces(userId: string): Promise<WorkspaceDto[]> {
  const memberships = await MembershipModel.find({ userId }).lean();
  const roleByWorkspace = new Map(memberships.map((m) => [m.workspaceId.toString(), m.role]));
  const workspaces = await WorkspaceModel.find({ _id: { $in: [...roleByWorkspace.keys()] } })
    .sort({ createdAt: -1 })
    .lean();
  return workspaces.flatMap((workspace) => {
    const role = roleByWorkspace.get(workspace._id.toString());
    return role ? [toWorkspaceDto(workspace, role)] : [];
  });
}

export async function getWorkspace(
  workspaceId: string,
  role: WorkspaceRole,
): Promise<WorkspaceDto> {
  const workspace = await WorkspaceModel.findById(workspaceId).lean();
  if (!workspace) throw new AppError(404, 'NOT_FOUND', WORKSPACE_NOT_FOUND);
  return toWorkspaceDto(workspace, role);
}

export async function listMembers(workspaceId: string): Promise<MemberDto[]> {
  const memberships = await MembershipModel.find({ workspaceId }).sort({ createdAt: 1 }).lean();
  const users = await UserModel.find({ _id: { $in: memberships.map((m) => m.userId) } })
    .select('name email')
    .lean();
  const userById = new Map(users.map((user) => [user._id.toString(), user]));
  return memberships.flatMap((membership) => {
    const user = userById.get(membership.userId.toString());
    return user ? [toMemberDto(membership, user)] : [];
  });
}

export async function addMember(workspaceId: string, email: string): Promise<MemberDto> {
  const user = await UserModel.findOne({ email }).select('name email');
  if (!user) {
    // Reveals whether an email is registered — an accepted trade-off of "invite registered users".
    throw new AppError(404, 'USER_NOT_FOUND', 'No registered user with that email.', {
      email: ['No registered user with that email.'],
    });
  }
  try {
    const membership = await MembershipModel.create({
      workspaceId,
      userId: user._id,
      role: 'member',
    });
    return toMemberDto(membership, user);
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new AppError(409, 'ALREADY_MEMBER', 'This user is already a member of the workspace.', {
        email: ['This user is already a member of the workspace.'],
      });
    }
    throw error;
  }
}

/** Fails with LAST_ADMIN instead of letting the workspace drop to zero admins. */
async function decrementAdminCount(workspaceId: string, session: ClientSession): Promise<void> {
  const result = await WorkspaceModel.updateOne(
    { _id: workspaceId, adminCount: { $gt: 1 } },
    { $inc: { adminCount: -1 } },
    { session },
  );
  if (result.matchedCount === 0) {
    throw new AppError(
      409,
      'LAST_ADMIN',
      'A workspace must keep at least one admin. Make another member an admin first.',
    );
  }
}

async function getTargetMembership(
  workspaceId: string,
  userId: string,
  session: ClientSession,
): Promise<MembershipDocument> {
  const membership = await MembershipModel.findOne({ workspaceId, userId }, null, { session });
  if (!membership) throw new AppError(404, 'NOT_FOUND', MEMBER_NOT_FOUND);
  return membership;
}

// Membership changes re-check the actor's permissions inside the transaction, so a permission
// change committed concurrently can't be bypassed with a stale check.

export async function updateMemberRole(
  workspaceId: string,
  actorUserId: string,
  targetUserId: string,
  role: WorkspaceRole,
): Promise<MemberDto> {
  const membership = await mongoose.connection.transaction(async (session) => {
    assertWorkspaceAdmin(await assertWorkspaceMember(actorUserId, workspaceId, session));
    const target = await getTargetMembership(workspaceId, targetUserId, session);
    if (target.role === role) return target;

    if (role === 'member') {
      await decrementAdminCount(workspaceId, session);
    } else {
      await WorkspaceModel.updateOne(
        { _id: workspaceId },
        { $inc: { adminCount: 1 } },
        { session },
      );
    }
    target.role = role;
    await target.save({ session });
    return target;
  });

  const user = await UserModel.findById(targetUserId).select('name email').lean();
  if (!user) throw new AppError(404, 'NOT_FOUND', MEMBER_NOT_FOUND);
  return toMemberDto(membership, user);
}

/** Admins can remove anyone; any member can remove themselves (leave). */
export async function removeMember(
  workspaceId: string,
  actorUserId: string,
  targetUserId: string,
): Promise<void> {
  await mongoose.connection.transaction(async (session) => {
    const actor = await assertWorkspaceMember(actorUserId, workspaceId, session);
    if (actorUserId !== targetUserId) assertWorkspaceAdmin(actor);

    const target = await getTargetMembership(workspaceId, targetUserId, session);
    if (target.role === 'admin') await decrementAdminCount(workspaceId, session);
    await MembershipModel.deleteOne({ _id: target._id }, { session });
    // Former members can't stay assigned to tasks they can no longer see.
    await TaskModel.updateMany(
      { workspaceId, assigneeId: targetUserId },
      { $set: { assigneeId: null }, $inc: { version: 1 } },
      { session },
    );
  });
}
