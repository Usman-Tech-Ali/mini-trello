import { z } from 'zod';

import { emailSchema, requestIdSchema } from './common';

export const workspaceRoleSchema = z.enum(['admin', 'member']);

export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;

export const createWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Workspace name is required')
    .max(80, 'Workspace name must be at most 80 characters'),
  requestId: requestIdSchema,
});

export type CreateWorkspaceInput = z.infer<typeof createWorkspaceSchema>;

export const addMemberSchema = z.object({
  email: emailSchema,
});

export type AddMemberInput = z.infer<typeof addMemberSchema>;

export const updateMemberRoleSchema = z.object({
  role: workspaceRoleSchema,
});

export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

export interface WorkspaceDto {
  id: string;
  name: string;
  /** The current user's role in this workspace. */
  role: WorkspaceRole;
  createdAt: string;
}

export interface MemberDto {
  userId: string;
  name: string;
  email: string;
  role: WorkspaceRole;
  joinedAt: string;
}

export interface WorkspaceResponse {
  workspace: WorkspaceDto;
}

export interface WorkspaceListResponse {
  workspaces: WorkspaceDto[];
}

export interface MemberResponse {
  member: MemberDto;
}

export interface MemberListResponse {
  members: MemberDto[];
}
