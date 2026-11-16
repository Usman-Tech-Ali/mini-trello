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
  const member = await addMember(getMembership(req).workspaceId, email);
  res.status(201).json({ member });
}

export async function updateRole(req: Request, res: Response<MemberResponse>): Promise<void> {
  const { workspaceId, userId } = getMembership(req);
  const targetUserId = parseIdParam(req.params.userId, MEMBER_NOT_FOUND);
  const { role } = parseInput(updateMemberRoleSchema, req.body);
  res.json({ member: await updateMemberRole(workspaceId, userId, targetUserId, role) });
}

export async function remove(req: Request, res: Response): Promise<void> {
  const { workspaceId, userId } = getMembership(req);
  const targetUserId = parseIdParam(req.params.userId, MEMBER_NOT_FOUND);
  await removeMember(workspaceId, userId, targetUserId);
  res.status(204).end();
}
