import type {
  MemberListResponse,
  MemberResponse,
  WorkspaceListResponse,
  WorkspaceResponse,
} from '@mini-trello/shared';
import {
  addMemberSchema,
  createWorkspaceSchema,
  updateMemberRoleSchema,
} from '@mini-trello/shared';
import type { Request, Response } from 'express';

import { getAuthUserId, getMembership } from '../../lib/request-context';
import { parseIdParam, parseInput } from '../../lib/validate';
import { emitToBoard, emitToUser, revokeWorkspaceAccess } from '../../realtime/realtime-server';
import { listBoards } from '../boards/boards.service';
import { MEMBER_NOT_FOUND } from './workspace-access';
import {
  addMember,
  createWorkspace,
  getWorkspace,
  listMembers,
  listWorkspaces,
  removeMember,
  updateMemberRole,
} from './workspaces.service';

export async function create(req: Request, res: Response<WorkspaceResponse>): Promise<void> {
  const input = parseInput(createWorkspaceSchema, req.body);
  const { workspace, created } = await createWorkspace(getAuthUserId(req), input);
  res.status(created ? 201 : 200).json({ workspace });
}

export async function list(req: Request, res: Response<WorkspaceListResponse>): Promise<void> {
  res.json({ workspaces: await listWorkspaces(getAuthUserId(req)) });
}

export async function get(req: Request, res: Response<WorkspaceResponse>): Promise<void> {
  const { workspaceId, role } = getMembership(req);
  res.json({ workspace: await getWorkspace(workspaceId, role) });
}

export async function members(req: Request, res: Response<MemberListResponse>): Promise<void> {
  res.json({ members: await listMembers(getMembership(req).workspaceId) });
}

export async function addWorkspaceMember(
  req: Request,
  res: Response<MemberResponse>,
): Promise<void> {
  const { email } = parseInput(addMemberSchema, req.body);
  const { workspaceId } = getMembership(req);
  const member = await addMember(workspaceId, email);
  // The new member's open tabs show the workspace without a reload.
  emitToUser(member.userId, 'workspaces:changed', { workspaceId });
  res.status(201).json({ member });
}

export async function updateRole(req: Request, res: Response<MemberResponse>): Promise<void> {
  const { workspaceId, userId } = getMembership(req);
  const targetUserId = parseIdParam(req.params.userId, MEMBER_NOT_FOUND);
  const { role } = parseInput(updateMemberRoleSchema, req.body);
  const member = await updateMemberRole(workspaceId, userId, targetUserId, role);
  emitToUser(targetUserId, 'workspaces:changed', { workspaceId });
  res.json({ member });
}

export async function remove(req: Request, res: Response): Promise<void> {
  const { workspaceId, userId } = getMembership(req);
  const targetUserId = parseIdParam(req.params.userId, MEMBER_NOT_FOUND);
  await removeMember(workspaceId, userId, targetUserId);
  // Live connections must not outlast membership: take the user out of the workspace's boards,
  // and tell everyone else to refresh tasks (the removed member's tasks were unassigned).
  revokeWorkspaceAccess(workspaceId, targetUserId);
  emitToUser(targetUserId, 'workspaces:changed', { workspaceId });
  for (const board of await listBoards(workspaceId)) {
    emitToBoard(board.id, undefined, 'board:stale', { boardId: board.id });
  }
  res.status(204).end();
}
